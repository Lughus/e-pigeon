const uuidv4 = require('uuid/v4')

class MessagePrototype {
  constructor() {
    /**
     * Uuid of who sent the message
     * @type {string}
     */
    this.from = ''
    /**
     * string : uuid of the client || object : key:value that correspond to the session of the client
     * @type {string|object} 
     */
    this.to = ''
    /**
     * The id of the message that is incrmented every new message
     * @type {Int}
     */
    this.id = 0
    /**
     * Unique id of the message
     * @type {string} 
     */
    this.uid = uuidv4()
    /**
     * Content of the message
     * @type {any} 
     */
    this.payload = null
  }
}

module.exports = MessagePrototype