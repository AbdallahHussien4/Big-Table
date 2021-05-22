// Include controllers:-
const authenticationController = require("./authenticationController");
const masterController = require("./masterController");
const dbController = require("./dbController");



module.exports.onClientConnection = (client_socket) => {
	console.log(`a client connected with id ${client_socket.client_info.id}`);
	ONLINE_CLIENTS.push(client_socket.client_info);
	
	client_socket.on("add-row", async (data, cb)=>{
		// 	use a function from db controller to handle this event and pass the result to the cb function
		const res = await dbController.addRow(data);
		cb(res);
	});


	client_socket.on("delete-row", async (data, cb)=>{
		// 	use a function from db controller to handle this event and pass the result to the cb function
		const res = await dbController.deleteRow(data);
		cb(res);
	});


	// Add other events you want to respond to





	// emit the caught error to the client error event listener
	client_socket[Symbol.for('nodejs.rejection')] = (err) => {
		client_socket.emit("error", err);
	};

	// handling client disconnecting event:
	//--------------------------------------
	client_socket.on('disconnect', () => {
		console.log(`client disconnected with id = ${client_socket.client_info.id}`);
		const idx = ONLINE_CLIENTS.findIndex(client => client.id === client_socket.client_info.id);
		ONLINE_CLIENTS.splice(idx, 1);
		// Do other work on client disconecting
	});

	// error event listener:-
	//-------------------------------------
	client_socket.on('error', () => {
		// 	handle client errors
	});
}



// Examples
//------------
// {
// 	// example for event handling:
// 	//--------------------------------
// 	client_socket.on("test-event", (data, cb)=>{ // This is a listener to "test-event" event. Note that "test-event" is an arbitrary name given by the client who emits this event (i.e: @ client side ==> client_socket.emit("test-event", msg))
// 		// 	use a function from any controller to handle this event
// 		cb("This is a response to the client's emitted event");
// 	});

// 	// example for sending to client:-
// 	//----------------------------------
// 	// you can add multiple arguments as you want before the ack call back argument
// 	let processed_data = {dummykey: "dummyvalue"};
// 	client_socket.emit("response-event", processed_data, "another data field", (client_response)=>{
// 		// this ack function is optional
// 		// It will be called when the client answers to this event.
// 		console.log(client_response); // "this is the client response"
// 	});
// 	// @ client:
// 	//  io.on("connection", (client_socket) => {
// 	//    client_socket.on("response-event", (processed_data, extra_field, cb) => {
// 	//      cb("this is the client response");
// 	//    });
// 	//  });

// 	// example to stop listening to an event:
// 	//----------------------------------------
// 	client_socket.off("test-event", (...args)=>{
// 		// I don't know what args will be passed to this callback so I am printing them for testing
// 		console.log(args);
// 	});

// 	// For more events methods https://socket.io/docs/v4/listening-to-events/ 
// 	// For broadcasting https://socket.io/docs/v4/broadcasting-events/ 
// }