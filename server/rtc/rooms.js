/**
 * In-memory room registry.
 *
 * Room ID convention:  session:<sessionId>   — tied to a ManageSession session
 *                      or any arbitrary string for ad-hoc rooms
 *
 * Room shape:
 * {
 *   id:        string,
 *   peers:     Map<socketId, { userId, nickname, socketId, joinedAt }>
 *   createdAt: Date
 * }
 */

const rooms = new Map()
const CHAT_HISTORY_LIMIT = 200

function getOrCreate(roomId) {
    if (!rooms.has(roomId)) {
        rooms.set(roomId, { id: roomId, peers: new Map(), chat: [], createdAt: new Date() })
    }
    return rooms.get(roomId)
}

function get(roomId)    { return rooms.get(roomId) || null }

function addPeer(roomId, socketId, peerInfo) {
    const room = getOrCreate(roomId)
    room.peers.set(socketId, { ...peerInfo, socketId, joinedAt: new Date() })
    return room
}

function updatePeer(socketId, patch) {
    for (const room of rooms.values()) {
        if (room.peers.has(socketId)) {
            const p = room.peers.get(socketId)
            room.peers.set(socketId, { ...p, ...patch })
            return
        }
    }
}

function removePeer(socketId) {
    for (const [roomId, room] of rooms) {
        if (room.peers.has(socketId)) {
            room.peers.delete(socketId)
            if (room.peers.size === 0) rooms.delete(roomId)
        }
    }
}

function getPeers(roomId) {
    const room = rooms.get(roomId)
    return room ? Array.from(room.peers.values()) : []
}

function getPeerBySocket(socketId, roomId) {
    return rooms.get(roomId)?.peers.get(socketId) || null
}

function addChatMessage(roomId, msg) {
    const room = getOrCreate(roomId)
    room.chat.push(msg)
    if (room.chat.length > CHAT_HISTORY_LIMIT) room.chat.shift()
}

function getChatHistory(roomId) {
    return rooms.get(roomId)?.chat || []
}

function listAll() {
    return Array.from(rooms.entries()).map(([id, room]) => ({ id, peerCount: room.peers.size, createdAt: room.createdAt }))
}

module.exports = { getOrCreate, get, addPeer, updatePeer, removePeer, getPeers, getPeerBySocket, addChatMessage, getChatHistory, listAll }