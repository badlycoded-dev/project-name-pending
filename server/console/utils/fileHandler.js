const fs     = require('fs')
const path   = require('path')
const multer = require('multer')

const STORAGE_ROOT = path.join(__dirname, '../../storage/data')

const ALLOWED_TYPES = {
    images:    ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    documents: [
        'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/json', 'text/plain'
    ],
    videos:   ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-mpeg'],
    audio:    ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac',
               'audio/flac', 'audio/x-m4a', 'audio/webm'],
    archives: ['application/zip', 'application/x-zip-compressed',
               'application/x-rar-compressed', 'application/x-7z-compressed']
}

function getFileType(s) {
    s = s.toLowerCase()
    if (['.jpg','.jpeg','.png','.gif','.webp'].some(e => s.endsWith(e)) || s.startsWith('image/'))   return 'image'
    if (['.mp4','.webm','.mov','.avi'].some(e => s.endsWith(e))         || s.startsWith('video/'))   return 'video'
    if (['.mp3','.wav','.aac','.flac','.m4a'].some(e => s.endsWith(e)) || s.startsWith('audio/'))   return 'audio'
    if (['.pdf','.doc','.docx','.xls','.xlsx','.ppt','.pptx','.txt','.json'].some(e => s.endsWith(e))
        || s.startsWith('application/') || s.startsWith('text/'))                                     return 'document'
    if (['.zip','.rar','.7z'].some(e => s.endsWith(e)))                                              return 'archive'
    return 'other'
}

class EntityFileHandler {
    constructor(entityName, config) {
        this.entityName    = entityName
        this.basePath      = config.basePath
        this.maxFileSize   = config.maxFileSize   ?? 10 * 1024 * 1024
        this.allowedTypes  = config.allowedTypes  ?? [...ALLOWED_TYPES.images, ...ALLOWED_TYPES.documents]
        this.serveBasePath = config.serveBasePath ?? `/api/files/${entityName}`

        fs.mkdirSync(this.basePath, { recursive: true })
        this._multer = this._buildMulter()
    }

