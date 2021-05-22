//Include modules:-
//-----------------------------------------------------------------
const dotenv = require("dotenv");
const express = require("express");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const hpp = require("hpp");
const path = require("path");
const compression = require("compression");


const websocketServer = require("./config/websocket");


//Read config file
//-----------------------------------------------------------------
dotenv.config({
	path: "./config.env",
});

//Modules that require dotenv to be defined
//-----------------------------------------------------------------
const logger = require("./utils/logger");
const connectDB = require("./config/connectDB");

//Main
//-----------------------------------------------------------------
let app;
(async () => {
	//Initialize db global variables
	await connectDB();

	await require("./config/initializeDB")();

	
	//Initialize global variables from DB.
	await require("./utils/initializeGlobalData")();

	

	// Routers:-
	// example:
	// const authenticationRouter = require("./routes/authenticationRoutes");




	//Globals:-
	//-----------------------------------------------------------------
	app = express();

	//Middlewares:-
	//-----------------------------------------------------------------
	//Limit requests ( 1] max: limits 1000 requests for each IP in one hour. | 2] windowMs: If the IP exceeds this limit then it would have to wait for an hour to pass. )
	const limiter = rateLimit({
		max: 1000,
		windowMs: 60 * 60 * 1000,
		message: {
			status: "fail",
			message: "Too many requests from this IP. please try again in an hour.",
		},
	});
	app.use("/api", limiter);
	// Prevent parameter pollution (prevents duplicate query string parameters & duplicate keys in urlencoded body requests)
	// Add a second HPP middleware to apply the whitelist only to this route. e.g: app.use('/search', hpp({ whitelist: [ 'filter' ] }));
	app.use(hpp());
	//Middleware for debugging [Displays each incoming request in the console]
	if (process.env.NODE_ENV === "development") 
		app.use(morgan("dev"));
	//Reading data from the body of the request as json and converting it to javascript object into req.body
	app.use(express.json({ limit: "10kb" }));
	// Data sanitization against NoSQL injection attacks.
	app.use(mongoSanitize({}));
	//Data sanitization against XSS(cross-site scripting) attacks.
	app.use(xss());
	//Compress http responses before sending it.
	app.use(compression());


	// Use express routers:-
	//-----------------------------------------------------------------
	const apiUrlBase = `${process.env.API_URL_PREFIX}/v${process.env.API_VERSION}`;
	// example:
	// app.use(`${apiUrlBase}/authentication`, authenticationRouter);
	app.get(/.*/, function (req, res) {
		res.status(404).json({
			message: "NOT FOUND"
		});
	});
	// app.use(errorController);


	// Run express app:-
	//-----------------------------------------------------------------
	const port = process.env.PORT || 3000;
	const server = app.listen(port, () => {
		logger.log('info', `✅ App is running now on port ${port}...`);
	});

	// Establish websocket server (Should be called after app.listen)
	websocketServer(server);

	// Handle unhandled errors:-
	//-----------------------------------------------------------------
	process.on("unhandledRejection", (err) => {
		logger.log('error', ` An unhandled rejection is thrown but caught by process.on('unhandledRejection') `);
		logger.log('error', err);
		server.close(() => {
			process.exit(1);
		});
	});

	process.on("uncaughtException", (err) => {
		logger.log('error', ` An uncaught exception is thrown but caught by process.on('uncaughtException') `);
		logger.log('error', err);
		server.close(() => {
			process.exit(1);
		});
	});

	process.on("warning", (e) => {
		logger.log('warn', ` A warning is thrown but caught by process.on('warn') `, {stack: e.stack});
	});

	process.on("SIGTERM", () => {
		logger.log('error', ` SIGTERM caught by process.on('SIGTERM') `);

		server.close(() => {
			process.exit(0);
		});
	});

module.exports = app;

})();

