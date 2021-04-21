const WebSocket = require("ws");
const dgram = require("dgram");
const redis=require("redis");

const wsServer = new WebSocket.Server({ port: 3005 });

wsServer.on("listening", function(){
    console.log('serverClient is listening')
})

wsServer.on("connection", (ws) => {
    ws.on("message", (message) => {
        //type:0 message is in order to perform initial connect process
        //type:1 message is in order to modify reception channels as well as transmitting own location
        //type:2 message is in order to exclusively send own location
        console.log(message);
        try{
            const jsonMsg=JSON.parse(message);
            const type=jsonMsg.type;
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
        
        try {
            const incommingMessage = new IncommingMessage(message);
            if (incommingMessage.type === 0) {
                channelManager.processIncommingChannelItem(
                    incommingMessage.body,
                    ws
                );
                ws.send(
                    JSON.stringify({
                        type: 0,
                        channels: channelManager.channels,
                        channelItemList: channelManager.channelItemList,
                    })
                );
            } else if (incommingMessage.type === 1) {
                incommingMessage.body.channelIds.forEach((channelId) => {
                    const channel = channelManager.channels.find(
                        (c) => c.channelId === channelId
                    );
                    if (channel) {
                        channel.channelItems.forEach((channelItem) => {
                            channelItem.ws.send(incommingMessage.body.csv);
                        });
                    }
                });
            } else if (incommingMessage.type === 2) {
                ws.send("Connected to Server");
            }
        } catch {
            ws.send("Server: Your Message is not allowed");
        }
    });
});