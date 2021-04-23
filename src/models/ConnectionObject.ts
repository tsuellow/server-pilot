import WebSocket from 'ws';
export class ConnectionObject {
    taxiId:number;
    city:string;
    ws:WebSocket;
    dgramChannel:string='0.0.0.0:0';
    receptionChannels:number[]= [];
    timestamp:number=0;

    constructor(taxiId:number, city:string, ws:any) {
        this.taxiId = taxiId;
        this.city = city;
        this.ws = ws;
    }

    addDgramChannel(dgramChanel:string) {
        this.dgramChannel = dgramChanel;
    }

    setReceptionChannels(receptionChannels:number[]) {
        this.receptionChannels = receptionChannels;
    }

    calculatePositiveDelta(incommingChannelIds:number[]) {
        const delta = incommingChannelIds.filter(
            (channelIds) => !this.receptionChannels.includes(channelIds)
        );
        return delta;
    }

    calculateNegativeDelta(incommingChannelIds:number[]) {
        const delta = this.receptionChannels.filter(
            (channelIds) => !incommingChannelIds.includes(channelIds)
        );
        return delta;
    }

    
}
