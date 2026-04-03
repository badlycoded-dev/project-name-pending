const fs   = require('fs')
const path = require('path')

const API_DIR = path.join(__dirname, '../api')

const store = [
    {
        config:   '../config/config.mongo',
        path:     '../api/mongo',
        fullPath: path.join(API_DIR, 'mongo.js')
    }
]

function loadAPI() {
    try {
        fs.readdirSync(API_DIR).forEach(file => {
            if (!file.endsWith('.js')) return
            const fullPath = path.join(API_DIR, file)
            if (store.some(item => item.fullPath === fullPath)) {
                console.log(`DB_Handler> Already loaded: ${file}`)
            } else {
                store.push({ fullPath, path: `../api/${path.basename(file, '.js')}` })
                console.log(`DB_Handler> Loaded: ${file}`)
            }
        })
    } catch (err) {
        console.error('DB_Handler> Error loading API files:', err)
    }
    return store
}

function useAPI(index = 0) {
    const entry = store[index]
    if (!entry?.path) {
        console.error(`DB_Handler> No entry at index ${index}`)
        return null
    }
    try {
        const mod = require(entry.path)
        global.appState.API.name   = path.basename(entry.path)
        global.appState.API.config = entry.config || ''
        global.appState.API.module = mod
        return mod
    } catch (err) {
        console.error(`DB_Handler> Error importing module at index ${index}:`, err)
        return null
    }
}

module.exports = {
    loadAPI,
    useAPI,
    getAPI:    (i) => store[i] || null,
    getAllAPI:  ()  => store
}