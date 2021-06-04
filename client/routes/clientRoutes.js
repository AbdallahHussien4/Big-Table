const express = require("express");
const clientController = require("../controllers/clientController");

const router = express.Router();

// 1. Get current restaurant info
router.post(
  "/send-db-query",
  clientController.sendDbQuery
);

module.exports = router;
