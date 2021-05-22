const Product = require("../models/ProductModel");

// Include db seeder files:-
//----------------------------
const products = require("../models/seeds/products");

const logger = require("../utils/logger");


const initializeDB = async () => {
	logger.log('info', `⏳ Checking DB.`);

	// We need to check that if the data is present in database. If not we need to insert it.
	
	const productsCount = (await Product.find()).length;
	if(productsCount > 0)
	{
		logger.log('info', `✅ DB is okay.`);
		return;
	}
	logger.log('info', `🏁 DB is not initialized. Started db seeding...`);

	if( productsCount <= 0)
	{
		logger.log('info', `✅ Products are seeded --> count = ${productsCount}`);
		await Product.insertMany(products.seeds);
	}
	logger.log('info', `✅ Finished db seeding successfully`);
};
module.exports = initializeDB;

