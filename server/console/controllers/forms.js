const path          = require('path')
const fs            = require('fs')
const FormSubmission = require('../models/mongo.forms')
const { registry }  = require('../utils/fileHandler')

const skillSubdir = (i) => `skill-${i}`
const getHandler  = (formType) => registry.getOrCreate(`forms/${formType}`)

function writeBufferFile(buffer, originalname, mimetype, size, destDir, urlBase) {
    const ext      = path.extname(originalname)
    const stem     = path.basename(originalname, ext).replace(/[^a-zA-Z0-9_\-.]/g, '_')
    const filename = `${stem}_${Date.now()}${ext}`
    fs.mkdirSync(destDir, { recursive: true })
    fs.writeFileSync(path.join(destDir, filename), buffer)
    return { filename, originalName: originalname, url: `${urlBase}/${filename}`, mimeType: mimetype, size }
}

const ALLOWED_STATUSES = ['pending', 'under-review', 'approved', 'rejected']

exports.submitApplication = async (req, res) => {
    try {
        const { formType } = req.params
        if (!formType) return res.status(400).json({ message: 'formType is required' })

        let submissionData = {}
        let skills = []
        try { submissionData = JSON.parse(req.body.data || '{}') } catch { return res.status(400).json({ message: 'Invalid data JSON' }) }
        try { skills = JSON.parse(req.body.skills || '[]') } catch { return res.status(400).json({ message: 'Invalid skills JSON' }) }

        const submission = await FormSubmission.create({
            formType,
            userId: req.user?._id ?? null,
            data:   submissionData,
            skills,
            status: 'pending'
        })

        const handler  = getHandler(formType)
        const byField  = (req.files ?? []).reduce((acc, f) => {
            acc[f.fieldname] = acc[f.fieldname] ?? []
            acc[f.fieldname].push(f)
            return acc
        }, {})

        submission.skills = skills.map((skill, i) => {
            const subdir  = skillSubdir(i)
            const destDir = handler.ensureDir(submission._id.toString(), subdir)
            const urlBase = `${handler.serveBasePath}/${submission._id}/${subdir}`
            const certs   = (byField[`cert_${i}`] ?? []).map(f => writeBufferFile(f.buffer, f.originalname, f.mimetype, f.size, destDir, urlBase))
            const fileEx  = (byField[`example_${i}`] ?? []).map(f => ({ kind: 'file', name: f.originalname, ...writeBufferFile(f.buffer, f.originalname, f.mimetype, f.size, destDir, urlBase) }))
            const linkEx  = (skill.examples ?? []).filter(e => e.kind === 'link')
            return { ...skill, certificates: certs, examples: [...fileEx, ...linkEx] }
        })
        await submission.save()

        res.status(201).json({ message: 'Submission received', data: { _id: submission._id, status: submission.status } })
    } catch (err) {
        console.error('[Forms] submitApplication:', err)
        res.status(500).json({ message: 'Internal server error' })
    }
}

exports.getAll = async (req, res) => {
    try {
        const { formType } = req.params
        const { status, search } = req.query
        const filter = { formType }
        if (status) filter.status = status
        if (search) {
            const rx = new RegExp(search.trim(), 'i')
            filter.$or = ['firstName','lastName','name','email','subject','description','about']
                .map(f => ({ [`data.${f}`]: rx }))
        }
        const data = await FormSubmission.find(filter).sort({ createdAt: -1 }).lean()
        res.json({ count: data.length, data })
    } catch (err) {
        console.error('[Forms] getAll:', err)
        res.status(500).json({ message: 'Internal server error' })
    }
}

exports.getAllAny = async (req, res) => {
    try {
        const { formType, status, search } = req.query
        const filter = {}
        if (formType) filter.formType = formType
        if (status)   filter.status   = status
        if (search) {
            const rx = new RegExp(search.trim(), 'i')
            filter.$or = ['firstName','lastName','name','email','subject','description','about']
                .map(f => ({ [`data.${f}`]: rx }))
        }
        const data = await FormSubmission.find(filter).sort({ createdAt: -1 }).lean()
        res.json({ count: data.length, data })
    } catch (err) {
        console.error('[Forms] getAllAny:', err)
        res.status(500).json({ message: 'Internal server error' })
    }
}

exports.getOne = async (req, res) => {
    try {
        const sub = await FormSubmission.findOne({ _id: req.params.id, formType: req.params.formType }).lean()
        if (!sub) return res.status(404).json({ message: 'Submission not found' })
        res.json({ data: sub })
    } catch (err) {
        console.error('[Forms] getOne:', err)
        res.status(500).json({ message: 'Internal server error' })
    }
}

exports.getOneById = async (req, res) => {
    try {
        const sub = await FormSubmission.findById(req.params.id).lean()
        if (!sub) return res.status(404).json({ message: 'Submission not found' })
        res.json({ data: sub })
    } catch (err) {
        console.error('[Forms] getOneById:', err)
        res.status(500).json({ message: 'Internal server error' })
    }
}

