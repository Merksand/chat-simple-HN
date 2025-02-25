import express from 'express';
import logger from 'morgan';
import dotenv from 'dotenv';
import { createServer } from "node:http";
import { Server } from "socket.io";
import { createClient } from "@libsql/client";
dotenv.config();

console.log("DB_TOKEN:", process.env.DB_TOKEN);

const port = process.env.PORT ?? 3001;

const app = express();
const server = createServer(app);
const io = new Server(server, {
  connectionStateRecovery: {}
})

app.get('/', (req, res) => {
  // res.send("Perraaaas")
  res.sendFile(process.cwd() + '/client/index.html')
})

const db = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DB_TOKEN
})


await db.execute(`
  CREATE TABLE IF NOT EXISTS mensajes(
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   content TEXT,
   user TEXT
  )
  `)

io.on('connection', async (socket) => {
  console.log("un usuario se ha conectado: ", socket.id)

  socket.on('mensaje', async (data) => {
    console.log("Ver usuario ", socket.handshake.auth)
    const username = socket.handshake.auth.user ?? 'anonymous'
    console.log({ username })
    let result;
    try {
      result = await db.execute({
        sql: 'INSERT INTO mensajes (content, user) VALUES (:data, :username)',
        args: { data, username }
      })
    } catch (error) {
      console.log(error)
      return
    }
    io.emit('mensaje', { data, id: result.lastInsertRowid.toString(), username })
  })


  console.log(socket.handshake.auth)
  if (!socket.recovered) { //recuperase los mensajes sin conexion
    try {
      // console.log(socket)
      console.log("socket handshake: ", socket.handshake.auth)
      const results = await db.execute({
        sql: 'SELECT id, content, user FROM mensajes WHERE id > ?',
        args: [socket.handshake.auth.serverOffset ?? 0]
      })

      console.log("DATOS BD RECOV: ", results)
      results.rows.forEach(row => {
        socket.emit('mensaje', { data: row.content, id: row.id.toString(), username: row.user })
      })
      // console.log("Mensajes recuperados: ", results)
      // console.log(results)

      // Marcar como recuperado después de recuperar los mensajes
      socket.recovered = true;
    } catch (error) {
      console.error(error)
    }
  }
  socket.on('disconnect', () => {
    console.log("un usuario se ha desconectado")
  })
})

server.listen(port, () => {
  console.log(`Usuario conectado en el puerto ${port}`);
});



app.use(logger('dev'))
