const uuidv4 = require('uuid/v4')

class ClientStorage {
  constructor() {
    /**
     * Unique Id of the client
     * @type {string}
     */
    this.uuid = uuidv4()
    /**
     * Data of the client
     * @type {Object}
     */
    this.session = {}
    /**
     * Socket used to send data
     * @type {Socket|any}
     */
    this.socket = null
    /**
     * Last id that was sent by the client
     * @type {Int}
     */
    this._lastSendId = 0
    /**
     * Last id that was emit to the client
     * @type {Int}
     */
    this._lastEmitId = 0
    /**
     * List of messages that are sent but not confirmed
     * @type {MessagePrototype[]}
     */
    this._sentList = []
    /**
     * List of message that are received but that are not in the correct order (waiting for a previous message that is not already recieved)
     * @type {MessagePrototype[]}
     */
    this._waitList = []
  }
  /**
   * Obtain the state of the client
   * @type {string}
   */
  get state() {
    return this.socket === null ? 'disconnected' : 'connected'
  }
}

module.exports = ClientStorage