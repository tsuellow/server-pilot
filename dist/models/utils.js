"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMultipleChannelNames = exports.getSingleChannelName = void 0;
function getSingleChannelName(channel, city, participantType) {
    var channelName = city + '_' + participantType + '_' + channel;
    return channelName;
}
exports.getSingleChannelName = getSingleChannelName;
function getMultipleChannelNames(channel, city, participantType) {
    var result = [];
    var size = channel.length;
    for (var i = 0; i < size; i++) {
        result[i] = getSingleChannelName(channel[i], city, participantType);
    }
    return result;
}
exports.getMultipleChannelNames = getMultipleChannelNames;
