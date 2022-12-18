const socket = require("socket.io");
const http = require("http");
const express = require("express");
const app = express();
const server = http.createServer(app);
const { ORIGIN_URL, ROOM_LIMIT } = require('./config');
const io = socket(server, {
    cors: {
        origin: ORIGIN_URL,
    }
});
const morgan = require('morgan');
const cors = require('cors');

app.use(cors())
app.use(morgan('dev'))

const users = {};

io.on('connection', socket => {
    //Preguntamos si la reunion existe
    socket.on('room-exists', roomID => socket.emit('room-exists', { response: roomID in users, socketID: socket.id }))
    //Pre-inicio de conexcion, pidiendo permisos
    socket.on('permises', data => {
        const { user, roomID } = data
        if(users[roomID].length > ROOM_LIMIT) return socket.emit('room-full')
        const admin = users[roomID].find(p => p.isAdmin)

        io.to(admin.id).emit('get-permises', user)
    })

    // Pre-inicio de conexion, actualizando permisos
    socket.on('update-permises', data => {
        io.to(data.user.id).emit('answer-permises', data)
    })

    //Inicio de la conexion
    socket.on('join-room', data => {
        const { user, roomID } = data
        if (users[roomID]) {
            if(user.isAdmin && users[roomID].filter(p => p.isAdmin).length === 1) return socket.emit('admin-already-exists')
            users[roomID].push(user)
        } else {
            users[roomID] = [user]
        }

        socket.join(roomID)
        const usersInThisRoom = users[roomID].filter(p => p.id !== user.id);
        socket.emit("all-users", usersInThisRoom); // Usuarios en la llamada

        //Conexion entre pares
        socket.on('sending-signal', payload => {
            const { socketID, data } = payload
            io.to(socketID).emit('receiving-signal', data)
        })
        socket.on('returning-signal', payload => {
            const { socketID, data } = payload
            io.to(socketID).emit('receiving-returned-signal', data)
        })

        //Compartiendo pantalla
        socket.on('on-signal-screen', payload => {
            const { socketID, data } = payload
            io.to(socketID).emit('on-screen', data)
        })
        socket.on('returning-signalScreen', payload => {
            const { socketID, data } = payload
            io.to(socketID).emit('receiving-returning-signalScreen', data)
        })

        // Desactivando audio, video y pantalla
        socket.on('off-audio', user => {
            socket.broadcast.to(roomID).emit('off-audio', user)
        })
        socket.on('off-video', user => {
            socket.broadcast.to(roomID).emit('off-video', user)
        })
        socket.on('off-screen', user => {
            socket.broadcast.to(roomID).emit('off-screen', user)
        })

        //Envio de mensajes
        socket.on("send-message", data => {
            socket.broadcast.to(roomID).emit("receive-message", data);
        })

        //Levanto/bajo la mano
        socket.on("raise-lower-hand", data => {
            user.opacityHand = data.opacityHand
            socket.broadcast.to(roomID).emit("raise-lower-hand", data);
        })
    })

    //Finalizar conexion
    socket.on('disconnect', () => {
        const roomID = Object.keys(users).find(key => users[key].find(p => p.id === socket.id));
        if (roomID) {
            const user = users[roomID].find(p => p.id === socket.id)
            users[roomID] = users[roomID].filter(p => p.id !== user.id)
            if(users[roomID].length === 0) {
                delete users[roomID]
            } else {
                if(user.isAdmin) {
                    const indice = Math.floor(Math.random() * users[roomID].length)
                    const newAdmin = users[roomID][indice]
                    newAdmin.isAdmin = true
                    newAdmin.name = "Admin"
                    users[roomID].fill(newAdmin, indice, indice + 1)
                    
                    socket.broadcast.to(roomID).emit('out-room', { user, newAdmin })
                } 
                socket.broadcast.to(roomID).emit('out-room', { user })
            }
        }
    })

});

module.exports = server