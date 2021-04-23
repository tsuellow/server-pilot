"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
Object.defineProperty(exports, "__esModule", { value: true });
var WebSocket = __importStar(require("ws"));
var dgram = __importStar(require("dgram"));
var redis = __importStar(require("redis"));
var ConnectionObject_1 = require("./models/ConnectionObject");
var utils_1 = require("./models/utils");
var ownType = 'client';
var targetType = 'driver';
//redis client to get datagram recipients ...we will need to pass the redis url later on
var redisClient = redis.createClient();
//list of all connected users
var connectionList = new Map();
var wsServer = new WebSocket.Server({ port: 3005 });
var udpSocket = dgram.createSocket('udp4');
udpSocket.bind(33333, '0.0.0.0');
wsServer.on("listening", function (server) {
    console.log('serverClient is listening');
});
wsServer.on("connection", function (ws) {
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
                    break;
                case 1:
                    // 2 processes: 
                    //1. publish location payload on redis for counterpart(drivers) to diseminate 
                    //2. find channel delta and tell redis add and remove connection from corresponding channels
                    sendOwnLocationOut(utils_1.getSingleChannelName(jsonMsg.targeChannel, jsonMsg.city, targetType), jsonMsg.payloadCSV);
                    if (connectionList.has(jsonMsg.taxiId)) {
                        var existingConn = connectionList.get(jsonMsg.taxiId);
                        //@ts-ignore
                        updateOwnChannels(existingConn, jsonMsg.receptionChannels);
                    }
                    break;
                default:
                    // publish location payload on redis for counterpart(drivers) to diseminate
                    sendOwnLocationOut(utils_1.getSingleChannelName(jsonMsg.targeChannel, jsonMsg.city, targetType), jsonMsg.payloadCSV);
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
udpSocket.on('message', function (message, remote) {
    var _a, _b;
    console.log(remote.address + ':' + remote.port + ' - ' + message);
    var jsonMsg = JSON.parse(message.toString());
    var taxiId = jsonMsg.taxiId;
    var type = jsonMsg.type;
    if (type == 0) {
        try {
            (_a = connectionList.get(taxiId)) === null || _a === void 0 ? void 0 : _a.addDgramChannel(remote.address + ':' + remote.port);
            //@ts-ignore
            updateOwnChannels(connectionList.get(taxiId), [], true); //change all ip:port data to the newly arrived
            var response = { type: 0, action: "SEND LOC" }; //in this step android needs to calculate its reception channels and send them
            (_b = connectionList.get(taxiId)) === null || _b === void 0 ? void 0 : _b.ws.send(JSON.stringify(response));
        }
        catch (_c) {
            console.log('failed to process incomming UDP datagram');
        }
    }
});
//this function sends my location to all parties in the channel delivery group
function sendOwnLocationOut(channel, payload) {
    redisClient.hvals(channel, function (error, addresses) {
        var size = addresses.length;
        var payloadBuffer = Buffer.from(payload);
        for (var i = 0; i < size; i++) {
            var port = parseInt(addresses[i].split(':')[1]);
            var ip = addresses[i].split(':')[0];
            udpSocket.send(payloadBuffer, 0, payloadBuffer.length, port, ip);
        }
    });
}
//this function updates the channels tuned into
function updateOwnChannels(connObj, newChannels, resetAll) {
    if (resetAll === void 0) { resetAll = false; }
    if (resetAll) {
        //this is when the UDP IP or port changes while the ws connection persists
        //here we find all existing subscriptions and change the ip:port string to match the new one
        var toModify = utils_1.getMultipleChannelNames(connObj.receptionChannels, connObj.city, ownType);
        for (var i = 0; i < toModify.length; i++) {
            //@ts-ignore
            redisClient.hset(toModify[i], connObj.taxiId, connObj.dgramChannel);
        }
    }
    else {
        //this is for when the user moves and wishes to be subscribed to new (hexagon)channels and unsusbscribes from others
        //here we add and remove the client from the corresponding channels (should happen more often for drivers than for clients)
        var toRemove = utils_1.getMultipleChannelNames(connObj.calculateNegativeDelta(newChannels), connObj.city, ownType);
        var toAdd = utils_1.getMultipleChannelNames(connObj.calculatePositiveDelta(newChannels), connObj.city, ownType);
        for (var i = 0; i < toRemove.length; i++) {
            //@ts-ignore
            redisClient.hdel(toRemove[i], connObj.taxiId);
        }
        for (var i = 0; i < toAdd.length; i++) {
            //@ts-ignore
            redisClient.hset(toAdd[i], connObj.taxiId, connObj.dgramChannel);
        }
    }
}
