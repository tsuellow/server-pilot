"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var GenericServer_1 = require("./GenericServer");
var clientServer = new GenericServer_1.GenericServer("client", "driver", 3000, 33333, "0.0.0.0");
clientServer.startServer();
