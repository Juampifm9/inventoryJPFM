const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { pool, init } = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Inicializa esquema al arrancar
init().catch(err => {
  console.error('DB init error:', err);
  process.exit(1);
});

// Salud
app.get('/', (_req, res) => res.send('Inventory API OK'));

// ====== Endpoints ejemplo ======
// GET: listar productos
app.get('/api/products', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, price, created_at FROM products ORDER BY id DESC LIMIT 100'
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

// POST: crear producto
app.post('/api/products', async (req, res) => {
  try {
    const { name, price } = req.body;
    if (!name || price == null) return res.status(400).json({ error: 'name/price requeridos' });

    const [r] = await pool.execute(
      'INSERT INTO products(name, price) VALUES(?, ?)',
      [name, price]
    );
    res.status(201).json({ id: r.insertId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

// PUT: actualizar producto
app.put('/api/products/:id', async (req, res) => {
  try {
    const { name, price } = req.body;
    const { id } = req.params;
    const [r] = await pool.execute(
      'UPDATE products SET name = COALESCE(?, name), price = COALESCE(?, price) WHERE id = ?',
      [name ?? null, price ?? null, id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: 'no existe' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

// DELETE: eliminar producto
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [r] = await pool.execute('DELETE FROM products WHERE id = ?', [id]);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'no existe' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'DB error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API escuchando en http://localhost:${PORT}`));
