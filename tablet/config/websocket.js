const serverIO = require("socket.io");
const clientIO = require("socket.io-client");
const EventEmitter = require("events");

const logger = require("../utils/logger");

const authenticationController = require("../controllers/authenticationController");
const dbController = require("./../controllers/dbController");

const Global = require("../models/GlobalModel");
const Product = require("../models/ProductModel");

EventEmitter.captureRejections = true;

let tabletSocket, masterSocket;
module.exports = (server) => {
  const masterEmitter = new EventEmitter();

  // First, Connect to master:-
  masterSocket = connectToMaster(masterEmitter, server);

  // If the connection with the master successful then establish the tablet server socket to listen to clients requests
  masterEmitter.once("master-connected", async () => {
    const globalObject = await Global.findOne({ id: 1 });
    let req = { currentVersion: "" };
    if (globalObject) {
      req.currentVersion = globalObject.currentVersion;
    }
    let res = await emitRequest(masterSocket, "get-tablet", req);


    if (
      !res.checkVersion ||
      (globalObject && JSON.stringify(globalObject.metadata) != JSON.stringify(res.metadata))
    ) {
      try {
        await Product.collection.drop();
      } catch (err) {
        // Do nothing
        //This error is bec the collection does not exist which is ok if the tablet is openning for the first time
      }
      await Product.insertMany(res.table);
      await Global.findOneAndUpdate(
        { id: 1 },
        {
          metadata: res.metadata,
          extraRowsStartId: res.extraRowsStartId,
          currentVersion: res.currentVersion,
					updatedRows: [],
					deletedCells: [],
					deletedRows: []
        },
        { upsert: true}
      );
			logger.log("info", "tablet data was NOT up to date. Now its updated.");

    } else {
			logger.log("info", "tablet data is already up to date");
		}
    tabletSocket = initAndConfigureTablet(server, masterSocket);
  });
};

//Establishes a websocket with the master server. This socket is used to send requests(messages) to the master server.
function connectToMaster(masterEmitter, server) {
  const myArgs = process.argv.slice(2);
  const auth_token =
    ME === "tablet_1"
      ? process.env.MASTER_ACCESS_TOKEN_TABLET_1
      : ME === "tablet_2"
      ? process.env.MASTER_ACCESS_TOKEN_TABLET_2
      : "";

  // Establishing a websocket with the master server
  const masterSocket = clientIO(process.env.MASTER_WEBSOCKET_URL, {
    path: "/ws/connect",
    reconnectionDelayMax: 10000,
    extraHeaders: {
      Authorization: `${auth_token}`,
    },
  });

  // If the connection is established successfully, emit a custom event called 'master-connect', this event informs
  // any listener to it that the connection with master is successful. i.e: the function 'initAndConfigureTablet' is
  // not called unless this event is emitted. This is done through listening to this event.
  masterSocket.on("connect", () => {
    logger.log("info", "Connected to master");
    MASTER_ONLINE = true;
    masterEmitter.emit("master-connected"); //You can capture this event anywhere in the code
  });

  masterSocket.on("disconnect", () => {
    logger.log("info", "Disconnected from master");
    MASTER_ONLINE = false;
    masterEmitter.emit("master-disconnected"); //You can capture this event anywhere in the code
  });

  masterSocketAPI(masterSocket, server);

  return masterSocket;
}

//Establishes a websocket that receives requests(as messages) from client servers and respond to it.
function initAndConfigureTablet(server, masterSocket) {
  // Establishing a websocket as a server(receives connections)
  // -----------------------------------------------------------
  tabletSocket = serverIO(server, {
    path: "/ws/connect",
    cors: {
      origin: "*", //Should be limited to the ips of the client machines e.g: "127.0.0.1:6000 127.0.0.1:5000"
    },
    pingInterval: 10000,
    pingTimeout: 5000,
    serveClient: false,
  });

  // Middlewares used at any client connection:-
  //----------------------------------------------
  // checks the auth token  in the headers of the client's(client servers) request before the websocket handshake.
  // if auth token is valid then the handshake is acknowledged and the token's payload(that contains the client's info)
  // is appended to "clientSocket" object and is passed to on.('connection') event
  tabletSocket.use(authenticationController.protectWs);

  // handling the event of a client connection:-
  //----------------------------------------------
  tabletSocket.on("connection", (clientSocket) => {
    // Now a websocket connection is established between this server(tablet server) and a client server.
    // You can send/receive messages from/to this single client through the object clientSocket.

    logger.log("info", `a client connected with id ${clientSocket.client_info.id}`);
    // save this client's info in a global array called ONLINE_CLIENTS (initialized in 'initializeGlobal.js' file)
    ONLINE_CLIENTS.push(clientSocket.client_info);
    // append the needed event handlers to this clientSocket (each event handler handles a given request from the client)
    tabletSocketAPI(clientSocket, masterSocket);
  });

  // Error event listener:-
  //-------------------------
  tabletSocket.on("error", function (err) {
    // Handle thrown errors from any middleware
    logger.log("error", err);
  });

	logger.log('info', `initialized tablet server. Now listening to clients`);
  return tabletSocket;
}

