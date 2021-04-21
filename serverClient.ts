import WebSocket = require("ws");
import dgram = require("dgram");
import redis from 'redis';
import {ConnectionObject} from './src/models/ConnectionObject';


const wsServer:WebSocket.Server = new WebSocket.Server({ port: 3005 });

wsServer.on("listening",(server:WebSocket.Server)=>{
    console.log('serverClient is listening')
})

wsServer.on("connection", (ws:WebSocket) => {
    ws.on("message", (message:string) => {
        //type:0 message is in order to perform initial connect process
        //type:1 message is in order to modify reception channels as well as transmitting own location
        //type:2 message is in order to exclusively send own location
        console.log(message);
        try{
            const jsonMsg=JSON.parse(message);
            const type:number=jsonMsg.type;
            switch(type) {
                case 0:
                  // connection process: add to connection list and tell user to send matching dgram for connection matching
                  break;
                case 1:
                  // 2 processes: 
                  //1. publish location payload on redis for counterpart(drivers) to diseminate 
                  //2. find channel delta and tell redis add and remove connection from corresponding channels
                  break;
                default:
                  // publish location payload on redis for counterpart(drivers) to diseminate
              }
            
        }catch{
            ws.send("illegal msg");
        }
        
   
    });
});