    _buildMulter() {
        const storage = multer.diskStorage({
            destination: (req, _file, cb) => {
                const id  = req.params.id
                const sub = req.query.subdir ?? ''
                if (!id) return cb(new Error('ID parameter is required for disk uploads'))
                const dir = path.join(this.basePath, id, sub)
                fs.mkdirSync(dir, { recursive: true })
                cb(null, dir)
            },
            filename: (req, file, cb) => {
                const ext   = path.extname(file.originalname)
                const stem  = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_\-.]/g, '_')
                const alias = req.query.rename
                cb(null, alias ? `${alias}${ext}` : `${stem}_${Date.now()}${ext}`)
            }
        })

        const fileFilter = (_req, file, cb) => {
            this.allowedTypes.includes(file.mimetype)
                ? cb(null, true)
                : cb(new Error(`File type "${file.mimetype}" not allowed for "${this.entityName}"`))
        }

        return multer({ storage, limits: { fileSize: this.maxFileSize }, fileFilter })
    }

    single(field = 'file')           { return this._multer.single(field) }
    array(field = 'files', max = 20) { return this._multer.array(field, max) }
    fields(fieldsArray)              { return this._multer.fields(fieldsArray) }
    any()                            { return this._multer.any() }

    anyMemory(maxFileSizeMb) {
        const limit      = (maxFileSizeMb ?? this.maxFileSize / (1024 * 1024)) * 1024 * 1024
        const fileFilter = (_req, file, cb) => {
            this.allowedTypes.includes(file.mimetype)
                ? cb(null, true)
                : cb(new Error(`File type "${file.mimetype}" not allowed for "${this.entityName}"`))
        }
        return multer({ storage: multer.memoryStorage(), limits: { fileSize: limit }, fileFilter }).any()
    }

    handleError(err, _req, res, next) {
        if (err instanceof multer.MulterError) {
            const msg = err.code === 'LIMIT_FILE_SIZE'  ? 'File too large'
                      : err.code === 'LIMIT_FILE_COUNT' ? 'Too many files'
                      : `Upload error: ${err.message}`
            return res.status(400).json({ message: msg })
        }
        if (err) return res.status(400).json({ message: err.message ?? 'Upload error' })
        next()
    }

    entityDir(id, sub = '') {
        return sub ? path.join(this.basePath, id, sub) : path.join(this.basePath, id)
    }

    ensureDir(id, sub = '') {
        const dir = this.entityDir(id, sub)
        fs.mkdirSync(dir, { recursive: true })
        return dir
    }

    listFiles(id, sub = '') {
        const dir = this.entityDir(id, sub)
        if (!fs.existsSync(dir)) return []
        return fs.readdirSync(dir)
            .filter(f => fs.statSync(path.join(dir, f)).isFile())
            .map(filename => {
                const stats = fs.statSync(path.join(dir, filename))
                const url   = sub
                    ? `${this.serveBasePath}/${id}/${sub}/${filename}`
                    : `${this.serveBasePath}/${id}/${filename}`
                return { filename, originalName: filename, url, size: stats.size, created: stats.birthtime, modified: stats.mtime, type: getFileType(filename) }
            })
    }

    getFilePath(id, filename, sub = '') {
        const p = path.join(this.entityDir(id, sub), filename)
        return fs.existsSync(p) ? p : null
    }

    deleteFile(id, filename, sub = '') {
        const p = this.getFilePath(id, filename, sub)
        if (!p) return false
        try { fs.unlinkSync(p); return true }
        catch (e) { console.error(`[${this.entityName}] deleteFile:`, e); return false }
    }

    deleteAllFiles(id) {
        const dir = this.entityDir(id)
        if (!fs.existsSync(dir)) return false
        try { fs.rmSync(dir, { recursive: true, force: true }); return true }
        catch (e) { console.error(`[${this.entityName}] deleteAllFiles:`, e); return false }
    }

    renameFile(id, uploadedFilename, newBaseName, sub = '') {
        try {
            const dir = this.entityDir(id, sub)
            const src = path.join(dir, uploadedFilename)
            if (!fs.existsSync(src)) return null
            const ext = path.extname(uploadedFilename)
            const dst = path.join(dir, `${newBaseName}${ext}`)
            if (fs.existsSync(dst)) fs.unlinkSync(dst)
            fs.renameSync(src, dst)
            const url = sub
                ? `${this.serveBasePath}/${id}/${sub}/${newBaseName}${ext}`
                : `${this.serveBasePath}/${id}/${newBaseName}${ext}`
            return { filename: `${newBaseName}${ext}`, url }
        } catch (e) {
            console.error(`[${this.entityName}] renameFile:`, e)
            return null
        }
    }

    sendFileHandler() {
        return (req, res) => {
            const { id, filename, subdir = '' } = req.params
            const filePath = this.getFilePath(id, filename, subdir)
            if (!filePath) return res.status(404).json({ message: 'File not found' })
            const disposition = req.query.download === 'true' ? 'attachment' : 'inline'
            res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`)
            res.setHeader('Cache-Control', 'private, max-age=3600')
            res.sendFile(filePath)
        }
    }

    listFilesHandler() {
        return (req, res) => {
            const sub   = req.query.subdir ?? ''
            const files = this.listFiles(req.params.id, sub)
            res.json({ entityId: req.params.id, count: files.length, files })
        }
    }

    buildFileLink(id, filename, sub = '', meta = {}) {
        const url = sub
            ? `${this.serveBasePath}/${id}/${sub}/${filename}`
            : `${this.serveBasePath}/${id}/${filename}`
        return { type: getFileType(filename), url, filename, accessLevel: 'default', ...meta }
    }

    buildLinksFromUploaded(id, multerFiles, sub = '', meta = {}) {
        return (multerFiles ?? []).map(f =>
            this.buildFileLink(id, f.filename, sub, { originalName: f.originalname, size: f.size, mimeType: f.mimetype, ...meta })
        )
    }
}

class FileHandlerRegistry {
    constructor() { this._map = new Map() }

    register(name, config) {
        if (this._map.has(name)) console.warn(`[FileHandlerRegistry] Overwriting handler for '${name}'`)
        this._map.set(name, new EntityFileHandler(name, config))
        return this
    }

    get(name) {
        if (!this._map.has(name)) throw new Error(`No file handler registered for entity '${name}'`)
        return this._map.get(name)
    }

    getOrCreate(name, overrideConfig = {}) {
        if (!this._map.has(name)) {
            const slug = name.replace(/[^a-zA-Z0-9_-]/g, '_')
            this.register(name, {
                basePath:      path.join(STORAGE_ROOT, 'forms', slug),
                maxFileSize:   10 * 1024 * 1024,
                allowedTypes:  [...ALLOWED_TYPES.images, ...ALLOWED_TYPES.documents, ...ALLOWED_TYPES.archives],
                serveBasePath: `/api/files/${name}`,
                ...overrideConfig
            })
        }
        return this._map.get(name)
    }

    has(name) { return this._map.has(name) }
    list()    { return [...this._map.keys()] }
}

const registry = new FileHandlerRegistry()
    .register('users', {
        basePath:      path.join(STORAGE_ROOT, 'u'),
        maxFileSize:   5 * 1024 * 1024,
        allowedTypes:  ALLOWED_TYPES.images,
        serveBasePath: '/api/files/users'
    })
    .register('courses', {
        basePath:     path.join(STORAGE_ROOT, 'c'),
        maxFileSize:  512 * 1024 * 1024,
        allowedTypes: [...ALLOWED_TYPES.images, ...ALLOWED_TYPES.documents, ...ALLOWED_TYPES.videos, ...ALLOWED_TYPES.audio, ...ALLOWED_TYPES.archives],
        serveBasePath: '/api/files/courses'
    })

module.exports = {
    registry,
    EntityFileHandler,
    FileHandlerRegistry,
    ALLOWED_TYPES,
    getFileType,

    // Multer middleware shortcuts
    uploadProfilePicture: registry.get('users').single('profilePicture'),
    uploadCourseFile:     registry.get('courses').single('file'),
    uploadCourseFiles:    registry.get('courses').array('files', 10),
    handleUploadError:    (err, req, res, next) => registry.get('courses').handleError(err, req, res, next),

    // User helpers
    deleteUserProfilePicture(userId) {
        const h = registry.get('users')
        h.listFiles(userId).forEach(f => h.deleteFile(userId, f.filename))
    },
    deleteUserDirectory:  (userId) => registry.get('users').deleteAllFiles(userId),
    buildProfilePictureLink(userId) {
        const h = registry.get('users')
        const f = h.listFiles(userId).find(f => f.filename.startsWith('profile_main'))
        return f ? h.buildFileLink(userId, f.filename, '', { description: 'Profile picture' }) : null
    },
    renameProfilePicture: (userId, uploaded) => registry.get('users').renameFile(userId, uploaded, 'profile_main'),
    sendUserProfilePicture: registry.get('users').sendFileHandler(),

    // Course helpers
    deleteCourseFile:     (courseId, filename) => registry.get('courses').deleteFile(courseId, filename),
    deleteCourseDirectory:(courseId)           => registry.get('courses').deleteAllFiles(courseId),
    sendCourseFile:       registry.get('courses').sendFileHandler(),
    listCourseFiles:      registry.get('courses').listFilesHandler(),
    buildThumbnailLink(courseId) {
        const h = registry.get('courses')
        const f = h.listFiles(courseId).find(f => f.filename.startsWith('thumbnail'))
        return f ? h.buildFileLink(courseId, f.filename, '', { description: 'Course thumbnail' }) : null
    },
    renameThumbnail: (courseId, uploaded) => registry.get('courses').renameFile(courseId, uploaded, 'thumbnail'),
    getFileType,

    // Private copy helpers
    copyCourseTutor(originalCourseId, tutorId) {
        const src = path.join(STORAGE_ROOT, 'c', originalCourseId)
        const dst = path.join(STORAGE_ROOT, 'u', tutorId, 'p-c', originalCourseId)
        fs.mkdirSync(dst, { recursive: true })
        if (!fs.existsSync(src)) return { copied: 0 }
        const files = fs.readdirSync(src)
        files.forEach(f => fs.copyFileSync(path.join(src, f), path.join(dst, f)))
        return { copied: files.length }
    },

    // Submission helpers
    buildSubmissionPath(studentId, groupId, courseId, assignmentNumber, nickname) {
        const safeNick = nickname.replace(/[^a-zA-Z0-9_-]/g, '_')
        const filename = `${assignmentNumber}_${safeNick}-${studentId}.zip`
        const dir      = path.join(STORAGE_ROOT, 'u', studentId, 'g', groupId, courseId)
        fs.mkdirSync(dir, { recursive: true })
        return { dir, filename, fullPath: path.join(dir, filename) }
    },

    paths: {
        userProfiles:  path.join(STORAGE_ROOT, 'u'),
        courseFiles:   path.join(STORAGE_ROOT, 'c'),
        privateCopies: path.join(STORAGE_ROOT, 'u'),
        submissions:   path.join(STORAGE_ROOT, 'u')
    }
}