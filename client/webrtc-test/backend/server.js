const express = require('express');
const cors = require('cors');
const http = require('http'); 
const { Server } = require('socket.io'); 

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// =====================================
// ОХРАННИК (Middleware) - ПРОВЕРКА ТОКЕНА
// =====================================
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    console.log(`[ОТКАЗ] Попытка входа без токена от: ${socket.id}`);
    return next(new Error("Authentication error: No token provided"));
  }

  console.log(`[ДОСТУП РАЗРЕШЕН] Пользователь с токеном: ${socket.id}`);
  next();
});
// =====================================

io.on('connection', (socket) => {
  console.log('⚡ Подключился:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    socket.to(roomId).emit('user-connected', socket.id);
  });

  socket.on('offer', payload => {
    io.to(payload.target).emit('offer', payload);
  });

  socket.on('answer', payload => {
    // Ensure caller is set so the initiator can look up the peer by socket id
    io.to(payload.target).emit('answer', { ...payload, caller: socket.id });
  });

  socket.on('ice-candidate', incoming => {
    // Forward the full payload so the receiver knows who sent it (caller field)
    io.to(incoming.target).emit('ice-candidate', {
      caller: socket.id,
      candidate: incoming.candidate,
    });
  });

  socket.on('send-chat-message', (data) => {
    socket.to(data.room).emit('chat-message', data.message);
  });

  socket.on('disconnecting', () => {
    // Notify every room this socket was in before it fully disconnects
    socket.rooms.forEach(roomId => {
      if (roomId !== socket.id) {
        socket.to(roomId).emit('user-disconnected', socket.id);
      }
    });
  });

  socket.on('disconnect', () => {
    console.log('❌ Отключился:', socket.id);
  });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`🚀 Сервер WebRTC крутится на порту ${PORT}`);
});