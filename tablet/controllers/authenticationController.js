const catchAsync = require("./../utils/catchAsync");
const AppError = require("../utils/appError");
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const fs = require("fs");
const path = require("path");
const keyPath = path.join(__dirname, "../config/keys/publicKey.pem");
const PUBLIC_KEY = fs.readFileSync(keyPath, "utf8");

exports.protectWs = async (socket, next) => {
	try{
		// Authenticate client connection.
		if (socket.handshake.headers && socket.handshake.headers.authorization){
			const decoded = await promisify(jwt.verify)(socket.handshake.headers.authorization.split(' ')[1], PUBLIC_KEY);
			if(!decoded) throw new AppError('Authentication error', 400);
			

			socket.client_info = {
				id: Number(decoded.sub),		// ex: 1
				type: decoded.type	// ex: "client"
			}

			next();
		}
		else{
			throw new AppError('Authentication error', 400);
		}
	}
	catch(err)
	{
		next(err);
	}
};
