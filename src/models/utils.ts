
export function getSingleChannelName(channel:number, city:string, participantType:string):string{
    const channelName:string=city+'_'+participantType+'_'+channel;
    return channelName;
}

export function getMultipleChannelNames(channel:number[], city:string, participantType:string):string[]{
    var result:string[]=[];
    const size:number=channel.length
    for(var i=0;i<size;i++){
        result[i]=getSingleChannelName(channel[i],city,participantType);
    }
    return result;
}
