const clientIO = require("socket.io-client");
const EventEmitter = require("events");

const logger = require("../utils/logger");

EventEmitter.captureRejections = true;

let tablet1Socket = null;
let tablet2Socket = null;

module.exports = (server) => {
  // First, Connect to tablet servers:-
  //--------------------------
  if (!tablet1Socket) tablet1Socket = connectToTablet(process.env.TABLET_1_WEBSOCKET_URL, 1);
  if (!tablet2Socket) tablet2Socket = connectToTablet(process.env.TABLET_2_WEBSOCKET_URL, 2);

  return { tablet1Socket, tablet2Socket };
};

function connectToTablet(url, tablet_id) {
  const auth_token = process.env.TABLET_ACCESS_TOKEN;

  const tabletSocket = clientIO(url, {
    path: "/ws/connect",
    reconnectionDelayMax: 2000,
    extraHeaders: {
      Authorization: `${auth_token}`,
    },
  });

  tabletSocket.on("connect", () => {
    logger.log("info", `Connected to tablet server ${tablet_id}`);
  });

  tabletSocket.on("disconnect", () => {
		META_DATA = null;
    logger.log("info", `Disconnected from tablet server ${tablet_id}`);
  });

  return tabletSocket;
}
