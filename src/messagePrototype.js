const uuidv4 = require('uuid/v4')

class MessagePrototype {
  constructor() {
    /**
     * Uuid of who sent the message
     * @type {string}
     */
    this.from = ''
    /**
     * Uuid of who is destinated the message
     * @type {string}
     */
    this.to = ''
    /**
     * The id of the message 
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