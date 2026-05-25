const path = require('path');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const dbPath = path.join(__dirname, 'database', 'Ditarea.sqlite');

const db = new sqlite3.Database(dbPath, (error) => {
  if (error) {
    console.error('No se pudo conectar a la base de datos:', error.message);
    process.exit(1);
  }
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    date TEXT,
    priority TEXT,
    evidence TEXT,
    hours REAL,
    completed INTEGER DEFAULT 0,
    createdAt TEXT,
    completedAt TEXT
  )`);
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

app.get('/tasks', (req, res) => {
  db.all('SELECT * FROM tasks ORDER BY createdAt DESC', (error, rows) => {
    if (error) return res.status(500).json({ error: error.message });
    const tasks = rows.map((row) => ({
      ...row,
      completed: Boolean(row.completed),
    }));
    res.json(tasks);
  });
});

app.post('/tasks', (req, res) => {
  const { id, title, description, date, priority, evidence, hours, completed, createdAt, completedAt } = req.body;
  const stmt = db.prepare(`INSERT INTO tasks (id, title, description, date, priority, evidence, hours, completed, createdAt, completedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  stmt.run(id, title, description, date, priority, evidence, hours, completed ? 1 : 0, createdAt, completedAt, function (error) {
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(req.body);
  });
  stmt.finalize();
});

app.put('/tasks/:id', (req, res) => {
  const { id } = req.params;
  const { title, description, date, priority, evidence, hours, completed, completedAt } = req.body;
  const stmt = db.prepare(`UPDATE tasks SET title = ?, description = ?, date = ?, priority = ?, evidence = ?, hours = ?, completed = ?, completedAt = ? WHERE id = ?`);
  stmt.run(title, description, date, priority, evidence, hours, completed ? 1 : 0, completedAt, id, function (error) {
    if (error) return res.status(500).json({ error: error.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
    res.json({ success: true });
  });
  stmt.finalize();
});

app.delete('/tasks/:id', (req, res) => {
  const { id } = req.params;
  const stmt = db.prepare('DELETE FROM tasks WHERE id = ?');
  stmt.run(id, function (error) {
    if (error) return res.status(500).json({ error: error.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
    res.json({ success: true });
  });
  stmt.finalize();
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});
