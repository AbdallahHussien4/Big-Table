const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
	{
		key: {
			type: Number,
			unique: [true, "The ket field has to be unique"]
		},
		product_name: String,
		manufacturer: String,
		price: String,
		number_available_in_stock: String,
		number_of_reviews: Number,
		number_of_answered_questions: Number,
		average_review_rating: String,
		amazon_category_and_sub_category: String,
		customers_who_bought_this_item_also_bought: String,
		description: String,
		product_information: String,
		product_description: String,
		items_customers_buy_after_viewing_this_item: String,
		customer_questions_and_answers: String,
		customer_reviews: String,
		sellers: String
	},
	{
		strict: "throw",
	}
);


const Product = mongoose.model("Product", ProductSchema);
module.exports = Product;
