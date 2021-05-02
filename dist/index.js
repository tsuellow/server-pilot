"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var GenericServer_1 = require("./GenericServer");
//add code to get ip address
//add ip to ip pool on redis
var driverServer = new GenericServer_1.GenericServer("driver", "client", 4001, 44444, "172.31.44.252");
driverServer.startServer();
var clientServer = new GenericServer_1.GenericServer("client", "driver", 3001, 33333, "172.31.44.252");
clientServer.startServer();
