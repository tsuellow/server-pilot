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
  ip: string;
  port: number;
}

export class GenericServer2 {
  private deathwish: boolean = false;
  private subscriber: redis.RedisClient; 
  private publisher: redis.RedisClient;
  private distributionChannels: Map<string, Map<number, UdpConn>> = new Map();
  private udpSocket: dgram.Socket = dgram.createSocket("udp4");
  constructor(
    public ownType: string,
    public targetType: string,
    public wsPort: number,
    public udpPort: number,
    public ownIp: string,
    public redisEndpoint: string
  ) {
    this.subscriber= redis.createClient(6379,redisEndpoint);
    this.publisher= redis.createClient(6379,redisEndpoint);
    this.subscriber.subscribe(targetType + "Locations");

    this.subscriber.on("message",  (chnl, message) => {
      console.log("subscription received: " + message);
      let jsonMsg: JsonMsg = JSON.parse(message);
      for (const channel of jsonMsg.targetChannels) {
        const chName: string = getSingleChannelName(
          channel,
          jsonMsg.city,
          this.ownType
        );
        const list = this.distributionChannels.get(chName);
        if (list) {
          console.log(chName);
          for (let [key, value] of list) {
            console.log('taxiId:'+key+' '+value.ip + "::::" + value.port);
            this.udpSocket.send(jsonMsg.payloadCSV, value.port, value.ip);
          }
        }
      }
    });
  }

  public setDeathWish(trigger: boolean) {
    this.deathwish = trigger;
  }

  public resetRedis(endpoint:string){
    //redis client to get counterpart msgs. this is to be executed everytime redis changes
    this.subscriber= redis.createClient(6379,endpoint);
    this.publisher= redis.createClient(6379,endpoint);
    this.subscriber.subscribe(this.targetType + "Locations");

    this.subscriber.on("message",  (chnl, message) => {
      console.log("subscription received: " + message);
      let jsonMsg: JsonMsg = JSON.parse(message);
      for (const channel of jsonMsg.targetChannels) {
        const chName: string = getSingleChannelName(
          channel,
          jsonMsg.city,
          this.ownType
        );
        const list = this.distributionChannels.get(chName);
        if (list) {
          for (let value of list.values()) {
            console.log(value.ip + "::::" + value.port);
            this.udpSocket.send(jsonMsg.payloadCSV, value.port, value.ip);
          }
        }
      }
    });
  }

