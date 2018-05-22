const {
  EPigeonClient
} = require('../index')

const client = new EPigeonClient

client.uuid = 'c1'

client.onMessage = message => {
  console.log(message)
}

client.connect('localhost', 9999)

client.updateSession({
  name: 'client 1'
})

client.sendMessage({name:'client 2'},{
  my: 'name',
  is: client.session.name
})