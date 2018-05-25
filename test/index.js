const debug = require('debug')
const dbg = debug('epigeon:test')

const {
  EPigeonClient,
  EPigeonServer
} = require('../index')

const server = new EPigeonServer

const toc = num => ({
  name: `client_${num}`
})
const tog = num => ({
  group: num
})
const findFrom = (clients, mess) => {
  let uuid = mess.from
  let fromcli = clients.find(c => c.uuid === uuid)
  if (fromcli === undefined) return uuid
  else return fromcli.session.name
}
const transformTo = mess => {
  if (mess.to.name !== undefined) return `c:${mess.to.name}`
  if (mess.to.group !== undefined) return `g:${mess.to.group}`
  return mess.to
}
const tmspDiff = mess => `${Number(new Date) - mess.payload.tmsp}ms`

const clients = Array(5).fill(0).map((a, i) => {
  let cli = new EPigeonClient
  cli.updateSession({
    name: `client_${i}`,
    group: i % 2
  })
  cli.on('message', message => {
    dbg(`${cli.session.name} : ${findFrom(cli.clients,message)}.${message.fromId} -> ${transformTo(message)}.${cli._me._lastEmitId}.${message.id} in ${tmspDiff(message)} : ${message.uid} => ${message.payload.message}`)
  })
  return cli
})

const send = (cliNum, to, message) => {
  let cli = clients[cliNum]
  let tmsp = Number(new Date)
  cli.sendMessage(to, {
    tmsp,
    message
  })
}





send(0, toc(1), 'First message')
send(1, toc(2), 'Second')
send(4, tog(0), 'toGroup 0')

server.serve(9999)

//clients[0].connect('127.0.0.1',9999)
clients.forEach(c => c.connect('localhost', 9999))

setTimeout(()=>{
  clients.forEach(c=>c.disconnect())
  server.stop()
},1000)