  startServer(): void {
    const ownType: string = this.ownType;
    const targetType: string = this.targetType;

    //redis client to get datagram recipients ...we will need to pass the redis url later on
    // const subscriber: redis.RedisClient = redis.createClient('rediss://'+this.redisEndpoint+':6379');
    // const publisher: redis.RedisClient = redis.createClient('rediss://'+this.redisEndpoint+':6379');
    // subscriber.subscribe(targetType + "Locations");

    //list of all connected users
    const connectionList: Map<number, ConnectionObject> = new Map();

    //periodically close inactive connections
    
    const interval = setInterval(() => {
      for (const [key, value] of connectionList) {
        if (new Date().getTime() - value.timestamp > 120000) {
          updateOwnChannels(value, []);
          value.ws.close();
          console.log(
            "deletion of taxiId: " +
              value.taxiId +
              " being performed due to caducation on list of size: " +
              connectionList.size
          );
          connectionList.delete(key);
          console.log("new size: " + connectionList.size);
        }
      }
    }, 60000);

    //channel infrastructure
    // const distributionChannels: Map<string, Map<number, UdpConn>> = new Map();

    const wsServer: WebSocket.Server = new WebSocket.Server({
      port: this.wsPort,
    });

    // const udpSocket: dgram.Socket = dgram.createSocket("udp4");
    this.udpSocket.bind(this.udpPort, this.ownIp);

    wsServer.on("listening", (_server: WebSocket.Server) => {
      console.log(ownType + " server is listening on port " + this.wsPort);
    });

    wsServer.on("connection", (ws: WebSocket) => {
      console.log("new connection registered");
      ws.on("message", (message: string) => {
        //type:0 message is in order to perform initial connect process
        //type:1 message is in order to modify reception channels as well as transmitting own location
        //type:2 message is in order to exclusively send own location
        //incomming msg format: {type,taxiId,city,targetChannel?,receptionChannels?,payloadCSV?}
        console.log(message);
        try {
          let jsonMsg: JsonMsg = JSON.parse(message);
          let type: number = jsonMsg.type;

          if (type == 0) {
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
          } else {
            //if type is 1 or 2 publish location payload on redis for counterpart(drivers) to diseminate
            for (var i: number = 0; i < jsonMsg.targetChannels.length; i++) {
              sendOwnLocationOut(
                getSingleChannelName(
                  jsonMsg.targetChannels[i],
                  jsonMsg.city!,
                  targetType
                ),
                message
              );
            }
            let existingConn = connectionList.get(jsonMsg.taxiId);
            if (existingConn) {
              //if deathwish let this connection play russian roulette
              if (this.deathwish && Math.random() <= 0.01) {
                updateOwnChannels(existingConn, []);
                ws.close(1006, "shutting down server");
                console.log(
                  "deletion of taxiId: " +
                    jsonMsg.taxiId +
                    " being performed due to slow suicide procedure"
                );
                connectionList.delete(jsonMsg.taxiId);
              } else {
                existingConn.updateTime();
                existingConn.setLatestMsg(message);
                //if type=2 find channel delta and tell distributionList to add and remove connection from corresponding channels
                if (type == 2) {
                  updateOwnChannels(existingConn, jsonMsg.receptionChannels);
                }
              }
            }
          }
        } catch {
          ws.send("ILLEGAL MSG");
        }
      });

      //when connection is ended the client is first removed from the delivery group
      ws.on("close", (code: number, reason: string) => {
        for (let [key, value] of connectionList) {
          if (ws == value.ws) {
            let conn = connectionList.get(key);
            //@ts-ignore
            console.log(
              "disconnecting taxiId: " +
                conn?.taxiId +
                " code:" +
                code +
                " reason:" +
                reason
            );
            if (code == 1006) {
              try {
                let latestMsg: JsonMsg = JSON.parse(value.latestMsg);
                for (
                  var i: number = 0;
                  i < latestMsg.targetChannels.length;
                  i++
                ) {
                  sendOwnLocationOut(
                    getSingleChannelName(
                      latestMsg.targetChannels[i],
                      latestMsg.city!,
                      targetType
                    ),
                    JSON.stringify(createClosingMsg(latestMsg))
                  );
                }
              } catch {
                console.log("failed to send closing msg");
              }
            }
            updateOwnChannels(conn!, []);
            connectionList.delete(key);
            console.log("new size: " + connectionList.size);
            return;
          }
        }
      });
    });

    // this.subscriber.on("message",  (chnl, message) => {
    //   console.log("subscription received: " + message);
    //   let jsonMsg: JsonMsg = JSON.parse(message);
    //   for (const channel of jsonMsg.targetChannels) {
    //     const chName: string = getSingleChannelName(
    //       channel,
    //       jsonMsg.city,
    //       ownType
    //     );
    //     const list = this.distributionChannels.get(chName);
    //     if (list) {
    //       for (let value of list.values()) {
    //         console.log(value.ip + "::::" + value.port);
    //         this.udpSocket.send(jsonMsg.payloadCSV, value.port, value.ip);
    //       }
    //     }
    //   }
    // });

    this.udpSocket.on("message",  (message, remote) => {
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
          this.udpSocket.send(
            "udp hole successfully punched",
            remote.port,
            remote.address
          ); //see if this arrives successfully at android
        } catch {
          console.warn("failed to process incomming UDP datagram");
        }
      }
    });

    //this function creates a generic closing msg for when a user gets disconnected abruptly
    function createClosingMsg(lastMsg: JsonMsg): JsonMsg {
      lastMsg.payloadCSV = lastMsg.payloadCSV.slice(0, -1) + "0";
      return lastMsg;
    }

    //this function sends my location to all parties in the channel delivery group
    const sendOwnLocationOut = (channel: string, msg: string): void => {
      console.log("getting channel: " + channel);
      this.publisher.publish(ownType + "Locations", msg);
    }

    //this function updates the channels tuned into
    const updateOwnChannels = (
      connObj: ConnectionObject,
      newChannels: number[],
      resetAll = false
    ): void => {
      if (resetAll) {
        //this is when the UDP IP or port changes while the ws connection persists
        //here we find all existing subscriptions and change the ip:port string to match the new one
        let toModify: string[] = getMultipleChannelNames(
          connObj.receptionChannels,
          connObj.city,
          ownType
        );
        for (const iterator of toModify) {
          if (this.distributionChannels.has(iterator)) {
            this.distributionChannels
              .get(iterator)
              ?.set(connObj.taxiId, {
                ip: connObj.dgramAddress,
                port: connObj.dgramPort,
              });
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
          if (this.distributionChannels.has(iterator)) {
            console.log("removing",connObj.taxiId+" from "+iterator);
            this.distributionChannels.get(iterator)?.delete(connObj.taxiId);
          }
        }

        for (const iterator of toAdd) {
          console.log("adding",connObj.taxiId+" to "+iterator);
          if (!this.distributionChannels.has(iterator)) {
            this.distributionChannels.set(iterator, new Map());
          }
          this.distributionChannels
            .get(iterator)
            ?.set(connObj.taxiId, {
              ip: connObj.dgramAddress,
              port: connObj.dgramPort,
            });
        }
      }
      connObj.setReceptionChannels(newChannels);
    }
  }
}
