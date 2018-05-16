class ClientStorage {
  constructor() {
    /**
     * Unique Id of the client
     * @type {string}
     */
    this.uuid = ''
    /**
     * Data of the client
     * @type {Object}
     */
    this.session = {}
    /**
     * Socket used to send data
     * @type {Socket|any}
     */
    this.socket = ''
    /**
     * Last id that was sent by the client
     * @type {Int}
     */
    this._lastSendId = 0
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
  get state () {
    return socket===null ? 'disconnected' : 'connected'
  }
}