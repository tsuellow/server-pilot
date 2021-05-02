import { GenericServer } from "./GenericServer";

//add code to get ip address
//add ip to ip pool on redis

const driverServer: GenericServer = new GenericServer(
  "driver",
  "client",
  3002,
  33335,
  "172.31.44.252"
);

driverServer.startServer();

const clientServer: GenericServer = new GenericServer(
  "client",
  "driver",
  3001,
  33334,
  "172.31.44.252"
);

clientServer.startServer();