const {
  EPigeonClient,
  EPigeonServer
} = require('../index')

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

const cli = new EPigeonClient
cli.on('message', m => console.log(`${cli.session.name} : ${findFrom(cli.clients,m)}.${m.id} -> ${transformTo(m)} in ${tmspDiff(m)} : ${m.uid} => ${m.payload.message}`))

const send = (to, message) => {
  let tmsp = Number(new Date)
  cli.sendMessage(to, {
    tmsp,
    message
  })
}

cli.updateSession({name:'client_x', group:1})

cli.connect('localhost',9999)