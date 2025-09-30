// test-mysql.js (en la raíz del repo)
require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  try {
    console.log('ENV:', {
      DB_HOST: process.env.DB_HOST,
      DB_PORT: process.env.DB_PORT,
      DB_USER: process.env.DB_USER,
      DB_NAME: process.env.DB_NAME
    });
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
    });
    const [rows] = await conn.query('SELECT 1 AS ok');
    console.log('MySQL connection OK ->', rows);
    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.code || err.name, '-', err.message);
    console.error(err.stack);
    process.exit(1);
  }
})();
