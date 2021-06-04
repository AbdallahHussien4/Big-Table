const jsonwebtoken = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

const keyPath = path.join(__dirname, "../config/keys/privateKey.pem");
const PRIVATE_KEY = fs.readFileSync(keyPath, "utf8");

const authJwt = function signJwt(id, type) {
	const payload = {
		sub: id,
		type,
		iat: Math.floor(new Date() / 1000), //Must be in seconds VIPPPPP!!!
	};

	const signedToken = jsonwebtoken.sign(payload, PRIVATE_KEY, {
		// expiresIn: process.env.JWT_EXPIRES_IN, //Must be in milliseconds, (We will not use exp date for auth token)
		algorithm: "RS256",
	});

	return signedToken;
};
const consoleArgs = process.argv.slice(2);
const id = Number(consoleArgs[0]);
const type = consoleArgs[1];
console.log(authJwt(id, type));
module.exports.authJwt = authJwt;