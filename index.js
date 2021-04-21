"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var WebSocket = require("ws");
console.log("test");
var port = 3005;
var wsServer = new WebSocket.Server({ port: port });
wsServer.on("listening", function (server) {
    console.log("listening on port" + server.address().toString());
});
var obj1 = { id: 10, name: 'theo' };
var obj2 = { id: 11, name: 'emma' };
var testMap = new Map();
testMap.set('perro', obj1);
testMap.set('perro', obj2);
console.log(testMap.entries());
