const serverIO = require("socket.io");
const EventEmitter = require("events");
const { v4: uuidv4 } = require("uuid");
const logger = require("../utils/logger");

const authenticationController = require("../controllers/authenticationController");
const dbController = require("./../controllers/dbController");
const Product = require("../models/ProductModel");
const Global = require("../models/GlobalModel");

EventEmitter.captureRejections = true;

module.exports = (server) => {
  const masterSocket = initAndConfigureMaster(server);

  setInterval(async () => {
		try{
			await loadBalance(masterSocket);
		}
		catch(err){
			logger.log('error', `Error in load balance function ${err}`);
		}
  }, 1000 * 60 * 60); //every 1hr

};

//Establishes a websocket that receives tablet server requests(as messages) from client servers and respond to it
function initAndConfigureMaster(server) {
  // Establishing a websocket as a server(receives connections)
  // -----------------------------------------------------------
  const masterSocket = serverIO(server, {
    path: "/ws/connect",
    cors: {
      origin: "*", //Should be limited to the ips of the tablet servers machines e.g: "127.0.0.1:7000 127.0.0.1:8000"
    },
    pingInterval: 10000,
    pingTimeout: 5000,
    serveClient: false,
  });

  // Middlewares used at any client connection:-
  //----------------------------------------------
  // checks the auth token  in the headers of the client's(tablet servers) request before the websocket handshake.
  // if auth token is valid then the handshake is acknowledged and the token's payload(that contains the client's info)
  // is appended to "clientSocket" object and is passed to on.('connection') event
  masterSocket.use(authenticationController.protectWs);

  // Error event listener:-
  //-------------------------
  masterSocket.on("error", function (err) {
    // Handle thrown errors from any middleware
    logger.log("error", err);
  });

  // handling the event of a client connection:-
  //----------------------------------------------
  masterSocket.on("connection", (clientSocket) => {
    // Now a websocket connection is established between this server(master server) and a tablet server.
    // You can send/receive messages from/to this single connection through the object clientSocket.

    logger.log("info", `a client(tablet server) connected with id ${clientSocket.client_info.id}`);
    // save this tablet server's info in a global array called ONLINE_CLIENTS (initialized in 'initializeGlobalData.js' file)
    ONLINE_CLIENTS.push({
      ...clientSocket.client_info,
      socket: clientSocket,
    });
    // append the needed event handlers to this clientSocket (each event handler handles a given request from the client)
    masterSocketAPI(clientSocket);
  });
	logger.log('info', `initialized master server. Now listening to tablets on port ${process.env.PORT}`);

  return masterSocket;
}

