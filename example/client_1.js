const {
  EPigeonClient
} = require('../index')

// create the client
const client = new EPigeonClient

// define what to do when a message arrive
client.on('message', message => {
  console.log('!!!!!!', message)
})

// change the session status for client
client.updateSession({
  name: 'client 1'
})


// Send a message
client.sendMessage({
  name: 'client 2' // to the client that the name is "client 1"
}, { // with this message
  my: 'name',
  is: client.session.name
})

// connect to the server
client.connect('localhost', 9999)

// the message will be sent when the client is connected to the server
//   and the server will transmit it to to client when he can find it
