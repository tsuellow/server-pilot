"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var GenericServer_1 = require("./GenericServer");
var redis_1 = __importDefault(require("redis"));
var public_ip_1 = __importDefault(require("public-ip"));
var ip_1 = __importDefault(require("ip"));
var os_utils_1 = __importDefault(require("os-utils"));
//add code to get ip address
//add ip to ip pool on redis
var clientServer;
var driverServer;
var externalAddress;
var internalAddress;
var deathWish = false;
//this is a centralized redis address used for spot instance control exclucively
var redisAddress = '172.31.31.174';
var locRedisAddress = '';
var redisConn = redis_1.default.createClient(6379, redisAddress, { auth_pass: 'contrasena1234' });
var redisSubscriber = redis_1.default.createClient(6379, redisAddress, { auth_pass: 'contrasena1234' }); //subscribe to your own private channel
prepareServer();
var interval = setInterval(function () { return __awaiter(void 0, void 0, void 0, function () {
    var value;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!externalAddress) return [3 /*break*/, 2];
                return [4 /*yield*/, getCpuFreePlusTime()];
            case 1:
                value = _a.sent();
                redisConn.hset("genericServers", externalAddress, value);
                if (clientServer != null && driverServer != null) {
                    console.log('client stats');
                    console.log(clientServer.getStats());
                    console.log('driver stats');
                    console.log(driverServer.getStats());
                }
                _a.label = 2;
            case 2: return [2 /*return*/];
        }
    });
}); }, 15000);
redisSubscriber.on("message", function (chnl, msg) {
    if (msg == 'KILL YOURSELF') {
        slowlyKillBothServers(true);
    }
    if (chnl == 'redisUpdates') {
        clientServer.resetRedis(msg);
        driverServer.resetRedis(msg);
    }
});
//get public i, get private ip, register on redis and start server
function prepareServer() {
    return __awaiter(this, void 0, void 0, function () {
        var value, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    return [4 /*yield*/, promisifiedGet('redisIp')];
                case 1:
                    locRedisAddress = _a.sent();
                    return [4 /*yield*/, public_ip_1.default.v4()];
                case 2:
                    externalAddress = _a.sent();
                    internalAddress = ip_1.default.address();
                    startBothServers(internalAddress);
                    return [4 /*yield*/, getCpuFreePlusTime()];
                case 3:
                    value = _a.sent();
                    redisConn.hset("genericServers", externalAddress, value);
                    redisSubscriber.subscribe(externalAddress);
                    redisSubscriber.subscribe("locRedisAddress");
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _a.sent();
                    console.error(error_1);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function getCpuFreePlusTime() {
    return __awaiter(this, void 0, void 0, function () {
        var capacity, time;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getCpuFreePromise()];
                case 1:
                    capacity = _a.sent();
                    time = new Date().getTime();
                    return [2 /*return*/, capacity + '|' + time];
            }
        });
    });
}
//promise to get own public ip
function getCpuFreePromise() {
    return new Promise(function (resolve, reject) {
        var cpuFree = os_utils_1.default.cpuFree(function (v) {
            resolve(v);
        });
    });
}
function startBothServers(ownIp) {
    console.log('connecting to redis: ' + locRedisAddress);
    clientServer = new GenericServer_1.GenericServer("client", "driver", 3000, 33333, ownIp, locRedisAddress);
    driverServer = new GenericServer_1.GenericServer("driver", "client", 4000, 44444, ownIp, locRedisAddress);
    clientServer.startServer();
    driverServer.startServer();
}
function slowlyKillBothServers(trigger) {
    deathWish = trigger;
    if (trigger) {
        redisConn.hdel("genericServers", externalAddress);
    }
    clientServer.setDeathWish(trigger);
    driverServer.setDeathWish(trigger);
}
function promisifiedGet(key) {
    return new Promise(function (resolve, reject) {
        redisConn.get(key, function (err, reply) {
            if (err) {
                reject(err);
            }
            if (reply != null)
                resolve(reply);
        });
    });
}
