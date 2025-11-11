// server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mysql = require("mysql2/promise");

const app = express();

/* =========================
   1) Variables de entorno
   ========================= */
const PORT = process.env.PORT || 3000;
const DB_HOST = process.env.DB_HOST;
const DB_USER = process.env.DB_USER;
const DB_PASS = process.env.DB_PASS;
const DB_NAME = process.env.DB_NAME;
const DB_PORT = parseInt(process.env.DB_PORT || "3306", 10);
const FRONT_ORIGIN = process.env.FRONT_ORIGIN || "*"; // p.ej. https://tu-frontend.onrender.com

// Falla temprano si falta algo crítico
for (const k of ["DB_HOST", "DB_USER", "DB_PASS", "DB_NAME"]) {
  if (!process.env[k]) {
    console.error(`Falta la variable de entorno: ${k}`);
    process.exit(1);
  }
}

/* =========================
   2) Middlewares de seguridad
   ========================= */
app.disable("x-powered-by");
app.use(helmet());
app.use(express.json());

// CORS (restringe si defines FRONT_ORIGIN)
app.use(
  cors(
    FRONT_ORIGIN === "*"
      ? {}
      : { origin: FRONT_ORIGIN.split(",").map((s) => s.trim()) }
  )
);

// Rate limit (protege endpoints públicos)
app.use(
  rateLimit({
    windowMs: 60 * 1000, // 1 min
    max: 120,            // 120 req/min por IP
    standardHeaders: true,
    legacyHeaders: false,
  })
);

/* =========================
   3) Base de datos (pool)
   ========================= */
const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME,
  port: DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

/* Helper para ID */
function getId(req) {
  const raw = req.params.id ?? req.query.id ?? req.body?.id;
  const id = parseInt(raw, 10);
  return Number.isInteger(id) ? id : null;
}

/* =========================
   4) Endpoints
   ========================= */

// Salud (útil para Render)
app.get("/healthz", async (_req, res) => {
  try {
    const [r] = await pool.query("SELECT 1 AS ok");
    res.json({ ok: r?.[0]?.ok === 1 });
  } catch {
    res.status(503).json({ ok: false });
  }
});

// GET: listar usuarios
app.get("/users", async (_req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, name FROM users ORDER BY id DESC");
    return res.json(rows);
  } catch {
    return res.status(500).json({ error: "Error interno" });
  }
});

// POST: insertar usuario
app.post("/users", async (req, res) => {
  try {
    const name = (req.body?.name || "").trim();
    if (!name) return res.status(400).json({ success: false, error: "Nombre no válido" });

    const [result] = await pool.execute("INSERT INTO users (name) VALUES (?)", [name]);
    if (result.affectedRows === 1) {
      return res.json({ success: true, message: "Usuario agregado correctamente" });
    }
    return res.status(500).json({ success: false, error: "No se pudo insertar" });
  } catch {
    return res.status(500).json({ success: false, error: "Error interno" });
  }
});

// PUT/PATCH: editar usuario (/users/:id o ?id= o body.id)
async function updateUserHandler(req, res) {
  try {
    const id = getId(req);
    const name = (req.body?.name || "").trim();

    if (!Number.isInteger(id)) return res.status(400).json({ success: false, error: "ID no proporcionado" });
    if (!name) return res.status(400).json({ success: false, error: "Nombre no válido" });

    const [result] = await pool.execute("UPDATE users SET name = ? WHERE id = ?", [name, id]);
    if (result.affectedRows === 1) {
      const [rows] = await pool.execute("SELECT id, name FROM users WHERE id = ?", [id]);
      return res.json({ success: true, message: "Usuario actualizado correctamente", user: rows[0] || { id, name } });
    }
    return res.status(404).json({ success: false, error: "Usuario no encontrado" });
  } catch {
    return res.status(500).json({ success: false, error: "Error interno" });
  }
}
app.put("/users/:id?", updateUserHandler);
app.patch("/users/:id?", updateUserHandler);

// DELETE: eliminar usuario (/users/:id o ?id=)
app.delete("/users/:id?", async (req, res) => {
  try {
    const id = getId(req);
    if (!Number.isInteger(id)) return res.status(400).json({ success: false, error: "ID no proporcionado" });

    const [result] = await pool.execute("DELETE FROM users WHERE id = ?", [id]);
    if (result.affectedRows === 1) {
      return res.json({ success: true, message: "Usuario eliminado correctamente" });
    }
    return res.status(404).json({ success: false, error: "Usuario no encontrado" });
  } catch {
    return res.status(500).json({ success: false, error: "Error interno" });
  }
});

/* =========================
   5) Arranque y cierre
   ========================= */
app.listen(PORT, async () => {
  try {
    await pool.query("SELECT 1");
    console.log(`API lista en http://localhost:${PORT}`);
  } catch {
    console.error("No se pudo conectar a la base de datos. Revisa tus variables de entorno.");
    process.exit(1);
  }
});

// Cierre limpio
process.on("SIGTERM", async () => {
  try { await pool.end(); } finally { process.exit(0); }
});
process.on("SIGINT", async () => {
  try { await pool.end(); } finally { process.exit(0); }
});
