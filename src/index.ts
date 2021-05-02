import { GenericServer } from "./GenericServer";

//add code to get ip address
//add ip to ip pool on redis

const clientServer: GenericServer = new GenericServer(
  "client",
  "driver",
  3000,
  33333,
  "172.31.44.252"
);

clientServer.startServer();

const driverServer: GenericServer = new GenericServer(
  "driver",
  "client",
  4000,
  44444,
  "172.31.44.252"
);

driverServer.startServer();