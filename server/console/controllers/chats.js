const Chat = require('../models/mongo.chats');
const ChatMessage = require('../models/mongo.chats.messages');
const User = require('../models/mongo.users');
const errorHandler = require('../utils/errorHandler');
const utils = require('../utils/utils');

async function getRequester(req) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return null;
    return utils.parseToken(token);
}

// GET /api/chats — list all chats for current user
module.exports.getAll = async (req, res) => {
    try {
        const me = await getRequester(req);
        if (!me) return errorHandler(res, 401, 'Unauthorized');

        const chats = await Chat.find({ participants: me._id })
            .populate('participants', 'nickname firstName lastName links')
            .sort({ lastActivity: -1 });

        // Attach unread count per chat
        const result = await Promise.all(chats.map(async (chat) => {
            const unread = await ChatMessage.countDocuments({
                chatId: chat._id,
                sender: { $ne: me._id },
                readBy: { $nin: [me._id] }
            });
            const obj = chat.toObject();
            obj.unread = unread;
            return obj;
        }));

        res.json({ data: result });
    } catch (e) {
        errorHandler(res, 500, e);
    }
};

// GET /api/chats/:id — get single chat (must be participant)
module.exports.getById = async (req, res) => {
    try {
        const me = await getRequester(req);
        if (!me) return errorHandler(res, 401, 'Unauthorized');

        const chat = await Chat.findOne({ _id: req.params.id, participants: me._id })
            .populate('participants', 'nickname firstName lastName links');
        if (!chat) return errorHandler(res, 404, 'Chat not found');

        res.json({ data: chat });
    } catch (e) {
        errorHandler(res, 500, e);
    }
};

// POST /api/chats — create or return existing chat with another user
module.exports.create = async (req, res) => {
    try {
        const me = await getRequester(req);
        if (!me) return errorHandler(res, 401, 'Unauthorized');

        const { userId } = req.body;
        if (!userId) return errorHandler(res, 400, 'userId is required');
        if (userId === me._id.toString()) return errorHandler(res, 400, 'Cannot chat with yourself');

        const other = await User.findById(userId);
        if (!other) return errorHandler(res, 404, 'User not found');

        const existing = await Chat.findOne({
            participants: { $all: [me._id, other._id], $size: 2 }
        }).populate('participants', 'nickname firstName lastName links');

        if (existing) return res.json({ data: existing });

        const chat = await new Chat({ participants: [me._id, other._id] }).save();
        const populated = await Chat.findById(chat._id)
            .populate('participants', 'nickname firstName lastName links');

        res.status(201).json({ data: populated });
    } catch (e) {
        errorHandler(res, 500, e);
    }
};

// DELETE /api/chats/:id — delete chat and all messages
module.exports.remove = async (req, res) => {
    try {
        const me = await getRequester(req);
        if (!me) return errorHandler(res, 401, 'Unauthorized');

        const chat = await Chat.findOne({ _id: req.params.id, participants: me._id });
        if (!chat) return errorHandler(res, 404, 'Chat not found');

        await ChatMessage.deleteMany({ chatId: chat._id });
        await chat.deleteOne();

        res.json({ message: 'Chat deleted' });
    } catch (e) {
        errorHandler(res, 500, e);
    }
};

// GET /api/chats/:id/messages
module.exports.getMessages = async (req, res) => {
    try {
        const me = await getRequester(req);
        if (!me) return errorHandler(res, 401, 'Unauthorized');

        const chat = await Chat.findOne({ _id: req.params.id, participants: me._id });
        if (!chat) return errorHandler(res, 404, 'Chat not found');

        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        const before = req.query.before;

        const query = { chatId: chat._id };
        if (before) query.createdAt = { $lt: new Date(before) };

        const messages = await ChatMessage.find(query)
            .populate('sender', 'nickname firstName lastName links')
            .sort({ createdAt: -1 })
            .limit(limit);

        // Mark as read
        await ChatMessage.updateMany(
            { chatId: chat._id, sender: { $ne: me._id }, readBy: { $nin: [me._id] } },
            { $addToSet: { readBy: me._id } }
        );

        res.json({ data: messages.reverse() });
    } catch (e) {
        errorHandler(res, 500, e);
    }
};

// POST /api/chats/:id/messages
module.exports.sendMessage = async (req, res) => {
    try {
        const me = await getRequester(req);
        if (!me) return errorHandler(res, 401, 'Unauthorized');

        const chat = await Chat.findOne({ _id: req.params.id, participants: me._id });
        if (!chat) return errorHandler(res, 404, 'Chat not found');

        const { text } = req.body;
        if (!text?.trim()) return errorHandler(res, 400, 'Message text is required');

        const msg = await new ChatMessage({
            chatId: chat._id,
            sender: me._id,
            text: text.trim(),
            readBy: [me._id]
        }).save();

        // Store inline snapshot on the chat — no cross-model populate needed
        const senderUser = await User.findById(me._id).select('nickname');
        chat.lastMessage = {
            _id: msg._id,
            text: msg.text,
            senderNickname: senderUser?.nickname || '',
            senderId: me._id,
            createdAt: msg.createdAt
        };
        chat.lastActivity = new Date();
        await chat.save();

        const populated = await ChatMessage.findById(msg._id)
            .populate('sender', 'nickname firstName lastName links');

        res.status(201).json({ data: populated });
    } catch (e) {
        errorHandler(res, 500, e);
    }
};

// DELETE /api/chats/:id/messages/:msgId
module.exports.deleteMessage = async (req, res) => {
    try {
        const me = await getRequester(req);
        if (!me) return errorHandler(res, 401, 'Unauthorized');

        const chat = await Chat.findOne({ _id: req.params.id, participants: me._id });
        if (!chat) return errorHandler(res, 404, 'Chat not found');

        const msg = await ChatMessage.findOne({ _id: req.params.msgId, chatId: chat._id });
        if (!msg) return errorHandler(res, 404, 'Message not found');
        if (msg.sender.toString() !== me._id.toString()) return errorHandler(res, 403, 'Cannot delete another user\'s message');

        await msg.deleteOne();

        // Update inline snapshot if this was the last message
        if (chat.lastMessage?._id?.toString() === msg._id.toString()) {
            const prev = await ChatMessage.findOne({ chatId: chat._id })
                .populate('sender', 'nickname')
                .sort({ createdAt: -1 });
            if (prev) {
                chat.lastMessage = {
                    _id: prev._id,
                    text: prev.text,
                    senderNickname: prev.sender?.nickname || '',
                    senderId: prev.sender?._id,
                    createdAt: prev.createdAt
                };
            } else {
                chat.lastMessage = { _id: null, text: null, senderNickname: null, senderId: null, createdAt: null };
            }
            await chat.save();
        }

        res.json({ message: 'Message deleted' });
    } catch (e) {
        errorHandler(res, 500, e);
    }
};