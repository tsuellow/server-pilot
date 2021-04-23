import { GenericServer } from "./GenericServer";

const clientServer: GenericServer = new GenericServer(
  "client",
  "driver",
  3000,
  33333,
  "0.0.0.0"
);

clientServer.startServer();
