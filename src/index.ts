import WebSocket = require('ws');
import {ConnectionObject} from "./models/ConnectionObject";
console.log("test");

const port: number = 3005;

const wsServer: WebSocket.Server = new WebSocket.Server({ port: port });

wsServer.on("listening", (server: WebSocket.Server) => {
    console.log("listening on port" + server.address().toString());
});

const obj1={id:10,name:'theo'}
const obj2={id:11,name:'emma'}

var testMap:any=new Map();
testMap.set('perro',obj1);
testMap.set('perro',obj2);
console.log(testMap.entries());
