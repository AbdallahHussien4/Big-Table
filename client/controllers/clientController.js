const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const logger = require("../utils/logger");
const { data } = require("../utils/logger");
const { Socket } = require("socket.io");

module.exports.sendDbQuery = catchAsync(async (req, res, next) => {
  logger.log("info", `received a request => event: ${req.body.queryTitle}`);
	if(!req.tablet1Socket.connected || !req.tablet2Socket.connected)
	{
		logger.log("info", `Could not send request to tablet server because it's out of service`);
		res.status(500).json({
			status: 'fail',
			message: "Sorry some tablet server is not responding(Load balancing or out of service). Please try again"
		});
		return;
	}

  // check if you have the meta data in your memory, if not send a requet to any tablet server to get it:
  //---------------------------------------------------------
  if (!META_DATA) {
    META_DATA = (await sendToTablet(req.tablet1Socket, "get-metadata", { dummy: "dummy" })).metadata;
  }

  // after getting meta data, read the req.body and use it to decide which tablet to send request to:
  //---------------------------------------------------------
  let result = null;
  let res1 = null;
  let res2 = null;
  if (req.body.queryTitle === "add-rows") {
    res1 = await sendToTablet(req.tablet2Socket, "add-rows", { data: req.body.queryBody.data });

    META_DATA = res1.metadata;
  } else {
    logger.log("info", "Sending the request to tablet server");
    let r = await sendQuery(req);
    res1 = r.res1;
    res2 = r.res2;
    if ((res1 && res1.status !== "success") || (res2 && res2.status !== "success")) {
			logger.log("info", "request to tablet server had a problem Either for an off-limits or non existing key or due to server error");
      res.status(200).json({
				status: "fail",
				message: `This request failed. Either for an off-limits or non existing key or due to server error`
			});
			return;
    }
    logger.log("info", "request to tablet server DONE!");
  }
	
  if (res1) result = [...(res1.data || [])];
  if (res2) result = [...(result || []), ...(res2.data || [])];
	let count = null;
	if(Array.isArray(result))
		count = result.length;
	
	logger.log("info", `event: ${req.body.queryTitle} DONE!`);
  res.status(200).json({
    status: "success",
		count,
    data: result
  });
});

const sendQuery = async (req) => {
  let res1 = null;
  let res2 = null;
  let tablet1Ids = req.body.queryBody.ids.filter((id) => id >= META_DATA["tablet_1"][0] && id <= META_DATA["tablet_1"][1]);
  let tablet2Ids = req.body.queryBody.ids.filter((id) => id >= META_DATA["tablet_2"][0] && id <= META_DATA["tablet_2"][1]);
	let outOfBoundsIds = req.body.queryBody.ids.filter((id) => id < META_DATA["tablet_1"][0] || id > META_DATA["tablet_2"][1]);
	if(outOfBoundsIds.length > 0) {
		META_DATA = (await sendToTablet(req.tablet1Socket, "get-metadata", { dummy: "dummy" })).metadata;
		tablet1Ids = req.body.queryBody.ids.filter((id) => id >= META_DATA["tablet_1"][0] && id <= META_DATA["tablet_1"][1]);
		tablet2Ids = req.body.queryBody.ids.filter((id) => id >= META_DATA["tablet_2"][0] && id <= META_DATA["tablet_2"][1]);
		outOfBoundsIds = req.body.queryBody.ids.filter((id) => id < META_DATA["tablet_1"][0] || id > META_DATA["tablet_2"][1]);
		if(outOfBoundsIds.length > 0) throw new AppError("Out of bound id", 400);
	}
  if (tablet1Ids.length > 0) {
    res1 = await sendToTablet(req.tablet1Socket, req.body.queryTitle, {ids: tablet1Ids,data: req.body.queryBody.data});
		// Always update metadata
    META_DATA = res1.metadata;
		while(res1 && res1.status === "outdated")
		{
      logger.log("info","The current metadata was outdated. Now its updated and the request is sent again to the right tablet server");
			tablet1Ids = req.body.queryBody.ids.filter((id) => id >= META_DATA["tablet_1"][0] && id <= META_DATA["tablet_1"][1]);
			tablet2Ids = req.body.queryBody.ids.filter((id) => id >= META_DATA["tablet_2"][0] && id <= META_DATA["tablet_2"][1]);
			res1 = await sendToTablet(req.tablet1Socket, req.body.queryTitle, {ids: tablet1Ids,data: req.body.queryBody.data,});
			META_DATA = res1.metadata;
		}
  }
  if (tablet2Ids.length > 0) {
    // Process this code only if the previous request was successful or if the previous request was not sent at all
    res2 = await sendToTablet(req.tablet2Socket, req.body.queryTitle, {ids: tablet2Ids,data: req.body.queryBody.data});
		// Always update metadata
    META_DATA = res2.metadata;
		while(res2 && res2.status === "outdated")
		{
      logger.log("info","The current metadata was outdated. Now its updated and the request is sent again to the right tablet server");
			tablet1Ids = req.body.queryBody.ids.filter((id) => id >= META_DATA["tablet_1"][0] && id <= META_DATA["tablet_1"][1]);
			tablet2Ids = req.body.queryBody.ids.filter((id) => id >= META_DATA["tablet_2"][0] && id <= META_DATA["tablet_2"][1]);
			res2 = await sendToTablet(req.tablet2Socket, req.body.queryTitle, {ids: tablet2Ids,data: req.body.queryBody.data,});
			META_DATA = res2.metadata;
		}
  }
	if(res1 && !Array.isArray(res1.data)) res1.data = [res1.data]
	if(res2 && !Array.isArray(res2.data)) res2.data = [res2.data]
  return { res1, res2 };
};