function buildStatusUpdate(req) {
    const { status, reviewNote } = req.body
    if (status && !ALLOWED_STATUSES.includes(status)) return null
    const update = {}
    if (status) { update.status = status; update.reviewedAt = new Date(); update.reviewedBy = req.user?._id }
    if (reviewNote !== undefined) update.reviewNote = reviewNote
    return update
}

exports.updateStatus = async (req, res) => {
    try {
        const update = buildStatusUpdate(req)
        if (!update) return res.status(400).json({ message: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}` })
        const sub = await FormSubmission.findOneAndUpdate(
            { _id: req.params.id, formType: req.params.formType },
            { $set: update }, { new: true, runValidators: true }
        )
        if (!sub) return res.status(404).json({ message: 'Submission not found' })
        res.json({ message: 'Submission updated', data: sub })
    } catch (err) {
        console.error('[Forms] updateStatus:', err)
        res.status(500).json({ message: 'Internal server error' })
    }
}

exports.updateStatusById = async (req, res) => {
    try {
        const update = buildStatusUpdate(req)
        if (!update) return res.status(400).json({ message: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}` })
        const sub = await FormSubmission.findByIdAndUpdate(req.params.id, { $set: update }, { new: true, runValidators: true })
        if (!sub) return res.status(404).json({ message: 'Submission not found' })
        res.json({ message: 'Submission updated', data: sub })
    } catch (err) {
        console.error('[Forms] updateStatusById:', err)
        res.status(500).json({ message: 'Internal server error' })
    }
}

exports.deleteSubmission = async (req, res) => {
    try {
        const sub = await FormSubmission.findOneAndDelete({ _id: req.params.id, formType: req.params.formType })
        if (!sub) return res.status(404).json({ message: 'Submission not found' })
        getHandler(req.params.formType).deleteAllFiles(req.params.id)
        res.json({ message: 'Submission deleted' })
    } catch (err) {
        console.error('[Forms] deleteSubmission:', err)
        res.status(500).json({ message: 'Internal server error' })
    }
}

exports.deleteSubmissionById = async (req, res) => {
    try {
        const sub = await FormSubmission.findByIdAndDelete(req.params.id)
        if (!sub) return res.status(404).json({ message: 'Submission not found' })
        getHandler(sub.formType).deleteAllFiles(req.params.id)
        res.json({ message: 'Submission deleted' })
    } catch (err) {
        console.error('[Forms] deleteSubmissionById:', err)
        res.status(500).json({ message: 'Internal server error' })
    }
}

exports.listFiles = async (req, res) => {
    try {
        const sub = await FormSubmission.findOne({ _id: req.params.id, formType: req.params.formType }).lean()
        if (!sub) return res.status(404).json({ message: 'Submission not found' })
        const handler = getHandler(req.params.formType)
        const data = (sub.skills ?? []).map((skill, i) => ({ skillIndex: i, subject: skill.subject, files: handler.listFiles(req.params.id, skillSubdir(i)) }))
        res.json({ data })
    } catch (err) {
        console.error('[Forms] listFiles:', err)
        res.status(500).json({ message: 'Internal server error' })
    }
}

exports.listFilesById = async (req, res) => {
    try {
        const sub = await FormSubmission.findById(req.params.id).lean()
        if (!sub) return res.status(404).json({ message: 'Submission not found' })
        const handler = getHandler(sub.formType)
        const data = (sub.skills ?? []).map((skill, i) => ({ skillIndex: i, subject: skill.subject, files: handler.listFiles(req.params.id, skillSubdir(i)) }))
        res.json({ data })
    } catch (err) {
        console.error('[Forms] listFilesById:', err)
        res.status(500).json({ message: 'Internal server error' })
    }
}

function removeFileFromSkill(sub, skillIndex, filename) {
    const skill = sub.skills?.[skillIndex]
    if (!skill) return
    skill.certificates = skill.certificates.filter(c => c.filename !== filename)
    skill.examples     = skill.examples.filter(e => e.filename !== filename)
}

exports.deleteFile = async (req, res) => {
    try {
        const { formType, id, skillIndex, filename } = req.params
        const deleted = getHandler(formType).deleteFile(id, filename, skillSubdir(skillIndex))
        if (!deleted) return res.status(404).json({ message: 'File not found' })
        const sub = await FormSubmission.findOne({ _id: id, formType })
        if (sub) { removeFileFromSkill(sub, skillIndex, filename); await sub.save() }
        res.json({ message: 'File deleted' })
    } catch (err) {
        console.error('[Forms] deleteFile:', err)
        res.status(500).json({ message: 'Internal server error' })
    }
}

exports.deleteFileById = async (req, res) => {
    try {
        const { id, skillIndex, filename } = req.params
        const sub = await FormSubmission.findById(id)
        if (!sub) return res.status(404).json({ message: 'Submission not found' })
        const deleted = getHandler(sub.formType).deleteFile(id, filename, skillSubdir(skillIndex))
        if (!deleted) return res.status(404).json({ message: 'File not found' })
        removeFileFromSkill(sub, skillIndex, filename)
        await sub.save()
        res.json({ message: 'File deleted' })
    } catch (err) {
        console.error('[Forms] deleteFileById:', err)
        res.status(500).json({ message: 'Internal server error' })
    }
}