const {
  EPigeonServer
} = require('../index')

// create the server
const server = new EPigeonServer

// listen on port 9999
server.serve(9999)