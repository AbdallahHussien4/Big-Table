const jwt = require("jsonwebtoken");
const { promisify } = require("util");

const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const DbQueryManager = require("../utils/dbQueryManager");
const GlobalData = require("../models/GlobalModel");
const Product = require("../models/ProductModel");

const logger = require("../utils/logger");

// Send tablet data to tablet
module.exports.getTablet = async (req, clientSocket) => {
  try {
    const reqObject = req;

    let res = {
      checkVersion: null,
			currentVersion: null,
      table: null,
			extraRowsStartId: null,
      metadata: null,
    };
    const globalObject = await GlobalData.findOne({id:1});
    const metaData = globalObject.metadata;
    const currentVersion = globalObject.currentVersion;
		const extraRowsStartId = globalObject.extraRowsStartId;

    res.metadata = metaData;
		res.extraRowsStartId = extraRowsStartId;
		res.currentVersion = currentVersion;
    if (reqObject.currentVersion == currentVersion) {
      res.checkVersion = true;
    } else {
      res.checkVersion = false;
      let range = null;
      if (clientSocket.client_info.id === 1) {
        range = metaData["tablet_1"];
      } else if (clientSocket.client_info.id === 2) {
        range = metaData["tablet_2"];
      }
      res.table = await Product.find({ key: { $gte: range[0], $lte: range[1] } });
    }
    return res;

  } catch (err) {
    logger.log("error", err);
    return {
			status: 'fail',
			error: err
		};
  }
};
