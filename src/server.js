const {
  NetServerProxyNodeIpc
} = require('@lug/netproxy-node-ipc')
const NetServerProxy = NetServerProxyNodeIpc
const MessagePrototype = require('./messagePrototype')
const ClientStorage = require('./clientStorage')

const dbg = require('debug')('epigeon:server')

class EPigeonServer {
  constructor() {
    /**
     * Interface that is used to send message
     * @type {NetServerProxy}
     */
    this._net = new NetServerProxy()
    /**
     * Clients that was connected a least one time
     * @type {ClientStorage[]}
     */
    this.clients = []

    this._unknowList = []

    this._initEvents()
  }
  _initEvents() {
    this._net.ev.on('socket.data', this._onData.bind(this))
    this._net.ev.on(
      'socket.disconnect',
      this._onSocketDisconnect.bind(this)
    )
    this._net.ev.on(
      'socket.connect',
      (socket) => {
        dbg('socket connected : ', socket.toString(), this._findFromSocket(socket))
      }
    )
  }
  _findFromSocket(socket) {
    if (socket === null) return
    return this.clients.find(c => c.socket === socket)
  }
  _findFromMessageTo(message, clients = this.clients) {
    let client = undefined
    if (typeof message.to === 'string') {
      client = clients.find(c => c.uuid = message.to)
    } else if (typeof message.to === 'object') {
      for (let key in message.to) {
        client = clients.find(c =>
          c.session[key] !== undefined &&
          c.session[key] === message.to[key])
      }
    }
    return client
  }
  _onSocketDisconnect(socket) {
    // find in the client list the socket and put his state to disconnected
    const client = this._findFromSocket(socket)
    dbg('client disconnected :', socket.toString())
    if (client !== undefined) {
      client.socket = null
      client._sentList.forEach(message => {
        clearTimeout(message.resendAction)
        delete message.resendAction
      })
    }
  }
  _onData(socket, data) {
    data = JSON.parse(data)
    dbg('data recieved', data)
    let actions = {
      'auth': this._onAuth.bind(this),
      'message.new': this._onMessageNew.bind(this),
      'message.confirm': this._onMessageConfirm.bind(this),
      'message.retry': this._onMessageRetry.bind(this),
      'clients.list': this._onClientsList.bind(this),
      'session.update': this._onSessionUpdate.bind(this),
    }
    actions[data.action](socket, data.payload)
  }
  _onAuth(socket, uuid) {
    // find if a client have this uuid if true, set the socket else create new client
    let client = this.clients.find(c => c.uuid === uuid)
    dbg('client auth :', uuid)
    if (client === undefined) {
      client = new ClientStorage()
      client.uuid = uuid
      this.clients.push(client)
    }
    client.socket = socket
    this._net.send(socket, JSON.stringify({
      action: 'auth',
      payload: ''
    }))
    // send messages in the sendlist
    client._sentList.forEach(message => {
      this._sendMessageWithRetry(client.socket, message)
    })
    this._tryToSendUnknowDestinatoryMessage(client)
  }
  _tryToSendUnknowDestinatoryMessage(clients = this.clients) {
    dbg('try to find destinator for :', clients.toString())
    if (!Array.isArray(clients)) clients = [clients]
    for (let message of this._unknowList) {
      let client = this._findFromMessageTo(message, clients)
      if (client !== undefined) {
        dbg('message found a destinator :', message, client)
        client._sentList.push(message)
        if (client.socket !== undefined)
          this._sendMessageWithRetry(client.socket, message)
      }
    }
  }
  _onMessageNew(socket, message) {
    /* on new message : many things
     * - find client from
     * - confirm message reception
     * - check if message id is the next
     *   - if not put in wait list
     *   - if yes send the message to the event message recieved 
     *     for each that are in the right order and block when is not and remove from the list
     */
    const client = this._findFromSocket(socket)
    dbg('message recieved from :', client.toString(), message)
    this._confirmMessage(socket, message)
    if (client._lastEmitId + 1 === message.id) {
      // send all in wait list
      for (
        let mess = message; mess !== undefined; mess = client._waitList.find(m => m.id === client._lastEmitId + 1)
      ) {
        // find destination client
        let toClient = this._findFromMessageTo(mess)
        if (toClient === undefined) {
          // put message in unknown list
          this._unknowList.push(mess)
        } else {
          // send message
          toClient._sentList.push(mess)
          if (toClient.socket !== null)
            this._sendMessageWithRetry(toClient.socket, mess)
        }
        // rm from list
        client._waitList.splice(
          client._waitList.findIndex(m => m.uid === mess.uid),
          1
        )
        client._lastEmitId += 1
      }
    } else {
      client._waitList.push(message)
    }
  }
  _onMessageConfirm(socket, uid) {
    // remove from sentlist message with the uid
    const client = this._findFromSocket(socket)
    if (client !== undefined) {
      const index = client._sentList.findIndex(m => m.uid === uid)
      if (index !== -1) {
        let message = client._sentList.splice(index, 1)[0]
        if (message.resendAction !== undefined) {
          clearTimeout(message.resendAction)
          delete message.resendAction
        }
        dbg('Confirmed message :', message)
      } else
        console.error(
          Error('Message confirm recieved but cannot find message'),
          client,
          uid
        )
    } else
      console.error(
        Error('Message confirm recieved but cannot find client'),
        socket,
        uid
      )
  }
  _onMessageRetry(socket, id) {
    // resent the message with the id that is store in the sent list
    const client = this._findFromSocket(socket)
    dbg('asked to retry a message with id :', id)
    if (client !== undefined) {
      const message = client._sentList.find(m => m.id === id)
      if (message !== undefined) this._sendMessage(socket, message)
      else
        console.error(
          Error('Message retry asked but cannot find message'),
          client,
          uid
        )
    } else
      console.error(
        Error('Message retry asked but cannot find client'),
        socket,
        uid
      )
  }
  _onClientsList(socket) {
    dbg('asked for client list')
    this._net.send(socket, JSON.stringify({
      action: 'clients.list',
      payload: this.clients.map(({
        uuid,
        session
      }) => ({
        uuid,
        session
      }))
    }))
  }
  _sendMessage(socket, message) {
    if (socket === null) return
    delete message.resendAction
    this._net.send(socket, JSON.stringify({
      action: 'message.new',
      payload: message
    }))
  }
  _sendMessageWithRetry(socket, message) {
    dbg('send message with retry :', message)
    this._sendMessage(socket, message)
    message.resendAction = setTimeout(() => {
      this._sendMessageWithRetry(socket, message)
    }, 2000)
  }
  _confirmMessage(socket, message) {
    dbg('confirm message', message)
    if (message.resendAction !== undefined) {
      clearInterval(message.resendAction)
      delete message.resendAction
    }
    this._net.send(socket, JSON.stringify({
      action: 'message.confirm',
      payload: message.uid
    }))
  }
  _onSessionUpdate(socket, session) {
    const client = this._findFromSocket(socket)
    dbg('session update for:', client.toString(), session)
    client.session = session
    const data = JSON.stringify({
      action: 'session.update',
      payload: {
        uuid: client.uuid,
        session
      }
    })
    this.clients.forEach(c => {
      if (c.socket !== null && c.uuid !== client.uuid) {
        this._net.send(c.socket, data)
      }
    })
    this._tryToSendUnknowDestinatoryMessage(client)
  }
  _retryMessage(socket, id) {
    dbg('ask for retry :', id)
    this._net.send(socket, JSON.stringify({
      action: 'message.retry',
      payload: id
    }))
  }
  /**
   * Serve on this port
   * @param {int} port Number of the port 
   */
  serve(port) {
    dbg('serve at', port)
    this._net.listen(port)
  }
  /**
   * Stop the server
   */
  stop() {
    dbg('stop')
    this._net.stop()
  }
}

module.exports = EPigeonServer