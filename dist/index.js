"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var GenericServer2_1 = require("./GenericServer2");
//add code to get ip address
//add ip to ip pool on redis
var clientServer = new GenericServer2_1.GenericServer2("client", "driver", 3000, 33333, "172.31.3.81");
clientServer.startServer();
var driverServer = new GenericServer2_1.GenericServer2("driver", "client", 4000, 44444, "172.31.3.81");
driverServer.startServer();
