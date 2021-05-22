import { GenericServer2 } from "./GenericServer2";

//add code to get ip address
//add ip to ip pool on redis

const clientServer: GenericServer2 = new GenericServer2(
  "client",
  "driver",
  3000,
  33333,
  "54.159.176.126"
);

clientServer.startServer();

const driverServer: GenericServer2 = new GenericServer2(
  "driver",
  "client",
  4000,
  44444,
  "54.159.176.126"
);

driverServer.startServer();