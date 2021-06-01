"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionObject = void 0;
var ConnectionObject = /** @class */ (function () {
    function ConnectionObject(taxiId, city, ws) {
        this.dgramAddress = '0.0.0.0';
        this.dgramPort = 0;
        this.targetChannels = [];
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
    ConnectionObject.prototype.setTargetChannels = function (targetChannels) {
        this.targetChannels = targetChannels;
    };
    ConnectionObject.prototype.setReceptionChannels = function (receptionChannels) {
        this.receptionChannels = receptionChannels;
    };
    ConnectionObject.prototype.calculatePositiveDelta = function (incommingChannelIds) {
        var _this = this;
        var delta = incommingChannelIds.filter(function (channelIds) { return !_this.receptionChannels.includes(channelIds); });
        return delta;
    };
    ConnectionObject.prototype.calculateNegativeDelta = function (incommingChannelIds) {
        var delta = this.receptionChannels.filter(function (channelIds) { return !incommingChannelIds.includes(channelIds); });
        return delta;
    };
    return ConnectionObject;
}());
exports.ConnectionObject = ConnectionObject;
