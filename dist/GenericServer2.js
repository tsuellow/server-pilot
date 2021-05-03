"use strict";
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenericServer2 = void 0;
var ws_1 = __importDefault(require("ws"));
var dgram_1 = __importDefault(require("dgram"));
var redis_1 = __importDefault(require("redis"));
var ConnectionObject_1 = require("./models/ConnectionObject");
var utils_1 = require("./models/utils");
var GenericServer2 = /** @class */ (function () {
    function GenericServer2(ownType, targetType, wsPort, udpPort, ownIp) {
        this.ownType = ownType;
        this.targetType = targetType;
        this.wsPort = wsPort;
        this.udpPort = udpPort;
        this.ownIp = ownIp;
    }
    GenericServer2.prototype.startServer = function () {
        var _this = this;
        var ownType = this.ownType;
        var targetType = this.targetType;
        //redis client to get datagram recipients ...we will need to pass the redis url later on
        var subscriber = redis_1.default.createClient("redis://redis-conn-store.3uqrcc.ng.0001.use1.cache.amazonaws.com:6379");
        var publisher = redis_1.default.createClient("redis://redis-conn-store.3uqrcc.ng.0001.use1.cache.amazonaws.com:6379");
        //list of all connected users
        var connectionList = new Map();
        //channel infrastructure
        var distributionChannels = new Map();
        var wsServer = new ws_1.default.Server({
            port: this.wsPort,
        });
        var udpSocket = dgram_1.default.createSocket("udp4");
        udpSocket.bind(this.udpPort, this.ownIp);
        var otherUdp = dgram_1.default.createSocket("udp4");
        wsServer.on("listening", function (server) {
            console.log(ownType + " server is listening on port " + _this.wsPort);
        });
        wsServer.on("connection", function (ws) {
            console.log("new connection registered");
            ws.on("message", function (message) {
                //type:0 message is in order to perform initial connect process
                //type:1 message is in order to modify reception channels as well as transmitting own location
                //type:2 message is in order to exclusively send own location
                //incomming msg format: {type,taxiId,city,targetChannel?,receptionChannels?,payloadCSV?}
                console.log(message);
                try {
                    var jsonMsg = JSON.parse(message);
                    var type = jsonMsg.type;
                    switch (type) {
                        case 0:
                            // connection process: add to connection list and tell user to send matching dgram for connection matching
                            var conn = new ConnectionObject_1.ConnectionObject(jsonMsg.taxiId, jsonMsg.city, ws);
                            connectionList.set(jsonMsg.taxiId, conn);
                            var response = { type: 0, action: "SEND UDP" };
                            ws.send(JSON.stringify(response));
                            console.log(response);
                            break;
                        case 2:
                            // 2 processes:
                            //1. publish location payload on redis for counterpart(drivers) to diseminate
                            //2. find channel delta and tell redis add and remove connection from corresponding channels
                            for (var i = 0; i < jsonMsg.targetChannels.length; i++) {
                                sendOwnLocationOut(utils_1.getSingleChannelName(jsonMsg.targetChannels[i], jsonMsg.city, targetType), jsonMsg.payloadCSV);
                            }
                            var existingConn = connectionList.get(jsonMsg.taxiId);
                            if (existingConn) {
                                updateOwnChannels(existingConn, jsonMsg.receptionChannels);
                            }
                            break;
                        default:
                            // publish location payload on redis for counterpart(drivers) to diseminate
                            for (var i = 0; i < jsonMsg.targetChannels.length; i++) {
                                sendOwnLocationOut(utils_1.getSingleChannelName(jsonMsg.targetChannels[i], jsonMsg.city, targetType), message);
                            }
                    }
                }
                catch (_a) {
                    ws.send("illegal msg");
                }
            });
            //when connection is ended the client is first removed from the delivery group
            ws.on("close", function (code, reason) {
                var e_1, _a;
                try {
                    for (var connectionList_1 = __values(connectionList), connectionList_1_1 = connectionList_1.next(); !connectionList_1_1.done; connectionList_1_1 = connectionList_1.next()) {
                        var _b = __read(connectionList_1_1.value, 2), key = _b[0], value = _b[1];
                        if (ws == value.ws) {
                            var conn = connectionList.get(key);
                            //@ts-ignore
                            updateOwnChannels(conn, []);
                            connectionList.delete(key);
                            return;
                        }
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (connectionList_1_1 && !connectionList_1_1.done && (_a = connectionList_1.return)) _a.call(connectionList_1);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
            });
        });
        subscriber.on(targetType + "Locations", function (msg) {
            var e_2, _a, e_3, _b;
            var jsonMsg = JSON.parse(msg);
            console.log("subscription received: " + jsonMsg.payloadCSV);
            try {
                for (var _c = __values(jsonMsg.targetChannels), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var channel = _d.value;
                    var chName = utils_1.getSingleChannelName(channel, jsonMsg.city, ownType);
                    var list = distributionChannels.get(chName);
                    if (list) {
                        try {
                            for (var _e = (e_3 = void 0, __values(list.values())), _f = _e.next(); !_f.done; _f = _e.next()) {
                                var value = _f.value;
                                console.log(value.ip + "::::" + value.port);
                                udpSocket.send(jsonMsg.payloadCSV, value.port, value.ip);
                            }
                        }
                        catch (e_3_1) { e_3 = { error: e_3_1 }; }
                        finally {
                            try {
                                if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                            }
                            finally { if (e_3) throw e_3.error; }
                        }
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                }
                finally { if (e_2) throw e_2.error; }
            }
        });
        udpSocket.on("message", function (message, remote) {
            console.log(remote.address + ":" + remote.port + " - " + message);
            var jsonMsg = JSON.parse(message.toString());
            var taxiId = jsonMsg.taxiId;
            var type = jsonMsg.type;
            if (type == 0) {
                try {
                    var connObj = connectionList.get(taxiId);
                    connObj === null || connObj === void 0 ? void 0 : connObj.addDgramAddress(remote.address);
                    connObj === null || connObj === void 0 ? void 0 : connObj.addDgramPort(remote.port);
                    //@ts-ignore
                    updateOwnChannels(connObj, [], true); //change all ip:port data to the newly arrived ip:port
                    var response = { type: 0, action: "SEND LOC" }; //in this step android needs to calculate its reception channels and send them
                    console.log(response);
                    connObj === null || connObj === void 0 ? void 0 : connObj.ws.send(JSON.stringify(response));
                    udpSocket.send("testMsj", remote.port, remote.address);
                }
                catch (_a) {
                    console.warn("failed to process incomming UDP datagram");
                }
            }
        });
        //this function sends my location to all parties in the channel delivery group
        function sendOwnLocationOut(channel, msg) {
            console.log("getting channel: " + channel);
            publisher.publish(ownType + "Locations", msg);
        }
        //this function updates the channels tuned into
        function updateOwnChannels(connObj, newChannels, resetAll) {
            var e_4, _a, e_5, _b, e_6, _c;
            var _d, _e, _f;
            if (resetAll === void 0) { resetAll = false; }
            if (resetAll) {
                //this is when the UDP IP or port changes while the ws connection persists
                //here we find all existing subscriptions and change the ip:port string to match the new one
                var toModify = utils_1.getMultipleChannelNames(connObj.receptionChannels, connObj.city, ownType);
                try {
                    for (var toModify_1 = __values(toModify), toModify_1_1 = toModify_1.next(); !toModify_1_1.done; toModify_1_1 = toModify_1.next()) {
                        var iterator = toModify_1_1.value;
                        if (distributionChannels.has(iterator)) {
                            (_d = distributionChannels.get(iterator)) === null || _d === void 0 ? void 0 : _d.set(connObj.taxiId, { ip: connObj.dgramAddress, port: connObj.dgramPort });
                        }
                    }
                }
                catch (e_4_1) { e_4 = { error: e_4_1 }; }
                finally {
                    try {
                        if (toModify_1_1 && !toModify_1_1.done && (_a = toModify_1.return)) _a.call(toModify_1);
                    }
                    finally { if (e_4) throw e_4.error; }
                }
            }
            else {
                //this is for when the user moves and wishes to be subscribed to new (hexagon)channels and unsusbscribes from others
                //here we add and remove the client from the corresponding channels (should happen more often for drivers than for clients)
                var toRemove = utils_1.getMultipleChannelNames(connObj.calculateNegativeDelta(newChannels), connObj.city, ownType);
                var toAdd = utils_1.getMultipleChannelNames(connObj.calculatePositiveDelta(newChannels), connObj.city, ownType);
                try {
                    for (var toRemove_1 = __values(toRemove), toRemove_1_1 = toRemove_1.next(); !toRemove_1_1.done; toRemove_1_1 = toRemove_1.next()) {
                        var iterator = toRemove_1_1.value;
                        if (distributionChannels.has(iterator)) {
                            (_e = distributionChannels.get(iterator)) === null || _e === void 0 ? void 0 : _e.delete(connObj.taxiId);
                        }
                    }
                }
                catch (e_5_1) { e_5 = { error: e_5_1 }; }
                finally {
                    try {
                        if (toRemove_1_1 && !toRemove_1_1.done && (_b = toRemove_1.return)) _b.call(toRemove_1);
                    }
                    finally { if (e_5) throw e_5.error; }
                }
                try {
                    for (var toAdd_1 = __values(toAdd), toAdd_1_1 = toAdd_1.next(); !toAdd_1_1.done; toAdd_1_1 = toAdd_1.next()) {
                        var iterator = toAdd_1_1.value;
                        console.log(iterator);
                        if (!distributionChannels.has(iterator)) {
                            distributionChannels.set(iterator, new Map());
                        }
                        (_f = distributionChannels.get(iterator)) === null || _f === void 0 ? void 0 : _f.set(connObj.taxiId, { ip: connObj.dgramAddress, port: connObj.dgramPort });
                    }
                }
                catch (e_6_1) { e_6 = { error: e_6_1 }; }
                finally {
                    try {
                        if (toAdd_1_1 && !toAdd_1_1.done && (_c = toAdd_1.return)) _c.call(toAdd_1);
                    }
                    finally { if (e_6) throw e_6.error; }
                }
            }
        }
    };
    return GenericServer2;
}());
exports.GenericServer2 = GenericServer2;