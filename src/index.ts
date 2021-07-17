import { GenericServer2 } from "./GenericServer2";

//add code to get ip address
//add ip to ip pool on redis

const clientServer: GenericServer2 = new GenericServer2(
  "client",
  "driver",
  3000,
  33333,
  "172.31.3.81"
);

clientServer.startServer();

const driverServer: GenericServer2 = new GenericServer2(
  "driver",
  "client",
  4000,
  44444,
  "172.31.3.81"
);

driverServer.startServer();