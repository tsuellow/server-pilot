import { GenericServer2 } from "./GenericServer2";
import redis, { RedisClient } from "redis";
import publicIp from 'public-ip';
import privateIp from 'ip';
import os from 'os-utils'

//add code to get ip address
//add ip to ip pool on redis

var clientServer: GenericServer2;
var driverServer: GenericServer2;
var externalAddress:string;
var internalAddress:string;
var deathWish:boolean=false;


//replace with parameter added at 'node index.js #redisaddress' execution
const redisAddress:string="redis://redisserver.3uqrcc.0001.use1.cache.amazonaws.com:6379";
const redisConn:redis.RedisClient=redis.createClient(redisAddress);
const redisSubscriber:redis.RedisClient=redis.createClient(redisAddress);
prepareServer();

const interval=setInterval(async ()=>{
  if(externalAddress){
    let value:string=await getCpuFreePlusTime();
    redisConn.hset("genericServers",externalAddress,value);
  }
},15000)


redisSubscriber.on("message",(chnl:string,msg:string)=>{
  if(msg=='KILL YOURSELF'){
    //slowlyKillBothServers();
  }
})

//get public i, get private ip, register on redis and start server

async function prepareServer() {
  try {
    externalAddress=await publicIp.v4();
    internalAddress=await privateIp.address();
    startBothServers(internalAddress);
    let value:string=await getCpuFreePlusTime();
    redisConn.hset("genericServers",externalAddress,value);
    redisSubscriber.subscribe(externalAddress);
  } catch (error) {
    console.error(error);
  }
}

async function getCpuFreePlusTime():Promise<string> {
  let capacity:number= await getCpuFreePromise();
  let time:number= new Date().getTime();
  return capacity+'|'+time;
}

//promise to get own public ip
function getCpuFreePromise(){
  return new Promise<number>((resolve,reject)=>{
    let cpuFree= os.cpuFree((v)=>{
      resolve(v);
    })
  });
}



function startBothServers(ownIp:string) {
  clientServer= new GenericServer2(
    "client",
    "driver",
    3000,
    33333,
    ownIp,
    redisAddress
  );
  driverServer= new GenericServer2(
    "driver",
    "client",
    4000,
    44444,
    ownIp,
    redisAddress
  );

  clientServer.startServer();
  driverServer.startServer();
}

function slowlyKillBothServers(trigger:boolean) {
  deathWish=trigger;
  if(trigger){
    redisConn.hdel("genericServers",externalAddress);
  }
  clientServer.deathwish=trigger;
  driverServer.deathwish=trigger;
}
 