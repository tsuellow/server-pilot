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

export class GenericServer {
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
    const redisClient: redis.RedisClient = redis.createClient("redis://redis-conn-store.3uqrcc.ng.0001.use1.cache.amazonaws.com:6379");

    //list of all connected users
    const connectionList: Map<number, ConnectionObject> = new Map();

    const wsServer: WebSocket.Server = new WebSocket.Server({
      port: this.wsPort,
    });

    const udpSocket: dgram.Socket = dgram.createSocket("udp4");
    udpSocket.bind(this.udpPort, this.ownIp);

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
                  jsonMsg.payloadCSV
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

    udpSocket.on("message", function (message, remote) {
      console.log(remote.address + ":" + remote.port + " - " + message);
      const jsonMsg = JSON.parse(message.toString());
      const taxiId: number = jsonMsg.taxiId;
      const type: number = jsonMsg.type;
      if (type == 0) {
        try {
          const connObj = connectionList.get(taxiId);
          connObj?.addDgramChannel(remote.address + ":" + remote.port);
          //@ts-ignore
          updateOwnChannels(connObj, [], true); //change all ip:port data to the newly arrived ip:port
          const response = { type: 0, action: "SEND LOC" }; //in this step android needs to calculate its reception channels and send them
          console.log(response);
          connObj?.ws.send(JSON.stringify(response));
        } catch {
          console.warn("failed to process incomming UDP datagram");
        }
      }
    });

    //this function sends my location to all parties in the channel delivery group
    function sendOwnLocationOut(channel: string, payload: string): void {
      console.log("getting channel: "+channel);
      redisClient.hvals(channel, function (error, addresses) {
        let size = addresses.length;
        var payloadBuffer: Buffer = Buffer.from(payload);
        for (var i = 0; i < size; i++) {
          console.log(addresses[i]);
          var port: number = +addresses[i].split(":")[1];
          var ip: string = addresses[i].split(":")[0];
          udpSocket.send(payloadBuffer, 0, payloadBuffer.length, port, ip);
        }
      });
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
          redisClient.hset(
            iterator,
            connObj.taxiId.toString(),
            connObj.dgramChannel
          );
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
          redisClient.hdel(iterator, connObj.taxiId.toString());
        }

        for (const iterator of toAdd) {
          console.log(iterator);
          redisClient.hset(
            iterator,
            connObj.taxiId.toString(),
            connObj.dgramChannel
          );
        }
      }
    }
  }
}
