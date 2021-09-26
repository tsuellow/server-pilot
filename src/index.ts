import { GenericServer } from "./GenericServer";
import redis, { RedisClient } from "redis";
import publicIp from 'public-ip';
import privateIp from 'ip';
import os from 'os-utils';
import { exec } from "child_process";

//add code to get ip address
//add ip to ip pool on redis

var clientServer: GenericServer;
var driverServer: GenericServer;
var externalAddress:string;
var internalAddress:string;
var deathWish:boolean=false;


//this is a centralized redis address used for spot instance control exclucively
const redisAddress:string='172.31.31.174';
var locRedisAddress:string='';
const redisConn:redis.RedisClient=redis.createClient(6379,redisAddress,{auth_pass: 'contrasena1234'});
const redisSubscriber:redis.RedisClient=redis.createClient(6379,redisAddress,{auth_pass: 'contrasena1234'});//subscribe to your own private channel
prepareServer();

let statCounter=0;
const interval=setInterval(async ()=>{
  if(externalAddress){
    let extended:boolean=(statCounter>=7);//when true extended stats are provided
    
    let capacity:number= await getCpuFreePromise();
    let time:number= Date.now();
    const value:string= capacity+'|'+time;
    redisConn.hset("genericServers",externalAddress,value);
    if(clientServer!=null && driverServer!=null){
      const clientStats=clientServer.getStats(extended);
      const driverStats=driverServer.getStats(extended);
      const stat={
        timestamp:time,
        ipAddress:externalAddress,
        freeCpu:capacity,
        netClientLatency:driverStats.targetRawLatency-clientStats.ownLatencyOffset,
        netDriverLatency:clientStats.targetRawLatency-driverStats.ownLatencyOffset,
        clientStats:clientStats,
        driverStats:driverStats,
      }
      console.log(stat);
      if(extended){
        statCounter=0;
      }else{
        statCounter++;
      }
    }
  }
},15000)


redisSubscriber.on("message",(chnl:string,msg:string)=>{
  if(msg=='KILL YOURSELF'){
    slowlyKillBothServers(true);
  }
  if(chnl=='redisUpdates'){
    clientServer.resetRedis(msg);
    driverServer.resetRedis(msg);
  }
})



//get public i, get private ip, register on redis and start server

async function prepareServer() {
  try {
    locRedisAddress=await promisifiedGet('redisIp');
    externalAddress=await publicIp.v4();
    internalAddress=privateIp.address();
    startBothServers(internalAddress);
    let value:string=await getCpuFreePlusTime();
    redisConn.hset("genericServers",externalAddress,value);
    redisSubscriber.subscribe(externalAddress);
    redisSubscriber.subscribe("locRedisAddress")
  } catch (error) {
    console.error(error);
  }
}

async function getCpuFreePlusTime():Promise<string> {
  let capacity:number= await getCpuFreePromise();
  let time:number= Date.now();
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
  console.log('connecting to redis: '+locRedisAddress )
  clientServer= new GenericServer(
    "client",
    "driver",
    3000,
    33333,
    ownIp,
    locRedisAddress
  );
  driverServer= new GenericServer(
    "driver",
    "client",
    4000,
    44444,
    ownIp,
    locRedisAddress
  );

  clientServer.startServer();
  driverServer.startServer();
}

function slowlyKillBothServers(trigger:boolean) {
  deathWish=trigger;
  if(trigger){
    redisConn.hdel("genericServers",externalAddress);
  }
  clientServer.setDeathWish(trigger);
  driverServer.setDeathWish(trigger);
}

function promisifiedGet(key:string):Promise<string> {
  return new Promise((resolve, reject)=>{
    redisConn.get(key,(err,reply)=>{
      if(err){
        reject(err);
      }
      if(reply!=null)
      resolve(reply);
    })
  })
}
 