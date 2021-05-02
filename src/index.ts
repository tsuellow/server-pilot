import { GenericServer } from "./GenericServer";

//add code to get ip address
//add ip to ip pool on redis

const driverServer: GenericServer = new GenericServer(
  "driver",
  "client",
  3002,
  12000,
  "172.31.44.252"
);

driverServer.startServer();

const clientServer: GenericServer = new GenericServer(
  "client",
  "driver",
  3001,
  33333,
  "172.31.44.252"
);

clientServer.startServer();