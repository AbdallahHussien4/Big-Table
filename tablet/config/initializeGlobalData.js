module.exports = async function () {
	global.ONLINE_CLIENTS = [];
	global.MASTER_ONLINE = false;
	const myArgs = process.argv.slice(2);
	global.ME = myArgs[0];
};
