const server = require('./server')
const { PORT } = require('./config')

server.listen(PORT, () => console.log(`Server is running on port ${PORT}`))