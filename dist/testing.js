"use strict";
var incomming = [1, 2, 3, 4, 56, 6];
var receiving = [7, 8, 9, 4, 56, 6];
function calculatePositiveDelta(incommingChannelIds, receptionChannels) {
    var delta = incommingChannelIds.filter(function (channelIds) { return !receptionChannels.includes(channelIds); });
    return delta;
}
function calculateNegDelta(incommingChannelIds, receptionChannels) {
    var delta = receptionChannels.filter(function (channelIds) { return !incommingChannelIds.includes(channelIds); });
    return delta;
}
console.log(calculatePositiveDelta(incomming, receiving));
console.log(calculateNegDelta(incomming, receiving));
