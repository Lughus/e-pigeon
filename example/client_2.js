const {
  EPigeonClient
} = require('../index')

const client = new EPigeonClient

client.onMessage = message => {
  console.log('!!!!!!', message)
}

client.updateSession({
  name: 'client 2'
})
client.sendMessage({
  name: 'client 1'
}, {
  my: 'name',
  is: client.session.name
})
client.connect('localhost', 9999)

client.on('connected', () => {
  //setTimeout(client.disconnect.bind(client), 2500)
})