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

  }
  _onMessageNew(socket, data) {

  }
  _onMessageConfirm(socket, uid) {

  }
  _onMessageRetry(socket, uid) {

  }
}