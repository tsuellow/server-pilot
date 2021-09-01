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

    setReceptionChannels(receptionChannels:number[]) {
        this.receptionChannels = receptionChannels;
    }

    calculatePositiveDelta(incommingChannelIds:number[]):number[]  {
        const delta:number[]  = incommingChannelIds.filter(
            (channelIds) => !this.receptionChannels.includes(channelIds)
        );
        return delta;
    }

    calculateNegativeDelta(incommingChannelIds:number[]):number[] {
        const delta:number[]  = this.receptionChannels.filter(
            (channelIds) => !incommingChannelIds.includes(channelIds)
        );
        return delta;
    }

    
}
