import WebSocket from 'ws';

export class ConnectionObject {
    taxiId:number;
    city:string;
    ws:WebSocket;
    dgramAddress:string='0.0.0.0';
    dgramPort:number=0;
    latestMsg:string='';
    receptionChannels:number[]= [];
    timestamp:number=0;

    constructor(taxiId:number, city:string, ws:any) {
        this.taxiId = taxiId;
        this.city = city;
        this.ws = ws;
        this.updateTime();
    }

    updateTime(){
        this.timestamp=new Date().getTime();
    }

    addDgramAddress(dgramAddress:string) {
        this.dgramAddress = dgramAddress;
    }
    addDgramPort(drgamPort:number){
        this.dgramPort=drgamPort;
    }

    setLatestMsg(msg:string){
        this.latestMsg=msg;
    }

    setReceptionChannels(reception:number[]) {
        console.log("reset channels got reached");
        this.receptionChannels = reception.slice(0);
    }

    calculatePositiveDelta(incommingChannelIds:number[]):number[]  {
        console.log("these are the current channels: ",this.receptionChannels);
        const delta:number[]  = incommingChannelIds.filter(
            (channelIds) => !this.receptionChannels.includes(channelIds)
        );
        return delta;
    }

    calculateNegativeDelta(incommingChannelIds:number[]):number[] {
        console.log("these are the current channels: ",this.receptionChannels);
        const delta:number[]  = this.receptionChannels.filter(
            (channelIds) => !incommingChannelIds.includes(channelIds)
        );
        return delta;
    }

    
}
