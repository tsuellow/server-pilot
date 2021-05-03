import WebSocket from "ws";
import dgram from "dgram";
import redis from "redis";
import { ConnectionObject } from "./models/ConnectionObject";
import { getSingleChannelName, getMultipleChannelNames } from "./models/utils";

interface JsonMsg {
  type: number;
  taxiId: number;
  city: string;
  targetChannels: number[];
  receptionChannels: number[];
  payloadCSV: string;
}

interface UdpConn {
  ip:string;
  port:number;
}

export class GenericServer2 {
  constructor(
    public ownType: string,
    public targetType: string,
    public wsPort: number,
    public udpPort: number,
    public ownIp: string
  ) {}

  startServer(): void {
    const ownType: string = this.ownType;
    const targetType: string = this.targetType;

    //redis client to get datagram recipients ...we will need to pass the redis url later on
    const subscriber: redis.RedisClient = redis.createClient("redis://redis-conn-store.3uqrcc.ng.0001.use1.cache.amazonaws.com:6379");
    const publisher: redis.RedisClient = redis.createClient("redis://redis-conn-store.3uqrcc.ng.0001.use1.cache.amazonaws.com:6379");
    subscriber.subscribe(targetType+"Locations");

    //list of all connected users
    const connectionList: Map<number, ConnectionObject> = new Map();

    //channel infrastructure
    const distributionChannels:Map<string,Map<number,UdpConn>>=new Map();

    const wsServer: WebSocket.Server = new WebSocket.Server({
      port: this.wsPort,
    });

    const udpSocket: dgram.Socket = dgram.createSocket("udp4");
    udpSocket.bind(this.udpPort, this.ownIp);

    const otherUdp: dgram.Socket =dgram.createSocket("udp4");

    wsServer.on("listening", (server: WebSocket.Server) => {
      console.log(ownType+" server is listening on port "+this.wsPort);
    });

    wsServer.on("connection", (ws: WebSocket) => {
      console.log("new connection registered")
      ws.on("message", (message: string) => {
        //type:0 message is in order to perform initial connect process
        //type:1 message is in order to modify reception channels as well as transmitting own location
        //type:2 message is in order to exclusively send own location
        //incomming msg format: {type,taxiId,city,targetChannel?,receptionChannels?,payloadCSV?}
        console.log(message);
        try {
          let jsonMsg: JsonMsg = JSON.parse(message);
          let type: number = jsonMsg.type;

          switch (type) {
            case 0:
              // connection process: add to connection list and tell user to send matching dgram for connection matching
              let conn: ConnectionObject = new ConnectionObject(
                jsonMsg.taxiId,
                jsonMsg.city,
                ws
              );
              connectionList.set(jsonMsg.taxiId, conn);
              var response = { type: 0, action: "SEND UDP" };
              ws.send(JSON.stringify(response));
              console.log(response);
              break;
            case 2:
              // 2 processes:
              //1. publish location payload on redis for counterpart(drivers) to diseminate
              //2. find channel delta and tell redis add and remove connection from corresponding channels
              for (var i:number=0;i<jsonMsg.targetChannels.length;i++) {
                sendOwnLocationOut(
                  getSingleChannelName(
                    jsonMsg.targetChannels[i],
                    jsonMsg.city!,
                    targetType
                  ),
                  jsonMsg.payloadCSV
                );
              }
              
              let existingConn = connectionList.get(jsonMsg.taxiId);
              if (existingConn) {
                updateOwnChannels(existingConn, jsonMsg.receptionChannels);
              }
              break;
            default:
              // publish location payload on redis for counterpart(drivers) to diseminate
              for (var i:number=0;i<jsonMsg.targetChannels.length;i++) {
                sendOwnLocationOut(
                  getSingleChannelName(
                    jsonMsg.targetChannels[i],
                    jsonMsg.city!,
                    targetType
                  ),
                  message
                );
              }
          }
        } catch {
          ws.send("illegal msg");
        }
      });

      //when connection is ended the client is first removed from the delivery group
      ws.on("close", (code: number, reason: string) => {
        for (let [key, value] of connectionList) {
          if (ws == value.ws) {
            let conn = connectionList.get(key);
            //@ts-ignore
            updateOwnChannels(conn, []);
            connectionList.delete(key);
            return;
          }
        }
      });
    });

    subscriber.on("message",function (chnl,message) {
      let jsonMsg: JsonMsg = JSON.parse(message);
      console.log("subscription received: "+message)
      for (const channel of jsonMsg.targetChannels) {
        const chName:string=getSingleChannelName(channel,jsonMsg.city,ownType);
        const list=distributionChannels.get(chName);
        if(list){
          for (let value of list.values()) {
            console.log(value.ip+"::::"+value.port);
            udpSocket.send(jsonMsg.payloadCSV,value.port,value.ip);
          }
        }
      }
    })

    udpSocket.on("message", function (message, remote) {
      console.log(remote.address + ":" + remote.port + " - " + message);
      const jsonMsg = JSON.parse(message.toString());
      const taxiId: number = jsonMsg.taxiId;
      const type: number = jsonMsg.type;
      if (type == 0) {
        try {
          const connObj = connectionList.get(taxiId);
          connObj?.addDgramAddress(remote.address);
          connObj?.addDgramPort(remote.port);
          //@ts-ignore
          updateOwnChannels(connObj, [], true); //change all ip:port data to the newly arrived ip:port
          const response = { type: 0, action: "SEND LOC" }; //in this step android needs to calculate its reception channels and send them
          console.log(response);
          connObj?.ws.send(JSON.stringify(response));
          udpSocket.send("testMsj",remote.port,remote.address);
        } catch {
          console.warn("failed to process incomming UDP datagram");
        }
      }
    });

    //this function sends my location to all parties in the channel delivery group
    function sendOwnLocationOut(channel: string, msg: string): void {
      console.log("getting channel: "+channel);
      publisher.publish(ownType+"Locations",msg);
    }

    //this function updates the channels tuned into
    function updateOwnChannels(
      connObj: ConnectionObject,
      newChannels: number[],
      resetAll = false
    ): void {
      if (resetAll) {
        //this is when the UDP IP or port changes while the ws connection persists
        //here we find all existing subscriptions and change the ip:port string to match the new one
        let toModify: string[] = getMultipleChannelNames(
          connObj.receptionChannels,
          connObj.city,
          ownType
        );
        for (const iterator of toModify) {
          if(distributionChannels.has(iterator)){
            distributionChannels.get(iterator)?.set(connObj.taxiId,{ip:connObj.dgramAddress,port:connObj.dgramPort});
          }
         
        }
      } else {
        //this is for when the user moves and wishes to be subscribed to new (hexagon)channels and unsusbscribes from others
        //here we add and remove the client from the corresponding channels (should happen more often for drivers than for clients)
        let toRemove: string[] = getMultipleChannelNames(
          connObj.calculateNegativeDelta(newChannels),
          connObj.city,
          ownType
        );
        let toAdd: string[] = getMultipleChannelNames(
          connObj.calculatePositiveDelta(newChannels),
          connObj.city,
          ownType
        );

        for (const iterator of toRemove) {
          if(distributionChannels.has(iterator)){
            distributionChannels.get(iterator)?.delete(connObj.taxiId);
          }
        }

        for (const iterator of toAdd) {
          console.log(iterator);
          if(!distributionChannels.has(iterator)){
            distributionChannels.set(iterator,new Map())
          }
          distributionChannels.get(iterator)?.set(connObj.taxiId,{ip:connObj.dgramAddress,port:connObj.dgramPort});
        }
      }
    }
  }
}
