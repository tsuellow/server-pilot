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
    function GenericServer2(ownType, targetType, wsPort, udpPort, ownIp, redisEndpoint) {
        this.ownType = ownType;
        this.targetType = targetType;
        this.wsPort = wsPort;
        this.udpPort = udpPort;
        this.ownIp = ownIp;
        this.redisEndpoint = redisEndpoint;
        this.deathwish = false;
        this.distributionChannels = new Map();
        this.udpSocket = dgram_1.default.createSocket("udp4");
        this.subscriber = redis_1.default.createClient('rediss://' + redisEndpoint + ':6379');
        this.publisher = redis_1.default.createClient('rediss://' + redisEndpoint + ':6379');
        this.subscriber.subscribe(targetType + "Locations");
    }
    GenericServer2.prototype.setDeathWish = function (trigger) {
        this.deathwish = trigger;
    };
    GenericServer2.prototype.resetRedis = function (endpoint) {
        var _this = this;
        //redis client to get counterpart msgs. this is to be executed everytime redis changes
        this.subscriber = redis_1.default.createClient('rediss://' + endpoint + ':6379');
        this.publisher = redis_1.default.createClient('rediss://' + endpoint + ':6379');
        this.subscriber.subscribe(this.targetType + "Locations");
        this.subscriber.on("message", function (chnl, message) {
            var e_1, _a, e_2, _b;
            console.log("subscription received: " + message);
            var jsonMsg = JSON.parse(message);
            try {
                for (var _c = __values(jsonMsg.targetChannels), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var channel = _d.value;
                    var chName = utils_1.getSingleChannelName(channel, jsonMsg.city, _this.ownType);
                    var list = _this.distributionChannels.get(chName);
                    if (list) {
                        try {
                            for (var _e = (e_2 = void 0, __values(list.values())), _f = _e.next(); !_f.done; _f = _e.next()) {
                                var value = _f.value;
                                console.log(value.ip + "::::" + value.port);
                                _this.udpSocket.send(jsonMsg.payloadCSV, value.port, value.ip);
                            }
                        }
                        catch (e_2_1) { e_2 = { error: e_2_1 }; }
                        finally {
                            try {
                                if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
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
        });
    };
    GenericServer2.prototype.startServer = function () {
        var _this = this;
        var ownType = this.ownType;
        var targetType = this.targetType;
        //redis client to get datagram recipients ...we will need to pass the redis url later on
        // const subscriber: redis.RedisClient = redis.createClient('rediss://'+this.redisEndpoint+':6379');
        // const publisher: redis.RedisClient = redis.createClient('rediss://'+this.redisEndpoint+':6379');
        // subscriber.subscribe(targetType + "Locations");
        //list of all connected users
        var connectionList = new Map();
        //periodically close inactive connections
        var interval = setInterval(function () {
            var e_3, _a;
            try {
                for (var connectionList_1 = __values(connectionList), connectionList_1_1 = connectionList_1.next(); !connectionList_1_1.done; connectionList_1_1 = connectionList_1.next()) {
                    var _b = __read(connectionList_1_1.value, 2), key = _b[0], value = _b[1];
                    if (new Date().getTime() - value.timestamp > 120000) {
                        updateOwnChannels(value, []);
                        value.ws.close();
                        console.log("deletion of taxiId: " +
                            value.taxiId +
                            " being performed due to caducation on list of size: " +
                            connectionList.size);
                        connectionList.delete(key);
                        console.log("new size: " + connectionList.size);
                    }
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (connectionList_1_1 && !connectionList_1_1.done && (_a = connectionList_1.return)) _a.call(connectionList_1);
                }
                finally { if (e_3) throw e_3.error; }
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
                    if (type == 0) {
                        // connection process: add to connection list and tell user to send matching dgram for connection matching
                        var conn = new ConnectionObject_1.ConnectionObject(jsonMsg.taxiId, jsonMsg.city, ws);
                        connectionList.set(jsonMsg.taxiId, conn);
                        var response = { type: 0, action: "SEND UDP" };
                        ws.send(JSON.stringify(response));
                        console.log(response);
                    }
                    else {
                        //if type is 1 or 2 publish location payload on redis for counterpart(drivers) to diseminate
                        for (var i = 0; i < jsonMsg.targetChannels.length; i++) {
                            sendOwnLocationOut(utils_1.getSingleChannelName(jsonMsg.targetChannels[i], jsonMsg.city, targetType), message);
                        }
                        var existingConn = connectionList.get(jsonMsg.taxiId);
                        if (existingConn) {
                            //if deathwish let this connection play russian roulette
                            if (_this.deathwish && Math.random() <= 0.01) {
                                updateOwnChannels(existingConn, []);
                                ws.close(1006, "shutting down server");
                                console.log("deletion of taxiId: " +
                                    jsonMsg.taxiId +
                                    " being performed due to slow suicide procedure");
                                connectionList.delete(jsonMsg.taxiId);
                            }
                            else {
                                existingConn.updateTime();
                                existingConn.setLatestMsg(message);
                                //if type=2 find channel delta and tell distributionList to add and remove connection from corresponding channels
                                if (type == 2) {
                                    updateOwnChannels(existingConn, jsonMsg.receptionChannels);
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
                var e_4, _a;
                try {
                    for (var connectionList_2 = __values(connectionList), connectionList_2_1 = connectionList_2.next(); !connectionList_2_1.done; connectionList_2_1 = connectionList_2.next()) {
                        var _b = __read(connectionList_2_1.value, 2), key = _b[0], value = _b[1];
                        if (ws == value.ws) {
                            var conn = connectionList.get(key);
                            //@ts-ignore
                            console.log("disconnecting taxiId: " +
                                (conn === null || conn === void 0 ? void 0 : conn.taxiId) +
                                " code:" +
                                code +
                                " reason:" +
                                reason);
                            if (code == 1006) {
                                try {
                                    var latestMsg = JSON.parse(value.latestMsg);
                                    for (var i = 0; i < latestMsg.targetChannels.length; i++) {
                                        sendOwnLocationOut(utils_1.getSingleChannelName(latestMsg.targetChannels[i], latestMsg.city, targetType), JSON.stringify(createClosingMsg(latestMsg)));
                                    }
                                }
                                catch (_c) {
                                    console.log("failed to send closing msg");
                                }
                            }
                            updateOwnChannels(conn, []);
                            connectionList.delete(key);
                            console.log("new size: " + connectionList.size);
                            return;
                        }
                    }
                }
                catch (e_4_1) { e_4 = { error: e_4_1 }; }
                finally {
                    try {
                        if (connectionList_2_1 && !connectionList_2_1.done && (_a = connectionList_2.return)) _a.call(connectionList_2);
                    }
                    finally { if (e_4) throw e_4.error; }
                }
            });
        });
        this.subscriber.on("message", function (chnl, message) {
            var e_5, _a, e_6, _b;
            console.log("subscription received: " + message);
            var jsonMsg = JSON.parse(message);
            try {
                for (var _c = __values(jsonMsg.targetChannels), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var channel = _d.value;
                    var chName = utils_1.getSingleChannelName(channel, jsonMsg.city, ownType);
                    var list = _this.distributionChannels.get(chName);
                    if (list) {
                        try {
                            for (var _e = (e_6 = void 0, __values(list.values())), _f = _e.next(); !_f.done; _f = _e.next()) {
                                var value = _f.value;
                                console.log(value.ip + "::::" + value.port);
                                _this.udpSocket.send(jsonMsg.payloadCSV, value.port, value.ip);
                            }
                        }
                        catch (e_6_1) { e_6 = { error: e_6_1 }; }
                        finally {
                            try {
                                if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                            }
                            finally { if (e_6) throw e_6.error; }
                        }
                    }
                }
            }
            catch (e_5_1) { e_5 = { error: e_5_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                }
                finally { if (e_5) throw e_5.error; }
            }
        });
        this.udpSocket.on("message", function (message, remote) {
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
            console.log("getting channel: " + channel);
            _this.publisher.publish(ownType + "Locations", msg);
        };
        //this function updates the channels tuned into
        var updateOwnChannels = function (connObj, newChannels, resetAll) {
            var e_7, _a, e_8, _b, e_9, _c;
            var _d, _e, _f;
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
                catch (e_7_1) { e_7 = { error: e_7_1 }; }
                finally {
                    try {
                        if (toModify_1_1 && !toModify_1_1.done && (_a = toModify_1.return)) _a.call(toModify_1);
                    }
                    finally { if (e_7) throw e_7.error; }
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
                catch (e_8_1) { e_8 = { error: e_8_1 }; }
                finally {
                    try {
                        if (toRemove_1_1 && !toRemove_1_1.done && (_b = toRemove_1.return)) _b.call(toRemove_1);
                    }
                    finally { if (e_8) throw e_8.error; }
                }
                try {
                    for (var toAdd_1 = __values(toAdd), toAdd_1_1 = toAdd_1.next(); !toAdd_1_1.done; toAdd_1_1 = toAdd_1.next()) {
                        var iterator = toAdd_1_1.value;
                        console.log(iterator);
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
                catch (e_9_1) { e_9 = { error: e_9_1 }; }
                finally {
                    try {
                        if (toAdd_1_1 && !toAdd_1_1.done && (_c = toAdd_1.return)) _c.call(toAdd_1);
                    }
                    finally { if (e_9) throw e_9.error; }
                }
            }
            connObj.setReceptionChannels(newChannels);
        };
    };
    return GenericServer2;
}());
exports.GenericServer2 = GenericServer2;
