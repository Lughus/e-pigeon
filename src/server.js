const {
  NetServerProxyNodeIpc
} = require('@lug/netproxy-node-ipc')
const NetServerProxy = NetServerProxyNodeIpc
const MessagePrototype = require('./messagePrototype')
const ClientStorage = require('./clientStorage')

const debug = require('debug')
const dbg = debug('epigeon:serve')
const dbgx = debug('epigeon:srv')

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
    /**
     * List of message that doesn't know the destination client and wait that it connect
     * @type {MessagePrototype[]}
     */
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
        dbg('socket connected : ', socket)
      }
    )
  }
  /**
   * find a client from his socket
   * @param {Socket|any} socket of the client
   * @returns {ClientStorage?} the client wha as this socket
   */
  _findFromSocket(socket) {
    if (socket === null) return
    return this.clients.find(c => c.socket === socket)
  }
  /**
   * Find the destinator(s) of the message
   * @param {MessagePrototype} message the message that contanin the destinator
   * @param {ClientStorage[]} clients the clients that we need to find in a destinator
   * @returns {ClientStorage[]} clients that correspond to message.to
   */
  _findFromMessageTo(message, clients = this.clients) {
    let dstClients = []
    dbg('find client:', clients, message)
    if (typeof message.to === 'string') {
      let client = clients.find(c => c.uuid = message.to)
      if (client !== undefined) dstClients.push(client)
    } else if (typeof message.to === 'object') {
      for (let client of clients)
        for (let key in message.to) {
          if (client.session[key] !== undefined &&
            client.session[key] === message.to[key])
            dstClients.push(client)
        }
    }
    return dstClients
  }
  _onSocketDisconnect(socket) {
    // find in the client list the socket and put his state to disconnected
    const client = this._findFromSocket(socket)
    dbg('client disconnected :', socket)
    if (client !== undefined) {
      client.socket = null
      client._sentList.forEach(message => {
        this._clearResendAction(message)
      })
    }
    this._notifyClientsOfADisconnection(client)
  }
  _notifyClientsOfADisconnection(disconnectedClient) {
    for (let client of this.clients) {
      if (client.socket !== null) {
        this._net.send(client.socket, JSON.stringify({
          action: 'client.disconnect',
          payload: disconnectedClient.uuid
        }))
      }
    }
  }
  _notifyClientsOfAConnection(connectedClient) {
    for (let client of this.clients) {
      if (client.uuid !== connectedClient.uuid && client.socket !== null) {
        this._net.send(client.socket, JSON.stringify({
          action: 'client.connect',
          payload: connectedClient.uuid
        }))
      }
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
    let isKnow = true
    if (client === undefined) {
      client = new ClientStorage()
      client.uuid = uuid
      this.clients.push(client)
      isKnow = false
    }
    dbg('client auth :', isKnow, uuid)
    client.socket = socket
    this._net.send(socket, JSON.stringify({
      action: 'auth',
      payload: isKnow
    }))
    this._sendClientsList(socket)
    // send messages in the sendlist
    client._sentList.forEach(message => {
      this._sendMessageWithRetry(client.socket, message)
    })
    this._notifyClientsOfAConnection(client)
    this._tryToSendUnknowDestinatoryMessage(client)
  }
  _tryToSendUnknowDestinatoryMessage(clients = this.clients) {
    dbg('try to find destinator for :', clients, this._unknowList)
    if (!Array.isArray(clients)) clients = [clients]
    for (let messageIndex in this._unknowList) {
      let message = this._unknowList[messageIndex]
      let dstClients = this._findFromMessageTo(message, clients)
      for (let client of dstClients)
        if (client !== undefined) {
          dbg('message found a destinator :', message, client)
          let message_ = JSON.parse(JSON.stringify(message))
          this._updateMessageId(client, message_)
          client._sentList.push(message_)
          if (client.socket !== undefined)
            this._sendMessageWithRetry(client.socket, message_)
        }
      if (dstClients.length > 0)
        this._unknowList.splice(messageIndex, 1)
    }
  }
  _updateMessageId(client, message) {
    message.fromId = message.id
    message.id = client._lastSendId++
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
    dbg('message recieved from :', client, message)
    dbgx('message recieved:', message)
    dbgx('--- ', client._lastEmitId, message.id)
    this._confirmMessage(socket, message)
    client._waitList.push(message)
    // send all in wait list
    for (
      let mess = message; mess !== undefined; mess = client._waitList.find(m => m.id === client._lastEmitId + 1)
    ) {
      // find destination client
      let toClients = this._findFromMessageTo(mess)
      if (toClients.length === 0) {
        // put message in unknown list
        this._unknowList.push(mess)
      } else {
        // send message
        for (let toClient of toClients) {
          this._clearResendAction(mess)
          let mess_ = JSON.parse(JSON.stringify(mess))
          this._updateMessageId(toClient, mess_)
          // thats something strange, if a message arrive at the same time that someone connect the message is duplicated
          //  with that it cancel the new send
          if(toClient._sentList.find(a=>a.uid === mess_.uid))
            return dbg('message duplicate found on the sent list, so cancel the new send', mess_)
          // END TEST
          toClient._sentList.push(mess_)
          if (toClient.socket !== null) {
            this._sendMessageWithRetry(toClient.socket, mess_)
          }
        }
      }
      // rm from list
      client._waitList.splice(
        client._waitList.findIndex(m => m.uid === mess.uid),
        1
      )
      client._lastEmitId += 1
    }
  }
  _onMessageConfirm(socket, uid) {
    // remove from sentlist message with the uid
    const client = this._findFromSocket(socket)
    if (client !== undefined) {
      const index = client._sentList.findIndex(m => m.uid === uid)
      if (index !== -1) {
        let message = client._sentList.splice(index, 1)[0]
        this._clearResendAction(message)
        dbg('Confirmed message :', message)
      } else
        console.error(
          Error('SRV:Message confirm recieved but cannot find message'),
          client,
          uid
        )
    } else
      console.error(
        Error('SRV:Message confirm recieved but cannot find client'),
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
          Error('SRV:Message retry asked but cannot find message'),
          client,
          uid
        )
    } else
      console.error(
        Error('SRV:Message retry asked but cannot find client'),
        socket,
        uid
      )
  }
  _onClientsList(socket) {
    dbg('asked for client list')
    this._sendClientsList(socket)
  }
  _sendClientsList(socket) {
    this._net.send(socket, JSON.stringify({
      action: 'clients.list',
      payload: this.clients.map(({
        uuid,
        state,
        session
      }) => ({
        uuid,
        state,
        session
      }))
    }))
  }
  _clearResendAction(message) {
    if (message.resendAction !== undefined) {
      clearInterval(message.resendAction)
      delete message.resendAction
    }
  }
  _sendMessage(socket, message) {
    if (socket === null) return
    this._clearResendAction(message)
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
    this._clearResendAction(message)
    this._net.send(socket, JSON.stringify({
      action: 'message.confirm',
      payload: message.uid
    }))
  }
  _onSessionUpdate(socket, session) {
    const client = this._findFromSocket(socket)
    dbg('session update for:', client, session)
    client.session = session
    const data = JSON.stringify({
      action: 'session.update',
      payload: {
        uuid: client.uuid,
        session
      }
    })
    this.clients.forEach(c => {
      if (c.socket !== null) {
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