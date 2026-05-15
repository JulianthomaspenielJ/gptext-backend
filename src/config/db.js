const { Pool } = require("pg");
const dotenv = require("dotenv")
// require("dotenv").config();

const envFile = process.env.NODE_ENV === "production"
  ? ".env.production"
  : ".env.development";
dotenv.config({ path: envFile });

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
});

module.exports = pool;
