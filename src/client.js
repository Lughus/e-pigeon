const {
  NetClientProxyNodeIpc
} = require('@lug/netproxy-node-ipc')
const NetClientProxy = NetClientProxyNodeIpc
const MessagePrototype = require('./messagePrototype')
const ClientStorage = require('./clientStorage')

const Events = require('events')

const dbg = require('debug')('epigeon:client')

class EPigeonClient {
  constructor() {
    /**
     * Interface that is used to send message
     * @type {NetClientProxy}
     */
    this._net = new NetClientProxy
    this._me = new ClientStorage
    this._clients = []
    this._state = 'disconnected'
    this._ev = new Events
    this._initEvents()
  }
  /**
   * clients that has been connected to the server {uuid, session}
   * @type {objcet[]}
   */
  get clients() {
    return this._clients
  }
  /**
   * uuid of this client
   * @type {string}
   */
  get uuid() {
    return this._me.uuid
  }
  /**
   * Session of this client
   * @type {object}
   */
  get session() {
    return this._me.session
  }
  /**
   * State of the client; can be "connected" or "disconnected"
   * @type {string}
   */
  get state() {
    return this._state
  }
  /**
   * Define event callback (Emitter)
   * @param {string} event  the name of the event
   * @param {function}
   */
  on(event, callback) {
    this._ev.on(event, callback)
  }
  /**
   * Disable an event
   * @param {string} event the name of the event
   * @param {function}
   */
  off(event, callback) {
    this._ev.off(event, callback)
  }
  _initEvents() {
    this._net.ev.on('connected', this._onConnect.bind(this))
    this._net.ev.on('disconnect', this._onDisconnect.bind(this))
    this._net.ev.on('data', this._onData.bind(this))
  }
  /**
   * Handler for the on connect action.
   * You can add an handler with client.on('connected',...)
   */
  _onConnect() {
    this._state = 'connected'
    dbg('connected')
    this._ev.emit('connected')
    this._authMe()
    setTimeout(() => {
      this._me._sentList.forEach(message => {
        this._sendMessageWithRetry(message)
      })
    }, 500)
  }
  /**
   * Handler for the on disconnect action.
   * You can add an handler with client.on('disconnected',...)
   */
  _onDisconnect() {
    this._state = 'disconnected'
    this._ev.emit('disconnected')
    this._me._sentList.forEach(message => {
      if (message.resendAction !== undefined) {
        clearTimeout(message.resendAction)
        delete message.resendAction
      }
    })
  }
  _onData(data) {
    data = JSON.parse(data)
    let actions = {
      'auth': this._onAuth.bind(this),
      'clients.list': this._onClientsList.bind(this),
      'session.update': this._onSessionUpdate.bind(this),
      'message.new': this._onMessageNew.bind(this),
      'message.retry': this._onMessageRetry.bind(this),
      'message.confirm': this._onMessageConfirm.bind(this)
    }
    actions[data.action](data.payload)
  }
  /**
   * Handler for the on auth action.
   * You can add an handler with client.on('authenticated',...)
   */
  _onAuth() {
    dbg('authenticated')
    this.updateSession(this.session)
    this._ev.emit('authenticated')
  }
  _authMe() {
    dbg('auth me')
    this._net.send(JSON.stringify({
      action: 'auth',
      payload: this._me.uuid
    }))
  }
  _onClientsList(list) {
    dbg('recieved client list :', list)
    this._clients = list
  }
  /**
   * Handler for the on sessionUpdate action.
   * You can add an handler with client.on('session-update',({uuid,session})=>...)
   */
  _onSessionUpdate(payload) {
    this._ev.emit('session-update', payload)
    let client = this._clients.find(c => c.uuid === payload.uuid)
    dbg('recieved session for client :', client, payload)
    if (client === undefined) this._clients.push(payload)
    else client.session = payload.session
  }
  /**
   * Handler for the on message action.
   * You can add an handler with client.on('message',message=>...)
   */
  _onMessageNew(message) {
    const client = this._me
    dbg('message recieved :', message)
    this._confirmMessage(message)
    if (client._lastEmitId === message.id) {
      // send all in wait list
      for (
        let mess = message; mess !== undefined; mess = client._waitList.find(m => m.id === client._lastEmitId + 1)
      ) {
        client._waitList.splice(
          client._waitList.findIndex(m => m.uid === mess.uid),
          1
        )
        client._lastEmitId += 1
        this._ev.emit('message', message)
      }
    } else {
      client._waitList.push(message)
    }
  }
  _onMessageRetry(id) {
    const message = this._me._sentList.find(m => m.id === id)
    dbg('message retry asked :', message)
    if (message !== undefined) this._sendMessage(message)
    else
      console.error(
        Error('Message retry asked but cannot find message'),
        uid
      )
  }
  _onMessageConfirm(uid) {
    const index = this._me._sentList.findIndex(m => m.uid === uid)
    if (index !== -1) {
      const message = this._me._sentList.splice(index, 1)[0]
      if (message.resendAction !== undefined) {
        clearTimeout(message.resendAction)
        delete message.resendAction
      }
      dbg('message confirmed', message)
    }
  }
  _confirmMessage(message) {
    dbg('confirm message :', message)
    this._net.send(JSON.stringify({
      action: 'message.confirm',
      payload: message.uid
    }))
  }
  _sendMessage(message) {
    if (message.action === 'message.new') message = message.payload
    dbg('send new message:', message)
    this._net.send(JSON.stringify({
      action: 'message.new',
      payload: message
    }))
  }
  _sendMessageWithRetry(message) {
    this._sendMessage(message)
    message.resendAction = setTimeout(() => {
      this._sendMessageWithRetry(message)
    }, 2000)
  }
  /**
   * Send a message to another client
   * @param {string|object} to string : uuid of the destination client ||
   * object : {key:value} that correspond to the session of the client 
   * ; can correspond to many like a group
   * @param {any} messageCnt Content of the message 
   */
  sendMessage(to, messageCnt) {
    dbg('send message to:', to, messageCnt)
    const message = new MessagePrototype
    message.from = this._me.uuid
    message.to = to
    message.id = this._me._lastSendId++;
    message.payload = messageCnt
    this._me._sentList.push(message)
    if (this._me.state === 'connected')
      this._sendMessageWithRetry(message)
  }
  /**
   * Update your session object and send it to the others connected client
   * @param {object} object some key:value that you need to change in the session
   */
  updateSession(object = {}) {
    Object.assign(this._me.session, object)
    dbg('update session')
    if (this.state === 'connected')
      this._net.send(JSON.stringify({
        action: 'session.update',
        payload: this._me.session
      }))
  }
  /**
   * try to connect to the server, try to the infinite
   * @param {string} ip the ip or dns of the server
   * @param {Int} port the port of the server 
   */
  connect(ip, port) {
    dbg('connect:', ip, port)
    this._net.connect(ip, port)
  }
  /**
   * disconnect the client
   */
  disconnect() {
    dbg('disconnect')
    this._net.disconnect()
  }
}

module.exports = EPigeonClient