const {
  NetServerProxyNodeIpc
} = require('@lug/netproxy-node-ipc')
const MessagePrototype = require('./messagePrototype')

const NetServerProxy = NetServerProxyNodeIpc

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
    this._net._emitter.on('socket.connect', this._onSocketConnect.bind(this))
    this._net._emitter.on('socket.disconnect', this._onSocketDisconnect.bind(this))
  }
  _onSocketDisconnect(socket){
    // TODO: find in the client list the socket and put his state to connected if it exist in list
  }
  _onSocketDisconnect(socket){
    // TODO: find in the client list the socket and put his state to disconnected
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
    // TODO: find if a client have this uuid if true, set the socket else create new client 
  }
  _onMessageNew(socket, data) {
    /* TODO: on new message : many things
    * - find client from
    * - confirm message reception
    * - check if message id is the next
    *   - if not put in wait list
    *   - if yes send the message to the event message recieved 
    *     for each that are in the right order and block when is not
    */
  }
  _onMessageConfirm(socket, uid) {
    // TODO: remove from sentlist message with the uid
  }
  _onMessageRetry(socket, uid) {
    // TODO: resent the message with the uid that is store in the sent list
  }
}