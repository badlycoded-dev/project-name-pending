/**
 * RTC server patch — add to your socket.io 'chat-message' handler.
 *
 * In your RTC server (wherever you handle socket events), require the model:
 *
 *   const MeetingMessage = require('./models/mongo.messages');
 *
 * Then in the 'join' handler, extract sessionId from the join payload:
 *
 *   socket.on('join', async ({ roomId, nickname, sessionId }) => {
 *       socket.data.sessionId    = sessionId || roomId;
 *       socket.data.roomId       = roomId;
 *       socket.data.nickname     = nickname;
 *       ...
 *       // Send chat history on join
 *       const history = await MeetingMessage.find({ sessionId: sessionId || roomId })
 *           .sort({ ts: 1 }).limit(200).lean();
 *       socket.emit('joined', { peers: ..., iceServers: ..., chatHistory: history });
 *   });
 *
 * And in the 'chat-message' handler, persist before broadcasting:
 *
 *   socket.on('chat-message', async ({ roomId, text, to }) => {
 *       const msg = {
 *           id:           require('crypto').randomUUID(),
 *           from:         socket.id,
 *           fromNickname: socket.data.nickname,
 *           to:           to || null,
 *           text,
 *           ts:           new Date(),
 *       };
 *       // Persist to P(m)_01
 *       await MeetingMessage.create({
 *           sessionId:    socket.data.sessionId,
 *           roomId:       socket.data.roomId,
 *           ...msg,
 *       });
 *       // Broadcast
 *       if (to) {
 *           socket.to(to).emit('chat-message', msg);
 *           socket.emit('chat-message', msg);
 *       } else {
 *           io.to(roomId).emit('chat-message', msg);
 *       }
 *   });
 */
