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

interface StatsObject{
  ownLatencyOffset:number;
  targetRawLatency:number;
  numOfUsers:number;
  numOfConnections:number;
  channelSizeMap:Map<string,number>;
}

export class GenericServer {
  private deathwish: boolean = false;
  private subscriber: redis.RedisClient; 
  private publisher: redis.RedisClient;
  private distributionChannels: Map<string, Map<number, UdpConn>> = new Map();
  private udpSocket: dgram.Socket = dgram.createSocket("udp4");
  private connectionList: Map<number, ConnectionObject> = new Map(); //list of all connected users

  //performance variables
  private ownLatencyOffset:number=0; //difference between msg and server timestamp on msg arrival
  private targetRawLatency:number=1000; //difference between msg and server timestamp on msg processed and distributed
  private numOfUsers:number=0; //size of connectionlist
  private numOfConnections:number=0; //size of ws.CLIENTS
  private channelSizeMap:Map<string,number>=new Map(); //map of reception channel distribution list size
  
  
  constructor(
    public ownType: string,
    public targetType: string,
    public wsPort: number,
    public udpPort: number,
    public ownIp: string,
    public redisEndpoint: string
  ) {
    //this is the same code as in resetRedis()
    this.subscriber= redis.createClient(6379,redisEndpoint);
    this.publisher= redis.createClient(6379,redisEndpoint);
    this.subscriber.subscribe(targetType + "Locations");

    this.subscriber.on("message",  (chnl, message) => {
      let jsonMsg: JsonMsg = JSON.parse(message);
      for (const channel of jsonMsg.targetChannels) {
        const chName: string = getSingleChannelName(
          channel,
          jsonMsg.city,
          this.ownType
        );
        const list = this.distributionChannels.get(chName);
        if (list) {
          for (let [key, value] of list) {
            this.udpSocket.send(jsonMsg.payloadCSV, value.port, value.ip);
          }
        }
      }
      //update statistics
      if(jsonMsg.type==2){
        this.targetRawLatency=this.resetLatency(jsonMsg,this.targetRawLatency);
      }
    });
  }

  public setDeathWish(trigger: boolean) {
    this.deathwish = trigger;
  }

  public getStats():StatsObject{
    return {
      ownLatencyOffset:this.ownLatencyOffset,
      targetRawLatency:this.targetRawLatency,
      numOfUsers:this.connectionList.size,
      numOfConnections:this.numOfConnections,
      channelSizeMap:this.getChannelDensity()
    }
  }

  public resetRedis(endpoint:string){
    //redis client to get counterpart msgs. this is to be executed everytime redis changes
    this.subscriber= redis.createClient(6379,endpoint);
    this.publisher= redis.createClient(6379,endpoint);
    this.subscriber.subscribe(this.targetType + "Locations");

    this.subscriber.on("message",  (chnl, message) => {
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
            this.udpSocket.send(jsonMsg.payloadCSV, value.port, value.ip);
          }
        }
      }
      //update statistics
      if(jsonMsg.type==2){
        this.targetRawLatency=this.resetLatency(jsonMsg,this.targetRawLatency);
      }
    });
  }

  //statistics methods
  private getTimestamp(jsonMsg:JsonMsg):number{
    return +jsonMsg.payloadCSV.split('|')[3];
  }
  private resetLatency(jsonMsg:JsonMsg,target:number):number{
      const currentlatency:number=Date.now()-this.getTimestamp(jsonMsg);
      return (currentlatency+(this.connectionList.size-1)*target)/this.connectionList.size;
  }
  private getChannelDensity():Map<string,number>{
    let result:Map<string,number>=new Map();
    for (const [key, value] of this.distributionChannels) {
      result.set(key,value.size);
    }
    return result;
  }

  startServer(): void {
    const ownType: string = this.ownType;
    const targetType: string = this.targetType;

    //periodically close inactive connections
    const interval = setInterval(() => {
      for (const [key, value] of this.connectionList) {
        if (new Date().getTime() - value.timestamp > 120000) {
          updateOwnChannels(value, []);
          value.ws.close();
          this.connectionList.delete(key);
          console.log("new size: " + this.connectionList.size);
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
      this.numOfConnections=wsServer.clients.size;
      ws.on("message", (message: string) => {
        //type:0 message is in order to perform initial connect process
        //type:1 message is in order to modify reception channels as well as transmitting own location
        //type:2 message is in order to exclusively send own location
        //incomming msg format: {type,taxiId,city,targetChannel?,receptionChannels?,payloadCSV?}
        
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
            this.connectionList.set(jsonMsg.taxiId, conn);
            var response = { type: 0, action: "SEND UDP" };
            ws.send(JSON.stringify(response));
            
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
            let existingConn = this.connectionList.get(jsonMsg.taxiId);
            if (existingConn) {
              //if deathwish let this connection play russian roulette
              if (this.deathwish && Math.random() <= 0.01) {
                updateOwnChannels(existingConn, []);
                ws.close(1006, "shutting down server");
                this.connectionList.delete(jsonMsg.taxiId);
              } else {
                existingConn.updateTime();
                existingConn.setLatestMsg(message);
                //if type=2 find channel delta and tell distributionList to add and remove connection from corresponding channels
                if (type == 2) {
                  updateOwnChannels(existingConn, jsonMsg.receptionChannels);
                  //update statistics
                  this.ownLatencyOffset=this.resetLatency(jsonMsg,this.ownLatencyOffset);
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
        for (let [key, value] of this.connectionList) {
          if (ws == value.ws) {
            let conn = this.connectionList.get(key);
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
            try{
              updateOwnChannels(conn!, []);
            }finally{
              this.connectionList.delete(key);
              console.log("new size: " + this.connectionList.size);
              return;
            }
          }
        }
      });
    });


    this.udpSocket.on("message",  (message, remote) => {
      
      const jsonMsg = JSON.parse(message.toString());
      const taxiId: number = jsonMsg.taxiId;
      const type: number = jsonMsg.type;
      if (type == 0) {
        try {
          const connObj = this.connectionList.get(taxiId);
          connObj?.addDgramAddress(remote.address);
          connObj?.addDgramPort(remote.port);
          //@ts-ignore
          updateOwnChannels(connObj, [], true); //change all ip:port data to the newly arrived ip:port
          const response = { type: 0, action: "SEND LOC" }; //in this step android needs to calculate its reception channels and send them
        
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
            this.distributionChannels.get(iterator)?.delete(connObj.taxiId);
          }
        }

        for (const iterator of toAdd) {
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
        this.connectionList.get(connObj.taxiId)?.setReceptionChannels(newChannels);
      }
      
      //connObj.setReceptionChannels(newChannels);
    }
  }
}
