const Product = require("../models/ProductModel");
const Global = require("../models/GlobalModel");
const { v4: uuidv4 } = require('uuid');
// Include db seeder files:-
//----------------------------
const products = require("../models/seeds/products");


const logger = require("../utils/logger");


const initializeDB = async () => {
	logger.log('info', `⏳ Checking DB.`);

	// We need to check that if the data is present in database. If not we need to insert it.
	
	let productsCount = await Product.countDocuments();
	const GlobalCount = await Global.countDocuments();
	if(productsCount > 0 && GlobalCount > 0)
	{
		logger.log('info', `✅ DB is okay.`);
		return;
	}
	logger.log('info', `🏁 DB is not initialized. Started db seeding...`);

	if( productsCount <= 0)
	{
		await Product.insertMany(products.seeds);
		productsCount = products.seeds.length;
		logger.log('info', `✅ Products are seeded --> count = ${productsCount}`);

	}
	if( GlobalCount <= 0)
	{
		const tabletSize = Math.floor(productsCount/3);
		const separatorKey = products.seeds[2 * tabletSize-1].key;
		const lastKey = products.seeds[productsCount-1].key;
		const tablet_1_range = [1, separatorKey];
		const tablet_2_range = [separatorKey + 1, lastKey];
		const metaData = {
			tablet_1:tablet_1_range,
			tablet_2:tablet_2_range
		}
		await Global.create({
			metadata: metaData,
			extraRowsStartId: lastKey+1,
			currentVersion: uuidv4()
		});
		logger.log('info', `✅ Meta data is seeded`);
	}
	
	
	logger.log('info', `✅ Finished db seeding successfully`);
};
module.exports = initializeDB;

