module.exports = (res, statusCode, error) => {
    res.status(statusCode).json({
        message: error instanceof Error ? error.message : error
    })
}