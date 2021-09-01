"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionObject = void 0;
var ConnectionObject = /** @class */ (function () {
    function ConnectionObject(taxiId, city, ws) {
        this.dgramAddress = '0.0.0.0';
        this.dgramPort = 0;
        this.latestMsg = '';
        this.receptionChannels = [];
        this.timestamp = 0;
        this.taxiId = taxiId;
        this.city = city;
        this.ws = ws;
        this.updateTime();
    }
    ConnectionObject.prototype.updateTime = function () {
        this.timestamp = new Date().getTime();
    };
    ConnectionObject.prototype.addDgramAddress = function (dgramAddress) {
        this.dgramAddress = dgramAddress;
    };
    ConnectionObject.prototype.addDgramPort = function (drgamPort) {
        this.dgramPort = drgamPort;
    };
    ConnectionObject.prototype.setLatestMsg = function (msg) {
        this.latestMsg = msg;
    };
    ConnectionObject.prototype.setReceptionChannels = function (reception) {
        console.log("reset channels got reached");
        this.receptionChannels = reception.slice(0);
    };
    ConnectionObject.prototype.calculatePositiveDelta = function (incommingChannelIds) {
        var _this = this;
        console.log("these are the current channels: ", this.receptionChannels);
        var delta = incommingChannelIds.filter(function (channelIds) { return !_this.receptionChannels.includes(channelIds); });
        return delta;
    };
    ConnectionObject.prototype.calculateNegativeDelta = function (incommingChannelIds) {
        console.log("these are the current channels: ", this.receptionChannels);
        var delta = this.receptionChannels.filter(function (channelIds) { return !incommingChannelIds.includes(channelIds); });
        return delta;
    };
    return ConnectionObject;
}());
exports.ConnectionObject = ConnectionObject;
