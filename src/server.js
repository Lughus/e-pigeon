const {
  NetServerProxyNodeIpc
} = require('@lug/netproxy-node-ipc')
const NetServerProxy = NetServerProxyNodeIpc
const MessagePrototype = require('./messagePrototype')
const ClientStorage = require('./clientStorage')

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

    this._initEvents()
  }
  _initEvents() {
    this._net._emitter.on('data', this._onData.bind(this))
    this._net._emitter.on(
      'socket.disconnect',
      this._onSocketDisconnect.bind(this)
    )
  }
  _findFromSocket(socket) {
    return this.clients.find(s => s === socket)
  }
  _onSocketDisconnect(socket) {
    // find in the client list the socket and put his state to disconnected
    const client = this._findFromSocket(socket)
    if (client !== undefined) {
      client.socket = null
      client._sentList.forEach(message => delete message.retryAction)
    }
  }
  _onData(socket, data) {
    data = JSON.parse(data)
    let actions = {
      auth: this._onAuth.bind(this),
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
    if (client === undefined) {
      client = new ClientStorage()
      client.uuid = uuid
      this.clients.push(client)
    }
    client.socket = socket
    // send messages in the sendlist
    client._sendList.forEach(message => {
      this._sendMessageWithRetry(client.socket, message)
    })
  }
  _onMessageNew(socket, data) {
    /* on new message : many things
     * - find client from
     * - confirm message reception
     * - check if message id is the next
     *   - if not put in wait list
     *   - if yes send the message to the event message recieved 
     *     for each that are in the right order and block when is not and remove from the list
     */
    const client = this._findFromSocket(socket)
    this._confirmMessage(socket, message)
    if (client._lastEmitId + 1 === message.id) {
      // send all in wait list
      for (
        let mess = message; mess !== undefined; mess = client._waitList.find(m => m.id === client._lastEmitId + 1)
      ) {
        // find destination client
        let toClient = this.clients.find(c => c.uuid === mess.to)
        // send message
        toClient._sendList.push(mess)
        if (toClient.socket !== null)
          this._sendMessageWithRetry(toClient.socket, mess)
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
        let message = client._sentList.splice(index, 1)
        if (message.retryAction !== undefined) clearTimeout(message.retryAction)
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
    delete message.retryAction
    this._net.send(socket, JSON.stringify({
      action: 'message.new',
      payload: message
    }))
  }
  _sendMessageWithRetry(socket, message) {
    this._sendMessage(socket, message)
    message.resendAction = setTimeout(() => {
      this._sendMessageWithRetry(socket, mess)
    }, 2000)
  }
  _confirmMessage(socket, message) {
    this._net.send(socket, JSON.stringify({
      action: 'message.confirm',
      payload: message.uid
    }))
  }
  _onSessionUpdate(socket, session) {
    const client = this._findFromSocket(socket)
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
  }
  _retryMessage(socket, id) {
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
    this._net.listen(port)
  }
  /**
   * Stop the server
   */
  stop() {
    this._net.stop()
  }
}