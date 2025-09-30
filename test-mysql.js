// scripts/test-mysql.js
require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
    });
    const [rows] = await conn.query('SELECT 1 AS ok');
    console.log('MySQL connection OK ->', rows);
    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error('MySQL connection ERROR ->', err.message);
    process.exit(1);
  }
})();
