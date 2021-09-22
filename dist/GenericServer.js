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
exports.GenericServer = void 0;
var ws_1 = __importDefault(require("ws"));
var dgram_1 = __importDefault(require("dgram"));
var redis_1 = __importDefault(require("redis"));
var ConnectionObject_1 = require("./models/ConnectionObject");
var utils_1 = require("./models/utils");
var GenericServer = /** @class */ (function () {
    function GenericServer(ownType, targetType, wsPort, udpPort, ownIp, redisEndpoint) {
        var _this = this;
        this.ownType = ownType;
        this.targetType = targetType;
        this.wsPort = wsPort;
        this.udpPort = udpPort;
        this.ownIp = ownIp;
        this.redisEndpoint = redisEndpoint;
        this.deathwish = false;
        this.distributionChannels = new Map();
        this.udpSocket = dgram_1.default.createSocket("udp4");
        this.connectionList = new Map(); //list of all connected users
        //performance variables
        this.ownLatencyOffset = 0; //difference between msg and server timestamp on msg arrival
        this.targetRawLatency = 1000; //difference between msg and server timestamp on msg processed and distributed
        this.numOfUsers = 0; //size of connectionlist
        this.numOfConnections = 0; //size of ws.CLIENTS
        this.channelSizeMap = new Map(); //map of reception channel distribution list size
        //this is the same code as in resetRedis()
        this.subscriber = redis_1.default.createClient(6379, redisEndpoint);
        this.publisher = redis_1.default.createClient(6379, redisEndpoint);
        this.subscriber.subscribe(targetType + "Locations");
        this.subscriber.on("message", function (chnl, message) {
            var e_1, _a, e_2, _b;
            var jsonMsg = JSON.parse(message);
            try {
                for (var _c = __values(jsonMsg.targetChannels), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var channel = _d.value;
                    var chName = utils_1.getSingleChannelName(channel, jsonMsg.city, _this.ownType);
                    var list = _this.distributionChannels.get(chName);
                    if (list) {
                        try {
                            for (var list_1 = (e_2 = void 0, __values(list)), list_1_1 = list_1.next(); !list_1_1.done; list_1_1 = list_1.next()) {
                                var _e = __read(list_1_1.value, 2), key = _e[0], value = _e[1];
                                _this.udpSocket.send(jsonMsg.payloadCSV, value.port, value.ip);
                            }
                        }
                        catch (e_2_1) { e_2 = { error: e_2_1 }; }
                        finally {
                            try {
                                if (list_1_1 && !list_1_1.done && (_b = list_1.return)) _b.call(list_1);
                            }
                            finally { if (e_2) throw e_2.error; }
                        }
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                }
                finally { if (e_1) throw e_1.error; }
            }
            //update statistics
            //if(jsonMsg.type==2){
            _this.targetRawLatency = _this.resetLatency(jsonMsg, _this.targetRawLatency);
            //}
        });
    }
    GenericServer.prototype.setDeathWish = function (trigger) {
        this.deathwish = trigger;
    };
    GenericServer.prototype.getStats = function () {
        return {
            ownLatencyOffset: this.ownLatencyOffset,
            targetRawLatency: this.targetRawLatency,
            numOfUsers: this.connectionList.size,
            numOfConnections: this.numOfConnections,
            channelSizeMap: this.getChannelDensity()
        };
    };
    GenericServer.prototype.resetRedis = function (endpoint) {
        var _this = this;
        //redis client to get counterpart msgs. this is to be executed everytime redis changes
        this.subscriber = redis_1.default.createClient(6379, endpoint);
        this.publisher = redis_1.default.createClient(6379, endpoint);
        this.subscriber.subscribe(this.targetType + "Locations");
        this.subscriber.on("message", function (chnl, message) {
            var e_3, _a, e_4, _b;
            var jsonMsg = JSON.parse(message);
            try {
                for (var _c = __values(jsonMsg.targetChannels), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var channel = _d.value;
                    var chName = utils_1.getSingleChannelName(channel, jsonMsg.city, _this.ownType);
                    var list = _this.distributionChannels.get(chName);
                    if (list) {
                        try {
                            for (var _e = (e_4 = void 0, __values(list.values())), _f = _e.next(); !_f.done; _f = _e.next()) {
                                var value = _f.value;
                                _this.udpSocket.send(jsonMsg.payloadCSV, value.port, value.ip);
                            }
                        }
                        catch (e_4_1) { e_4 = { error: e_4_1 }; }
                        finally {
                            try {
                                if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                            }
                            finally { if (e_4) throw e_4.error; }
                        }
                    }
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                }
                finally { if (e_3) throw e_3.error; }
            }
            //update statistics
            //if(jsonMsg.type==2){
            _this.targetRawLatency = _this.resetLatency(jsonMsg, _this.targetRawLatency);
            //}
        });
    };
    //statistics methods
    GenericServer.prototype.getTimestamp = function (jsonMsg) {
        return +jsonMsg.payloadCSV.split('|')[3];
    };
    GenericServer.prototype.resetLatency = function (jsonMsg, target) {
        var currentlatency = Date.now() - this.getTimestamp(jsonMsg);
        if (currentlatency != NaN && currentlatency != Infinity) {
            return (currentlatency + (this.connectionList.size - 1) * target) / this.connectionList.size;
        }
        else {
            return target;
        }
    };
    GenericServer.prototype.getChannelDensity = function () {
        var e_5, _a;
        var result = new Map();
        try {
            for (var _b = __values(this.distributionChannels), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = __read(_c.value, 2), key = _d[0], value = _d[1];
                result.set(key, value.size);
            }
        }
        catch (e_5_1) { e_5 = { error: e_5_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_5) throw e_5.error; }
        }
        return result;
    };
    GenericServer.prototype.startServer = function () {
        var _this = this;
        var ownType = this.ownType;
        var targetType = this.targetType;
        //periodically close inactive connections
        var interval = setInterval(function () {
            var e_6, _a;
            try {
                for (var _b = __values(_this.connectionList), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var _d = __read(_c.value, 2), key = _d[0], value = _d[1];
                    if (new Date().getTime() - value.timestamp > 120000) {
                        updateOwnChannels(value, []);
                        value.ws.close();
                        _this.connectionList.delete(key);
                        console.log("new size: " + _this.connectionList.size, 'cons', wsServer.clients.size);
                    }
                }
            }
            catch (e_6_1) { e_6 = { error: e_6_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_6) throw e_6.error; }
            }
        }, 60000);
        //channel infrastructure
        // const distributionChannels: Map<string, Map<number, UdpConn>> = new Map();
        var wsServer = new ws_1.default.Server({
            port: this.wsPort,
        });
        // const udpSocket: dgram.Socket = dgram.createSocket("udp4");
        this.udpSocket.bind(this.udpPort, this.ownIp);
        wsServer.on("listening", function (_server) {
            console.log(ownType + " server is listening on port " + _this.wsPort);
        });
        wsServer.on("connection", function (ws) {
            _this.numOfConnections = wsServer.clients.size;
            ws.on("message", function (message) {
                //type:0 message is in order to perform initial connect process
                //type:1 message is in order to modify reception channels as well as transmitting own location
                //type:2 message is in order to exclusively send own location
                //incomming msg format: {type,taxiId,city,targetChannel?,receptionChannels?,payloadCSV?}
                try {
                    var jsonMsg = JSON.parse(message);
                    var type = jsonMsg.type;
                    if (type == 0) {
                        // connection process: add to connection list and tell user to send matching dgram for connection matching
                        var conn = new ConnectionObject_1.ConnectionObject(jsonMsg.taxiId, jsonMsg.city, ws);
                        _this.connectionList.set(jsonMsg.taxiId, conn);
                        var response = { type: 0, action: "SEND UDP" };
                        ws.send(JSON.stringify(response));
                    }
                    else {
                        //if type is 1 or 2 publish location payload on redis for counterpart(drivers) to diseminate
                        _this.ownLatencyOffset = _this.resetLatency(jsonMsg, _this.ownLatencyOffset); //move back inside the if
                        for (var i = 0; i < jsonMsg.targetChannels.length; i++) {
                            sendOwnLocationOut(utils_1.getSingleChannelName(jsonMsg.targetChannels[i], jsonMsg.city, targetType), message);
                        }
                        var existingConn = _this.connectionList.get(jsonMsg.taxiId);
                        if (existingConn) {
                            //if deathwish let this connection play russian roulette
                            if (_this.deathwish && Math.random() <= 0.01) {
                                updateOwnChannels(existingConn, []);
                                ws.close(1006, "shutting down server");
                                _this.connectionList.delete(jsonMsg.taxiId);
                            }
                            else {
                                existingConn.updateTime();
                                existingConn.setLatestMsg(message);
                                //if type=2 find channel delta and tell distributionList to add and remove connection from corresponding channels
                                if (type == 2) {
                                    updateOwnChannels(existingConn, jsonMsg.receptionChannels);
                                    //update statistics
                                    //this.ownLatencyOffset=this.resetLatency(jsonMsg,this.ownLatencyOffset);
                                }
                            }
                        }
                    }
                }
                catch (_a) {
                    ws.send("ILLEGAL MSG");
                }
            });
            //when connection is ended the client is first removed from the delivery group
            ws.on("close", function (code, reason) {
                var e_7, _a;
                console.log("cons", wsServer.clients.size, 'CODE', code);
                _this.numOfConnections = wsServer.clients.size;
                try {
                    for (var _b = __values(_this.connectionList), _c = _b.next(); !_c.done; _c = _b.next()) {
                        var _d = __read(_c.value, 2), key = _d[0], value = _d[1];
                        if (ws == value.ws) {
                            var conn = _this.connectionList.get(key);
                            if (code == 1006) {
                                try {
                                    var latestMsg = JSON.parse(value.latestMsg);
                                    for (var i = 0; i < latestMsg.targetChannels.length; i++) {
                                        sendOwnLocationOut(utils_1.getSingleChannelName(latestMsg.targetChannels[i], latestMsg.city, targetType), JSON.stringify(createClosingMsg(latestMsg)));
                                    }
                                }
                                catch (_e) {
                                    console.log("failed to send closing msg");
                                }
                            }
                            try {
                                updateOwnChannels(conn, []);
                            }
                            finally {
                                _this.connectionList.delete(key);
                                ws.terminate(); //trying this out
                                console.log("new size: " + _this.connectionList.size, "cons", wsServer.clients.size);
                                return;
                            }
                        }
                    }
                }
                catch (e_7_1) { e_7 = { error: e_7_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                    }
                    finally { if (e_7) throw e_7.error; }
                }
            });
        });
        this.udpSocket.on("message", function (message, remote) {
            var jsonMsg = JSON.parse(message.toString());
            var taxiId = jsonMsg.taxiId;
            var type = jsonMsg.type;
            if (type == 0) {
                try {
                    var connObj = _this.connectionList.get(taxiId);
                    connObj === null || connObj === void 0 ? void 0 : connObj.addDgramAddress(remote.address);
                    connObj === null || connObj === void 0 ? void 0 : connObj.addDgramPort(remote.port);
                    //@ts-ignore
                    updateOwnChannels(connObj, [], true); //change all ip:port data to the newly arrived ip:port
                    var response = { type: 0, action: "SEND LOC" }; //in this step android needs to calculate its reception channels and send them
                    connObj === null || connObj === void 0 ? void 0 : connObj.ws.send(JSON.stringify(response));
                    _this.udpSocket.send("udp hole successfully punched", remote.port, remote.address); //see if this arrives successfully at android
                }
                catch (_a) {
                    console.warn("failed to process incomming UDP datagram");
                }
            }
        });
        //this function creates a generic closing msg for when a user gets disconnected abruptly
        function createClosingMsg(lastMsg) {
            lastMsg.payloadCSV = lastMsg.payloadCSV.slice(0, -1) + "0";
            return lastMsg;
        }
        //this function sends my location to all parties in the channel delivery group
        var sendOwnLocationOut = function (channel, msg) {
            _this.publisher.publish(ownType + "Locations", msg);
        };
        //this function updates the channels tuned into
        var updateOwnChannels = function (connObj, newChannels, resetAll) {
            var e_8, _a, e_9, _b, e_10, _c;
            var _d, _e, _f, _g;
            if (resetAll === void 0) { resetAll = false; }
            if (resetAll) {
                //this is when the UDP IP or port changes while the ws connection persists
                //here we find all existing subscriptions and change the ip:port string to match the new one
                var toModify = utils_1.getMultipleChannelNames(connObj.receptionChannels, connObj.city, ownType);
                try {
                    for (var toModify_1 = __values(toModify), toModify_1_1 = toModify_1.next(); !toModify_1_1.done; toModify_1_1 = toModify_1.next()) {
                        var iterator = toModify_1_1.value;
                        if (_this.distributionChannels.has(iterator)) {
                            (_d = _this.distributionChannels
                                .get(iterator)) === null || _d === void 0 ? void 0 : _d.set(connObj.taxiId, {
                                ip: connObj.dgramAddress,
                                port: connObj.dgramPort,
                            });
                        }
                    }
                }
                catch (e_8_1) { e_8 = { error: e_8_1 }; }
                finally {
                    try {
                        if (toModify_1_1 && !toModify_1_1.done && (_a = toModify_1.return)) _a.call(toModify_1);
                    }
                    finally { if (e_8) throw e_8.error; }
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
                        if (_this.distributionChannels.has(iterator)) {
                            (_e = _this.distributionChannels.get(iterator)) === null || _e === void 0 ? void 0 : _e.delete(connObj.taxiId);
                        }
                    }
                }
                catch (e_9_1) { e_9 = { error: e_9_1 }; }
                finally {
                    try {
                        if (toRemove_1_1 && !toRemove_1_1.done && (_b = toRemove_1.return)) _b.call(toRemove_1);
                    }
                    finally { if (e_9) throw e_9.error; }
                }
                try {
                    for (var toAdd_1 = __values(toAdd), toAdd_1_1 = toAdd_1.next(); !toAdd_1_1.done; toAdd_1_1 = toAdd_1.next()) {
                        var iterator = toAdd_1_1.value;
                        if (!_this.distributionChannels.has(iterator)) {
                            _this.distributionChannels.set(iterator, new Map());
                        }
                        (_f = _this.distributionChannels
                            .get(iterator)) === null || _f === void 0 ? void 0 : _f.set(connObj.taxiId, {
                            ip: connObj.dgramAddress,
                            port: connObj.dgramPort,
                        });
                    }
                }
                catch (e_10_1) { e_10 = { error: e_10_1 }; }
                finally {
                    try {
                        if (toAdd_1_1 && !toAdd_1_1.done && (_c = toAdd_1.return)) _c.call(toAdd_1);
                    }
                    finally { if (e_10) throw e_10.error; }
                }
                (_g = _this.connectionList.get(connObj.taxiId)) === null || _g === void 0 ? void 0 : _g.setReceptionChannels(newChannels);
            }
            //connObj.setReceptionChannels(newChannels);
        };
    };
    return GenericServer;
}());
exports.GenericServer = GenericServer;
