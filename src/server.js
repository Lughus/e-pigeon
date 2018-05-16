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
    this._net = new NetServerProxy
    /**
     * Clients that was connected a least one time
     * @type {ClientStorage[]}
     */
    this.clients = []

    this._initEvents()
  }
  _initEvents() {
    this._net._emitter.on('data', this._onData.bind(this))
    this._net._emitter.on('socket.disconnect', this._onSocketDisconnect.bind(this))
  }
  _findFromSocket(socket) {
    return this.clients.find(s => s === socket)
  }
  _onSocketDisconnect(socket) {
    // find in the client list the socket and put his state to disconnected
    const client = this._findFromSocket(socket)
    if (client !== undefined)
      client.socket = null
  }
  _onData(socket, data) {
    data = JSON.parse(data)
      ({
        'auth': this._onAuth.bind(this),
        'message.new': this._onMessageNew.bind(this),
        'message.confirm': this._onMessageConfirm.bind(this),
        'message.retry': this._onMessageRetry.bind(this)
      })[data.action](socket, data.payload)
  }
  _onAuth(socket, uuid) {
    // find if a client have this uuid if true, set the socket else create new client
    let client = this.clients.find(c => c.uuid === uuid)
    if (client === undefined) {
      client = new ClientStorage
      this.clients.push(client)
    }
    client.socket = socket
    // TODO: send message in the waitlist
  }
  _onMessageNew(socket, data) {
    /* TODO: on new message : many things
     * - find client from
     * - confirm message reception
     * - check if message id is the next
     *   - if not put in wait list
     *   - if yes send the message to the event message recieved 
     *     for each that are in the right order and block when is not and remove from the list
     */
  }
  _onMessageConfirm(socket, uid) {
    // remove from sentlist message with the uid
    let client = this._findFromSocket(socket)
    if (client !== undefined) {
      const index = client._sentList.findIndex(m => m.uid === uid)
      if (index !== undefined) client._sentList.splice(index, 1)
      else console.error(Error('Message confirm recieved but cannot find message'), client, uid)
    } else console.error(Error('Message confirm recieved but cannot find client'), socket, uid)

  }
  _onMessageRetry(socket, uid) {
    // resent the message with the uid that is store in the sent list
    let client = this._findFromSocket(socket)
    if (client !== undefined) {
      const message = client._sentList.find(m => m.uid === uid)
      if (message !== undefined) this._net.send(socket, message)
      else console.error(Error('Message retry asked but cannot find message'), client, uid)
    } else console.error(Error('Message retry asked but cannot find client'), socket, uid)
  }
  serve(port) {
    this._net.listen(port)
  }
  stop() {
    this._net.stop()
  }
}