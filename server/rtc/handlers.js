const rooms  = require('./rooms')
const config = require('./config')

/**
 * All WebRTC signaling events handled here.
 *
 * Client → Server events:
 *   join          { roomId, nickname }          — join a room
 *   leave         { roomId }                    — explicit leave
 *   offer         { to, sdp }                   — forward SDP offer to peer
 *   answer        { to, sdp }                   — forward SDP answer to peer
 *   ice-candidate { to, candidate }             — forward ICE candidate to peer
 *   toggle-media  { roomId, video, audio }      — broadcast media state change
 *
 * Server → Client events:
 *   joined        { roomId, peers, iceServers } — confirmation + existing peers
 *   peer-joined   { peer }                      — a new peer entered the room
 *   peer-left     { socketId }                  — a peer disconnected
 *   offer         { from, sdp }                 — incoming offer
 *   answer        { from, sdp }                 — incoming answer
 *   ice-candidate { from, candidate }           — incoming ICE candidate
 *   media-state   { socketId, video, audio }    — peer toggled media
 *   error         { message }                   — error feedback
 */

module.exports = function registerHandlers(io) {
    io.on('connection', (socket) => {
        const { userId, email } = socket.data.user

        socket.on('join', ({ roomId, nickname, video = false, audio = false }) => {
            if (!roomId) { socket.emit('error', { message: 'roomId is required' }); return }
            const peerInfo = { userId, nickname: nickname || email, socketId: socket.id, video, audio, screen: false, handRaised: false }
            const existingPeers = rooms.getPeers(roomId)
            const chatHistory   = rooms.getChatHistory(roomId)
            rooms.addPeer(roomId, socket.id, peerInfo)
            socket.join(roomId)
            socket.emit('joined', { roomId, peers: existingPeers, iceServers: config.ICE_SERVERS, chatHistory })
            socket.to(roomId).emit('peer-joined', { peer: peerInfo })
            console.log(`[join] ${nickname || email} → room ${roomId} (${existingPeers.length + 1} peers)`)
        })

        socket.on('leave', ({ roomId }) => { _leaveRoom(socket, roomId) })

        socket.on('offer',         ({ to, sdp })       => { if (to && sdp)       io.to(to).emit('offer',         { from: socket.id, sdp }) })
        socket.on('answer',        ({ to, sdp })       => { if (to && sdp)       io.to(to).emit('answer',        { from: socket.id, sdp }) })
        socket.on('ice-candidate', ({ to, candidate }) => { if (to && candidate) io.to(to).emit('ice-candidate', { from: socket.id, candidate }) })

        socket.on('toggle-media', ({ roomId, video, audio }) => {
            rooms.updatePeer(socket.id, { video, audio })
            socket.to(roomId).emit('media-state', { socketId: socket.id, video, audio })
        })

        socket.on('screen-share', ({ roomId, active }) => {
            rooms.updatePeer(socket.id, { screen: active })
            socket.to(roomId).emit('screen-state', { socketId: socket.id, active })
        })

        socket.on('chat-message', ({ roomId, text, to }) => {
            if (!text?.trim()) return
            const peer = rooms.getPeerBySocket(socket.id, roomId)
            const msg  = { id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`, from: socket.id, fromNickname: peer?.nickname || email, to: to || null, text: text.trim(), ts: new Date().toISOString() }
            rooms.addChatMessage(roomId, msg)
            if (to) { io.to(to).emit('chat-message', msg); socket.emit('chat-message', msg) }
            else    { io.to(roomId).emit('chat-message', msg) }
        })

        socket.on('raise-hand', ({ roomId, raised }) => {
            rooms.updatePeer(socket.id, { handRaised: raised })
            io.to(roomId).emit('hand-raised', { socketId: socket.id, raised })
        })

        socket.on('disconnecting', () => {
            for (const roomId of socket.rooms) { if (roomId !== socket.id) _leaveRoom(socket, roomId) }
        })
        socket.on('disconnect', () => { rooms.removePeer(socket.id) })
    })

    function _leaveRoom(socket, roomId) {
        socket.leave(roomId)
        rooms.removePeer(socket.id)
        socket.to(roomId).emit('peer-left', { socketId: socket.id })
        console.log(`[leave] ${socket.data.user.email} ← room ${roomId}`)
    }
}