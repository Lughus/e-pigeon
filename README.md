# ![logo](https://raw.githubusercontent.com/Lughus/e-pigeon/master/ressources/pigeon.png) e-pigeon

Implementation of an handmade application protocol for messaging

Be careful this is an alpha version of the software and many bugs can be found in it. If you use it and found some, please create an issue, it can be helpful.

## What does it do ?

That's a simple messaging server / client using node-ipc in the hood\
It garantee the order of sended messages and that the message has been recieved.\
You can send a message to a group of clients.\
Server cannot receive message, but you can start a client in the same app of the server and will use localhost to communicate.

## Getting started

Works on node 8+\
Install it with `npm i @lug/e-pigeon`

You can check [example](https://github.com/Lughus/e-pigeon/tree/master/example) for an simple use of this module.

### Server

```js
const { EPigeonServer } = require('@lug/e-pigeon')
const server = new EPigeonServer()
server.serve(9999)
```

### Client

```js
const { EPigeonClient } = require('@lug/e-pigeon')
const client = new EPigeonClient()
client.connect('host', 9999)
```

## Documentation

For debugging, you can set the env debug variable to `epigeon:*` like described in the [debug](https://github.com/visionmedia/debug) module

### Server

#### Methods

| name  | params   | description        |
| ----- | -------- | ------------------ |
| serve | port:Int | serve on this port |
| stop  | -        | stop the server    |

### Client

#### Methods

| name| params| description|
|-|-|-|
| connect| host:string / port:Int| connect to server|
| disconnect|-| disconnect from server|
| updateSession | {key:value,...}| set values to your client session|
| sendMessage   | to: uuid or {key:value} / content:any | send a message to a uuid or to all client that match the key:value on their session |


#### Events

You can add en event handler with `client.on(<event>, <callback>)`

| event | callback params | description|
|-|-|-|
| connected| - | when the client is connected to the server|
| disconnected | - | when the client is disconnected|
| authenticated | - | when the client is authenticated|
| session-update | {uuid, session} | when a client update his session|
| message | message | when a message is recieved, contains many things but the content is stored in `message.payload`



