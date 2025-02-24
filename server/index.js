import express from 'express';
import { createServer } from "node:http";
import { Server } from "socket.io";
import logger from 'morgan';
import { createClient } from "@libsql/client";
import dotenv from 'dotenv';


dotenv.config();



const port = process.env.PORT ?? 3000;

const app = express();
const server = createServer(app);
const io = new Server(server);

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
        socket.emit('mensaje', { data: row.content, id: row.id, from: socket.id.slice(0, 5), username: row.user })
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
      console.log("socket handshake: ", socket.handshake.auth);
    
      const offset = Number.isInteger(socket.handshake.auth.serverOffset)
        ? socket.handshake.auth.serverOffset
        : 0;
    
      const query = offset > 0
        ? "SELECT * FROM mensajes WHERE id > ?"
        : "SELECT * FROM mensajes";
    
      const results = offset > 0
        ? await db.execute(query, [offset])
        : await db.execute(query);
    
      results.rows.forEach(row => {
        socket.emit('mensaje', {
          data: row.content,
          id: row.id,
          from: socket.id.slice(0, 5),
          username: row.user
        });
      });
    
      socket.recovered = true;
    } catch (error) {
      console.error("Error al recuperar mensajes: ", error);
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


