const {
  EPigeonServer
} = require('../index')

const server = new EPigeonServer

server.serve(9999)

//setTimeout(() => server.stop(), 3000)
//setTimeout(() => server.serve(9999), 4000)