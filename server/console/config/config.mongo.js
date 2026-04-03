require('dotenv').config();

module.exports = {
    MODULE_NAME: 'mongoose',
    DB: 'mongo',
    // DB_URL: process.env.MONGODB_URI || process.env.DB_URL || 'mongodb://localhost:27017'
    DB_URL: 'mongodb+srv://mishanja:qwerty123@cluster0.oewbabf.mongodb.net/?appName=Cluster0'
};