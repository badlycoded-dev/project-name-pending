const mongo = require('mongoose');
const config = require('../config/config');

module.exports.use = function () {
    console.log('DB_Module> LAUNCHING');
    this.open();

    mongo.connection.on('connected', () => {
        console.log('DB_Module> STATUS: [CONNECTED]');
    });

    mongo.connection.on('open', () => {
        console.log('DB_Module> STATUS: [READY]');
        global.appState.db.status = 'connected';
    });

    mongo.connection.on('disconnected', () => {
        if (config.DO_RECONNECT) {
            console.log('DB_Module> STATUS: [DISCONNECTED] — attempting reconnect...');
            global.appState.db.status = 'reconnecting';
            this.open();
        } else {
            console.log('DB_Module> STATUS: [DISCONNECTED]');
        }
    });

    mongo.connection.on('close', () => {
        if (!config.DO_RECONNECT) {
            console.log('DB_Module> STATUS: [DROPPED]');
            global.appState.db.status = 'disconnected';
        }
    });
};

module.exports.open = function (url = config.DB_URL, options = { dbName: config.DB_NAME }) {
    mongo.connect(url, options).catch((err) => {
        console.error('DB_Module> Connection error:', err.message);
    });
};

module.exports.close = function () {
    mongo.connection.close();
};