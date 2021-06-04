const mongoose = require("mongoose");

const GlobalSchema = new mongoose.Schema(
	{
		id: {
			type: Number,
			default: 1		// To be used to find the one and only document in this collection
		},
		metadata: Object,
		extraRowsStartId: Number,
		currentVersion: String,
		deletedRows: {
			type: [Number]
		},
		updatedRows: {
			type: [Object]
		},
		deletedCells: {
			type: [Object]
		}
	},
	{
		strict: "throw",
	}
);


const Global = mongoose.model("Global", GlobalSchema);
module.exports = Global;