const masterSocketAPI = (clientSocket) => {
  // Note: cb is undefined unless you add a call back at the client too.
  // e.g: at the client he calls " socket.emit("add-row", data, d => console.log(d)) "

  clientSocket.on("get-tablet", async (req, cb) => {
    logger.log("info", `tablet ${clientSocket.client_info.id} sent get-tablet`);
    const res = await dbController.getTablet(req, clientSocket);
    logger.log("info", `tablet ${clientSocket.client_info.id} get-tablet DONE!`);
    cb(res);
  });

  clientSocket.on("update-metadata", async (req, cb) => {
    logger.log("info", `tablet ${clientSocket.client_info.id} sent update-metadata`);
    const reqObject = req;
    let tablet_1_socket, tablet_2_socket;
    if (ONLINE_CLIENTS[0].id === 1) {
      tablet_1_socket = ONLINE_CLIENTS[0].socket;
      tablet_2_socket = ONLINE_CLIENTS[1].socket;
    } else {
      tablet_1_socket = ONLINE_CLIENTS[1].socket;
      tablet_2_socket = ONLINE_CLIENTS[0].socket;
    }
    await Promise.all([
      emitRequest(
        tablet_1_socket,
        "update-metadata",
        { metadata: reqObject.metadata }
      ),
      Global.findOneAndUpdate({ id: 1 }, { metadata: reqObject.metadata }),
    ]);
    logger.log("info", `tablet ${clientSocket.client_info.id} update-metadata DONE!`);
    cb("ack");
  });

  // Add other events you want to respond to

  // emit the caught error to the client error event listener
  clientSocket[Symbol.for("nodejs.rejection")] = (err) => {
    clientSocket.emit("error", err);
  };

  // handling client disconnecting event:
  //--------------------------------------
  clientSocket.on("disconnect", () => {
    logger.log("info", `client disconnected with id = ${clientSocket.client_info.id}`);
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

const loadBalance = async function (masterSocket) {
  logger.log("info", "load balancer started");
  if (ONLINE_CLIENTS.length === 0 || ONLINE_CLIENTS.length === 1) {
    return;
  }
  let tablet_1_socket, tablet_2_socket;
  if (ONLINE_CLIENTS[0].id === 1) {
    tablet_1_socket = ONLINE_CLIENTS[0].socket;
    tablet_2_socket = ONLINE_CLIENTS[1].socket;
  } else {
    tablet_1_socket = ONLINE_CLIENTS[1].socket;
    tablet_2_socket = ONLINE_CLIENTS[0].socket;
  }

	// Inform tablet servers that a load balnce request is about to be sent so that they would stop receiving requests from clients
  await emitRequest(tablet_1_socket, "load-balance-request-ready", {dummy:"dummy"});
  await emitRequest(tablet_2_socket, "load-balance-request-ready", {dummy:"dummy"});

	// Retrieve changes from tablet servers and submit it
  await getAndsubmitChanges(tablet_1_socket);
  await getAndsubmitChanges(tablet_2_socket);


	// Calculate and distribute data among tablet servers.
  await distributeAndSendData(tablet_1_socket, tablet_2_socket);

  logger.log("info", "load balancer finished");
};


const getAndsubmitChanges = async(tabletSocket)=>{
	const changes = await emitRequest(tabletSocket, "load-balance-request-get-changes", {dummy:"dummy"});
  const changesObject = changes;
  const newRows = changesObject.newRows;
  const deletedRows = changesObject.deletedRows;
  const updatedRows = changesObject.updatedRows;
  const deletedCells = changesObject.deletedCells;

  await Product.insertMany(newRows);
  for (let i = 0; i < updatedRows.length; i++) {
    await Product.findOneAndUpdate({key: updatedRows[i].id}, updatedRows[i].query);
  }
	for (let i = 0; i < deletedCells.length; i++) {
    await Product.findOneAndUpdate({key: deletedCells[i].id}, {$unset: deletedCells[i].fields});
  }
  await Product.deleteMany({ key: { $in: deletedRows } });
}

const distributeAndSendData = async(tablet_1_socket, tablet_2_socket)=>{
	const products = await Product.find();
  productsCount = products.length;
  const tabletSize = Math.floor(productsCount / 3);
	const separatorKey = products[2 * tabletSize-1].key;
	const lastKey = products[productsCount-1].key;
  const tablet_1_range = [1, separatorKey];
  const tablet_2_range = [separatorKey + 1, lastKey];
  const metaData = {
    tablet_1: tablet_1_range,
    tablet_2: tablet_2_range,
  };
  const currentVersion = uuidv4();
  await Global.findOneAndUpdate(
    { id: 1 },
    {
      metadata: metaData,
      extraRowsStartId: lastKey + 1,
      currentVersion,
    }
  );

  const tablet_1_data = {
    metadata: metaData,
    extraRowsStartId: lastKey + 1,
    currentVersion,
    table: products.slice(0, 2*tabletSize + 1),
  };
  const tablet_2_data = {
    metadata: metaData,
    extraRowsStartId: lastKey + 1,
    currentVersion,
    table: products.slice(2*tabletSize + 1),
  };

	// Send new tables to tablet servers
  await emitRequest(tablet_2_socket, "load-balance-request-finish-with-data", tablet_2_data);
  await emitRequest(tablet_1_socket, "load-balance-request-finish-with-data", tablet_1_data);
}

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
