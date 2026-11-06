const path = require("path");
const dotenv = require("dotenv");

const result = dotenv.config({
  path: path.resolve(__dirname, "../.env.test"),
  override: true,
});

if (result.error) {
  throw result.error;
}

console.log("Jest database:", process.env.DB_NAME);