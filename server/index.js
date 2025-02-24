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

app.use(logger('dev'))

app.get('/', (req, res) => {
  // res.send("Perraaaas")
  res.sendFile(process.cwd() + '/client/index.html')
})



server.listen(port, () => {
  console.log(`Usuario conectado en el puerto ${port}`);
});



const db = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.AUTO_TOKEN
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

  console.log(socket.handshake.auth)
  if (!socket.recovered) { //recuperase los mensajes sin conexion
    try {
      // console.log(socket)
      console.log("socket handshake: ", socket.handshake.auth)
      const results = await db.execute("SELECT * FROM mensajes WHERE id > ?",
        [socket.handshake.auth.serverOffset || 0])

      results.rows.forEach(row => {
        socket.emit('mensaje', { data: row.content, id: row.id, username: row.user })
      })
      // console.log("Mensajes recuperados: ", results)
      // console.log(results)

      // Marcar como recuperado después de recuperar los mensajes
    socket.recovered = true;
    } catch (error) {
      console.error(error)
    }
  }


  socket.on('mensaje', async (data) => {
    console.log("Ver usuario ", socket.handshake.auth)
    const username = socket.handshake.auth.user ?? 'anonymous'
    console.log(data)
    let result;
    try {
      result = await db.execute(`INSERT INTO mensajes (content, user) VALUES (?,?)`, [data, username])
    } catch (error) {
      console.log(error)
      return
    }
    io.emit('mensaje',{ data, id: result.lastInsertRowid.toString(),  username })
    // io.emit('mensaje', { data, id: result.lastInsertRowid.toString() })


    // socket.broadcast.emit('mensaje', {
    // data,
    // from: socket.id.slice(0, 5)
    // })
  })

  // socket.on('disconnect', () => {
  //   console.log("un usuario se ha desconectado")
  // })
})


