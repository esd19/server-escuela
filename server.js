// server.js
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
require("dotenv").config();

const app = express();

// CORS y headers como en tu PHP
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Vars Render/local
const {
  DB_HOST = "localhost",
  DB_USER = "root",
  DB_PASS = "",
  DB_NAME = "usuarios",
  PORT = 3000,
} = process.env;

// Pool de conexiones
const pool = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// Helper para obtener ID desde params, query o body
function getId(req) {
  const raw = req.params.id ?? req.query.id ?? req.body?.id;
  const id = parseInt(raw, 10);
  return Number.isInteger(id) ? id : null;
}

// GET: listar usuarios
app.get("/users", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, name FROM users ORDER BY id DESC");
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: "Error de conexión: " + (err.message || err) });
  }
});

// POST: insertar usuario
app.post("/users", async (req, res) => {
  try {
    const name = (req.body?.name || "").trim();
    if (!name) {
      return res.status(400).json({ success: false, error: "Nombre no válido" });
    }

    const [result] = await pool.execute("INSERT INTO users (name) VALUES (?)", [name]);

    if (result.affectedRows === 1) {
      return res.json({ success: true, message: "Usuario agregado correctamente" });
    }
    return res.status(500).json({ success: false, error: "Error al insertar usuario" });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Error al insertar usuario" });
  }
});

// PUT/PATCH: editar usuario (acepta /users/:id o /users?id= o body.id)
async function updateUserHandler(req, res) {
  try {
    const id = getId(req);
    const name = (req.body?.name || "").trim();

    if (!Number.isInteger(id)) {
      return res.status(400).json({ success: false, error: "ID no proporcionado" });
    }
    if (!name) {
      return res.status(400).json({ success: false, error: "Nombre no válido" });
    }

    const [result] = await pool.execute("UPDATE users SET name = ? WHERE id = ?", [name, id]);

    if (result.affectedRows === 1) {
      // Opcional: devolver el registro actualizado
      const [rows] = await pool.execute("SELECT id, name FROM users WHERE id = ?", [id]);
      return res.json({
        success: true,
        message: "Usuario actualizado correctamente",
        user: rows[0] || { id, name },
      });
    }
    return res.status(404).json({ success: false, error: "Usuario no encontrado" });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Error al actualizar usuario" });
  }
}
app.put("/users/:id?", updateUserHandler);
app.patch("/users/:id?", updateUserHandler);

// DELETE: eliminar usuario ?id=123 o /users/123
app.delete("/users/:id?", async (req, res) => {
  try {
    const id = getId(req);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ success: false, error: "ID no proporcionado" });
    }

    const [result] = await pool.execute("DELETE FROM users WHERE id = ?", [id]);

    if (result.affectedRows === 1) {
      return res.json({ success: true, message: "Usuario eliminado correctamente" });
    }
    return res.status(404).json({ success: false, error: "Usuario no encontrado" });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Error al eliminar usuario" });
  }
});

// Render usa process.env.PORT
app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});
