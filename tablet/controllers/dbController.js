const jwt = require("jsonwebtoken");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const DbQueryManager = require("../utils/dbQueryManager");
const logger = require("../utils/logger");
const Global = require("../models/GlobalModel");
const Product = require("../models/ProductModel");

// read rows
module.exports.readRows = async (req, masterSocket) => {
	const globalObject = await Global.findOne({id:1});
  try {
    // read row logic
		const reqObject = req;
		if(!reqObject.ids.every(id => id >= globalObject.metadata[ME][0] && id <= globalObject.metadata[ME][1]))
		return {
			status: 'outdated',
			metadata: globalObject.metadata
		}
		if(!reqObject.ids.every(id => id >= globalObject.metadata['tablet_1'][0] && id <= globalObject.metadata['tablet_2'][1]))
		return {
			status: 'off-limits',
			metadata: globalObject.metadata
		}

		const data = await Product.find({key: {$in:reqObject["ids"]}});
    return { 
			status: 'success',
			count: data.length,
			data,
			metadata: globalObject.metadata
		};
  } catch (err) {
    logger.log("error", err);
    return { 
			status: 'fail',
			error: err,
			metadata: globalObject.metadata
		};
  }
};

// add new rows
// This event will only be called for tablet 2
module.exports.addRow = async (req, masterSocket) => {
	const globalObject = await Global.findOne({id:1});
  try {
		const reqObject = req;
		if(ME != 'tablet_2')
		return {
			status: 'outdated',
			message: 'Writes only occur at tablet_2',
			metadata: globalObject.metadata
		}
    // add row logic
		let curr_id = globalObject.metadata[ME][1];
		reqObject.data.forEach(doc => {
			curr_id += 1;
			doc.key = curr_id;
		});
		const data = await Product.insertMany(reqObject.data);
		globalObject.metadata[ME][1] = curr_id;
		globalObject.markModified('metadata');
		await globalObject.save();
		const newMetadata = {metadata:globalObject.metadata};
		await emitRequest(masterSocket, 'update-metadata', newMetadata);
		return { 
			status: 'success',
			data,
			metadata: globalObject.metadata
		};
  } catch (err) {
    logger.log("error", err);
		return { 
			status: 'fail',
			error: err,
			metadata: globalObject.metadata
  	};
	}
};

// update a single row
module.exports.set = async (req, masterSocket) => {
	const globalObject = await Global.findOne({id:1});

  try {
		const reqObject = req;
		if(!reqObject.ids.every(id => id >= globalObject.metadata[ME][0] && id <= globalObject.metadata[ME][1]))
		return {
			status: 'outdated',
			metadata: globalObject.metadata
		}
		if(!reqObject.ids.every(id => id >= globalObject.metadata['tablet_1'][0] && id <= globalObject.metadata['tablet_2'][1]))
		return {
			status: 'off-limits',
			metadata: globalObject.metadata
		}
    // update row logic
		// after updating add the update object to Global.updatedRows
		const data = await Product.findOneAndUpdate({key: reqObject.ids[0]}, reqObject.data, {new: true});
		await Global.findOneAndUpdate({id:1}, {$push: {updatedRows: {id: reqObject.ids[0], query: reqObject.data }}}, {new: true, upsert: true});
		return { 
			status: 'success',
			data,
			metadata: globalObject.metadata
		};
  } catch (err) {
    logger.log("error", err);
    return { 
			status: 'fail',
			error: err,
			metadata: globalObject.metadata
		};
  }
};

// delete certain cells in a single row
module.exports.deleteCells = async (req, masterSocket) => {
	const globalObject = await Global.findOne({id:1});

  try {
		const reqObject = req;
		if(!reqObject.ids.every(id => id >= globalObject.metadata[ME][0] && id <= globalObject.metadata[ME][1]))
		return {
			status: 'outdated',
			metadata: globalObject.metadata
		}
		if(!reqObject.ids.every(id => id >= globalObject.metadata['tablet_1'][0] && id <= globalObject.metadata['tablet_2'][1]))
		return {
			status: 'off-limits',
			metadata: globalObject.metadata
		}
    // delete cells logic
		// after updating add the update object to Global.updatedRows
		const fieldsToDelete = reqObject.data.reduce((acc,curr)=> (acc[curr]=1,acc),{});
		const data = await Product.findOneAndUpdate({key: reqObject.ids[0]}, {$unset: fieldsToDelete}, {new: true});
		await Global.findOneAndUpdate({id:1}, {$push: {deletedCells: {id: reqObject.ids[0], fields: fieldsToDelete}}}, {new: true, upsert: true});

		return { 
			status: 'success',
			data,
			metadata: globalObject.metadata
		};
  } catch (err) {
    logger.log("error", err);
    return { 
			status: 'fail',
			error: err,
			metadata: globalObject.metadata
		};
  }
};

// delete rows
module.exports.deleteRow = async (req, masterSocket) => {
	const globalObject = await Global.findOne({id:1});

  try {
		const reqObject = req;
		if(!reqObject.ids.every(id => id >= globalObject.metadata[ME][0] && id <= globalObject.metadata[ME][1]))
		return {
			status: 'outdated',
			metadata: globalObject.metadata
		}
		if(!reqObject.ids.every(id => id >= globalObject.metadata['tablet_1'][0] && id <= globalObject.metadata['tablet_2'][1]))
		return {
			status: 'off-limits',
			metadata: globalObject.metadata
		}
    // delete row logic
		// after deleting add the update object to Global.deletedRows array
		const data = await Product.deleteMany({key: {$in: reqObject.ids}});
		await Global.findOneAndUpdate({id:1}, {$push: {deletedRows: reqObject.ids}}, {new: true, upsert: true});
		return { 
			status: 'success',
			data,
			metadata: globalObject.metadata
		};

  } catch (err) {
    logger.log("error", err);
    return { 
			status: 'fail',
			error: err,
			metadata: globalObject.metadata
		};
  }
};

// returns metadata
module.exports.getMetadata = async (req, masterSocket) => {
  try {
		const reqObject = req;
    const globalObject = await Global.findOne({id:1});
		return {metadata: globalObject.metadata};

  } catch (err) {
    logger.log("error", err);
    return { 
			status: 'fail',
			error: err
		};
  }
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
