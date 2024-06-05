import express from 'express';
import logger from 'morgan';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { createClient } from '@libsql/client';

const port = process.env.PORT || 3000;

dotenv.config();

const app = express();
//aca creamos un servidor general
const server = createServer(app);
//le mandamos el servidor general al web socket para importartlo
const io = new Server(server, {
    connectionStateRecovery: {
        maxDisconnectionDuration: 10000,
        skipMiddlewares: false,
    }
});
const db =  createClient({ url: process.env.DATABASE_URL, authToken: process.env.DATABASE_AUTH_TOKEN });


await db.execute(`
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT,
  content TEXT
);`);



app.use(logger('dev'));

app.get( '/', (req, res) =>{
    res.sendFile(process.cwd() + '/client/index.html');
});

//con esto tenemos la conexion del web socket
io.on('connection', async (socket) => {
    console.log('a user connected');

    socket.on('message',  async (msg) => {
        console.log('message: ' + msg);
        let result;
        let user = socket.handshake.auth.username || 'anonymous';
        console.log('user', user);
        try {
            result = await db.execute({
                sql: 'INSERT INTO messages (content, username) VALUES (:msg, :username)',
                args: { msg, username: user }
            })
        } catch (e) {
            console.log(e);
            return;
        }
        io.emit('message', msg, result.lastInsertRowid.toString(), user); //para emitir el mensaje
    });

    if (!socket.recovered) {
        // if the connection state recovery was not successful
        try {
            const messages = await db.execute({sql : 'SELECT id, content, username FROM messages WHERE id > ?', 
            args: [socket.handshake.auth.serverOffset || 0]});

            messages.rows.forEach(
            (row) =>{
              socket.emit('message', row.content, row.id.toString(), row.username);
            }
          )
        } catch (e) {
          // something went wrong
        }
      }
    socket.on('disconnect', () => {
        console.log('user disconnected');
      });
});

server.listen(port, ()=>{
    console.log(`Server running on port ${port}`);
})
//cambiarlo a ws para que funcione con lo que utilizan mas esta vex en la clase se va a implementar en socket.io