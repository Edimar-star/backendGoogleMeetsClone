const dotenv = require('dotenv')
dotenv.config()

module.exports = {
    PORT: process.env.PORT,
    ORIGIN_URL: process.env.ORIGIN_URL,
    ROOM_LIMIT: process.env.ROOM_LIMIT
}