"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var ws_1 = __importDefault(require("ws"));
//theo
var wsServer = new ws_1.default.Server({ port: 3005 });
wsServer.on("listening", function (server) {
    console.log('serverClient is listening');
});
wsServer.on("connection", function (ws) {
    ws.on("message", function (message) {
        //type:0 message is in order to perform initial connect process
        //type:1 message is in order to modify reception channels as well as transmitting own location
        //type:2 message is in order to exclusively send own location
        console.log(message);
        try {
            var jsonMsg = JSON.parse(message);
            var type = jsonMsg.type;
            switch (type) {
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
        }
        catch (_a) {
            ws.send("illegal msg");
        }
    });
});
