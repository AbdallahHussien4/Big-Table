const jwt = require('jsonwebtoken');
const { promisify } = require('util');

const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const DbQueryManager = require("../utils/dbQueryManager");


// read whole one or more rows
module.exports.readRows = async (data) => {
	try{
		// read row logic
		next();
	}
	catch(err)
	{
		next(err);
	}

};

// add a new row
module.exports.addRow = async (data) => {
	try{
		// add row logic
		next();
	}
	catch(err)
	{
		next(err);
	}

};

// update row
module.exports.set = async (data) => {
	try{
		// update row logic
		next();
	}
	catch(err)
	{
		next(err);
	}

};

// delete certain cells in a row
module.exports.deleteCells = async (data) => {
	try{
		// delete cell logic
		next();
	}
	catch(err)
	{
		next(err);
	}

};


// delete a row
module.exports.deleteRow = async (data) => {
	try{
		// delete row logic
		next();
	}
	catch(err)
	{
		next(err);
	}

};





