const path = require('path');
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL;
const usePostgres = Boolean(DATABASE_URL);

let db;
let sqliteDb;

function parseEvidence(evidence) {
  if (!evidence) return [];
  if (Array.isArray(evidence)) return evidence;
  if (typeof evidence === 'string') {
    try {
      const parsed = JSON.parse(evidence);
      return Array.isArray(parsed) ? parsed : [{ name: 'Evidencia', data: evidence }];
    } catch {
      return [{ name: 'Evidencia', data: evidence }];
    }
  }
  return [];
}

function serializeEvidence(evidence) {
  if (!evidence) return null;
  if (typeof evidence === 'string') return evidence;
  return JSON.stringify(evidence);
}

if (usePostgres) {
  db = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  db.connect()
    .then(() => console.log('Conectado a PostgreSQL'))
    .catch((error) => {
      console.error('No se pudo conectar a PostgreSQL:', error.message);
      process.exit(1);
    });

  const createTableSql = `
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      date TEXT,
      priority TEXT,
      evidence TEXT,
      hours REAL,
      completed BOOLEAN DEFAULT FALSE,
      createdAt TEXT,
      completedAt TEXT
    );
  `;

  db.query(createTableSql).catch((error) => {
    console.error('Error creando la tabla tasks en PostgreSQL:', error.message);
    process.exit(1);
  });
} else {
  const dbPath = path.join(__dirname, 'database', 'Ditarea.sqlite');
  sqliteDb = new sqlite3.Database(dbPath, (error) => {
    if (error) {
      console.error('No se pudo conectar a la base de datos SQLite:', error.message);
      process.exit(1);
    }
  });

  sqliteDb.serialize(() => {
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS tasks (
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
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname)));

app.get('/tasks', async (req, res) => {
  try {
    if (usePostgres) {
      const result = await db.query('SELECT * FROM tasks ORDER BY createdAt DESC');
      const tasks = result.rows.map((row) => ({
        ...row,
        completed: Boolean(row.completed),
        evidence: parseEvidence(row.evidence),
      }));
      res.json(tasks);
      return;
    }

    sqliteDb.all('SELECT * FROM tasks ORDER BY createdAt DESC', (error, rows) => {
      if (error) return res.status(500).json({ error: error.message });
      const tasks = rows.map((row) => ({
        ...row,
        completed: Boolean(row.completed),
      }));
      res.json(tasks);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/tasks', async (req, res) => {
  const { id, title, description, date, priority, evidence, hours, completed, createdAt, completedAt } = req.body;
  const evidenceJson = serializeEvidence(evidence);

  try {
    if (usePostgres) {
      await db.query(
        `INSERT INTO tasks (id, title, description, date, priority, evidence, hours, completed, createdAt, completedAt)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [id, title, description, date, priority, evidenceJson, hours, completed, createdAt, completedAt]
      );
      return res.status(201).json(req.body);
    }

    const stmt = sqliteDb.prepare(`INSERT INTO tasks (id, title, description, date, priority, evidence, hours, completed, createdAt, completedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    stmt.run(id, title, description, date, priority, evidenceJson, hours, completed ? 1 : 0, createdAt, completedAt, function (error) {
      if (error) return res.status(500).json({ error: error.message });
      res.status(201).json(req.body);
    });
    stmt.finalize();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, date, priority, evidence, hours, completed, completedAt } = req.body;
  const evidenceJson = serializeEvidence(evidence);

  try {
    if (usePostgres) {
      const result = await db.query(
        `UPDATE tasks SET title = $1, description = $2, date = $3, priority = $4, evidence = $5, hours = $6, completed = $7, completedAt = $8 WHERE id = $9`,
        [title, description, date, priority, evidenceJson, hours, completed, completedAt, id]
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
      return res.json({ success: true });
    }

    const stmt = sqliteDb.prepare(`UPDATE tasks SET title = ?, description = ?, date = ?, priority = ?, evidence = ?, hours = ?, completed = ?, completedAt = ? WHERE id = ?`);
    stmt.run(title, description, date, priority, evidenceJson, hours, completed ? 1 : 0, completedAt, id, function (error) {
      if (error) return res.status(500).json({ error: error.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
      res.json({ success: true });
    });
    stmt.finalize();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/tasks/:id', async (req, res) => {
  const { id } = req.params;

  try {
    if (usePostgres) {
      const result = await db.query('DELETE FROM tasks WHERE id = $1', [id]);
      if (result.rowCount === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
      return res.json({ success: true });
    }

    const stmt = sqliteDb.prepare('DELETE FROM tasks WHERE id = ?');
    stmt.run(id, function (error) {
      if (error) return res.status(500).json({ error: error.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Tarea no encontrada' });
      res.json({ success: true });
    });
    stmt.finalize();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:${PORT}`);
});
