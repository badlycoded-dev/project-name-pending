const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt')
const config = require('../config/config')
const User   = require('../models/mongo.users')

module.exports = (passport) => {
    passport.use(new JwtStrategy(
        {
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey:    config.JWT_SECRET
        },
        async (payload, done) => {
            try {
                const user = await User.findById(payload.userId).select('email id')
                return done(null, user || false)
            } catch (err) {
                return done(err, false)
            }
        }
    ))
}