const sendToTablet = (tabletSocket, queryTitle, queryBody) => {
  return new Promise((resolve, reject) => {
    tabletSocket.emit(queryTitle, queryBody, (res) => {
      resolve(res);
    });
		setTimeout(function(){
			reject(new Error("timeout"));
		},5000);
  });
};

{
  // If it is a 'add-rows' operation send to the tablet server that contains the last element (e.g: consider the meta data is {tablet_1: [1, 50], tablet_2: [51, 100]} then you should send to tablet_2 and this to make sure that elements will always be inserted in order. Note that the master will take care  of the load balancing)
  // If it is a 'set'/'read-rows'/'delete-rows'/'delete-cells' operation, check the array of ids to decide which server to send to
  // e.g:
  // req.body = {
  // 	queryTitle: 'read-rows',
  // 	queryBody: {
  // 		ids: [1, 2, 3]
  // 	}
  // }
  // req.body = {
  // 	queryTitle: 'set',
  // 	queryBody: {
  // 		ids: [1],
  // 		data: [{a: 'a1', b: 'b1', c: 'c1'}]
  // 	}
  // }
  // req.body = {
  // 	queryTitle: 'delete-rows',
  // 	queryBody: {
  // 		ids: [1, 2, 3]
  // 	}
  // }
  // req.body = {
  // 	queryTitle: 'delete-cells',
  // 	queryBody: {
  // 		ids: [1],
  // 		data: ['a', 'b']
  // 	}
  // }
  // req.body = {
  // 	queryTitle: 'add-rows',
  // 	queryBody: {
  // 		data: [
  // 			{a: 'a1', b: 'b3', c: 'c1'},
  // 			{a: 'a2', b: 'b2', c: 'c2'},
  // 			{a: 'a3', b: 'b1', c: 'c3'}
  // 		]
  // 	}
  // }
  // to send request to tablet 1
  // const res = await sendToTablet(req.tablet1Socket, req.body.queryTitle, req.body.queryBody);
  // to send request to tablet 2
  // const res = await sendToTablet(req.tablet2Socket, req.body.queryTitle, req.body.queryBody);
  // You will always get the meta data in the response from the tablet server and you will also get a status ('success' or 'fail') and you will get the data if there is data sent back
  // Your request might be responeded to by status 'fail' and a new meta data object. This means that you requested the wrong tablet server. So In this case you need to use the new meta data to send the request to tablet server again
  // e.g:
  // res = {
  // 	status: 'success',
  // 	metadata: {
  // 		tablet_1: [1, 50],
  // 		tablet_2: [51, 100],
  // 	},
  // 	data: [
  // 		{a: 'a1', b: 'b3', c: 'c1'},
  // 		{a: 'a2', b: 'b2', c: 'c2'},
  // 		{a: 'a3', b: 'b1', c: 'c3'}
  // 	]
  // }
  // res = {
  // 	status: 'fail',
  // 	metadata: {
  // 		tablet_1: [1, 50],
  // 		tablet_2: [51, 100],
  // 	}
  // }
}
