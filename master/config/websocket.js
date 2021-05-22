const socketIO = require('socket.io');

const websocketController = require("../controllers/websocketController");
const authenticationController = require("../controllers/authenticationController");


module.exports = (server)=>{

	const io = socketIO(server, {
		path: "/ws/connect",
		cors:{
			origin: "*" //Should be limited to the ips of the tablet server machines
		},
		pingInterval: 10000,
		pingTimeout: 5000,
		serveClient: false
	});

	// Error event listener:-
	//-------------------------
	require("events").captureRejections = true;

	io.on('error', function(err){
		// Handle thrown errors from any middleware
		if(process.env.NODE_ENV === 'development')
			console.log(err);
	});

	// Middlewares used at any client connection:-
	//----------------------------------------------
	io.use(authenticationController.protectWs);

	// handling the event of a client connection:-
	//----------------------------------------------
	io.on('connection', websocketController.onClientConnection);


}