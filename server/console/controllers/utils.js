const os = require('os')
const User = require('../models/mongo.users')
const Course = require('../models/mongo.courses')

module.exports.getStatusInfo = async (req, res) => {
    let courses = []
    let users = []

    if (global.appState.db.status === 'connected') {
        courses = await Course.find({})
        users = await User.find({})
    }
    
    res.status(200).json({
        status: global.appState.server.status,
        uptime: os.uptime(),
        launchTime: global.launchTime,
        courses: courses.length,
        users: users.length,
        db_status: global.appState.db.status
    })
}