// Takes master socket to be able to send requests to master if it needs to.
const tabletSocketAPI = (clientSocket, masterSocket) => {
  // Note: cb is undefined unless you add a call back at the client too.
  // e.g: at the client he calls " socket.emit("add-row", data, d => console.log(d)) "

  clientSocket.on("read-rows", async (req, cb) => {
    //req is a string of the incomming message
		logger.log("info", `client ${clientSocket.client_info.id} sent read-rows`);
    const res = await dbController.readRows(req, masterSocket);
		logger.log("info", `client ${clientSocket.client_info.id} read-rows DONE!`);
    cb(res);
  });

  clientSocket.on("add-rows", async (req, cb) => {
		logger.log("info", `client ${clientSocket.client_info.id} sent add-rows`);
    const res = await dbController.addRow(req, masterSocket);
		logger.log("info", `client ${clientSocket.client_info.id} add-rows DONE!`);
    return cb(res);
  });

  clientSocket.on("set", async (req, cb) => {
		logger.log("info", `client ${clientSocket.client_info.id} sent set`);
    const res = await dbController.set(req, masterSocket);
		logger.log("info", `client ${clientSocket.client_info.id} set DONE!`);
    cb(res);
  });

  clientSocket.on("delete-cells", async (req, cb) => {
		logger.log("info", `client ${clientSocket.client_info.id} sent delete-cells`);
    const res = await dbController.deleteCells(req, masterSocket);
		logger.log("info", `client ${clientSocket.client_info.id} delete-cells DONE!`);
    cb(res);
  });

  clientSocket.on("delete-rows", async (req, cb) => {
		logger.log("info", `client ${clientSocket.client_info.id} sent delete-rows`);
    const res = await dbController.deleteRow(req, masterSocket);
		logger.log("info", `client ${clientSocket.client_info.id} delete-rows DONE!`);
    cb(res);
  });

	clientSocket.on("get-metadata", async (req, cb) => {
		logger.log("info", `client ${clientSocket.client_info.id} sent get-metadata`);
    const res = await dbController.getMetadata(req, masterSocket);
		logger.log("info", `client ${clientSocket.client_info.id} get-metadata DONE!`);
    cb(res);
  });

  // Add other events you want to respond to

  // emit the caught error to the client error event listener
  clientSocket[Symbol.for("nodejs.rejection")] = (err) => {
    clientSocket.emit("error", err);
  };

  // handling client disconnecting event:
  //--------------------------------------
  clientSocket.on("disconnect", () => {
    logger.log("info", `client disconnected with id ${clientSocket.client_info.id}`);
    const idx = ONLINE_CLIENTS.findIndex((client) => client.id === clientSocket.client_info.id);
    ONLINE_CLIENTS.splice(idx, 1);
    // Do other work on client disconecting
  });

  // error event listener:-
  //-------------------------------------
  clientSocket.on("error", () => {
    // 	handle client errors
    logger.log("error", err);
  });
};

const masterSocketAPI = (masterSocket, server) => {
  masterSocket.on("load-balance-request-ready", async (req, cb) => {
		logger.log('info', 'load-balance-request-ready event is triggered');
		const connectedSockets = await tabletSocket.fetchSockets();
    connectedSockets.forEach(soc => {
			soc.removeAllListeners();
		});
		logger.log('info', 'load-balance-request-ready DONE!');
    cb("ack");
  });

  masterSocket.on("load-balance-request-get-changes", async (req, cb) => {
		logger.log('info', 'load-balance-request-get-changes event is triggered');
    const globalObject = await Global.findOne({ id: 1 });
    const extraRowsStartId = globalObject.extraRowsStartId;

    const deletedRows = globalObject.deletedRows;
    const updatedRows = globalObject.updatedRows;
    const deletedCells = globalObject.deletedCells;
    const newRows = await Product.find({ key: { $gte: extraRowsStartId } }, { _id: 0 });
    cb(
      { 
        newRows,
        deletedRows,
        updatedRows,
				deletedCells
      }
    );
		logger.log('info', 'load-balance-request-get-changes DONE!');

  });

  masterSocket.on("load-balance-request-finish-with-data", async (req, cb) => {
		logger.log('info', 'load-balance-request-finish-with-data event is triggered');

		const reqObject = req;
    //1) drop current Product table
    try {
      await Product.collection.drop();
    } catch (err) {
      logger.log('error', err);
      throw err;
    }
    //2) Insert the new table from req
    Product.insertMany(reqObject.table);
    //3) Update extraRowsStartId
    await Global.findOneAndUpdate(
      { id: 1 },
      {
        extraRowsStartId: reqObject.extraRowsStartId,
        metadata: reqObject.metadata,
        currentVersion: reqObject.currentVersion,
				updatedRows: [],
				deletedCells: [],
				deletedRows: []
      },
      { upsert: true }
    );
    //4) resume tabletSocket connection
		const connectedSockets = await tabletSocket.fetchSockets();
		connectedSockets.forEach(soc => {
			tabletSocketAPI(soc, masterSocket);
		})
		logger.log('info', 'load-balance-request-finish-with-data event DONE!');
    cb("ack");
  });

  masterSocket.on("update-metadata", async (req, cb) => {
		logger.log('info', 'Master sent update metadata');
		const reqObject = req;
    await Global.findOneAndUpdate(
      { id: 1 },
      { metadata: reqObject.metadata },
      { upsert: true }
    );
		logger.log('info', 'Master update metadata DONE!');
    cb("ack");
  });
};

const emitRequest = function (socket, event, data) {
  return new Promise((resolve) => {
    if (data) {
      socket.emit(event, data, async (res) => {
        resolve(res);
      });
    } else {
      socket.emit(event, async (res) => {
        resolve(res);
      });
    }
  });
};