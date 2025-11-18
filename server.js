require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mysql = require("mysql2/promise");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   1) Pool de conexión MySQL
   ========================= */
const requiredEnv = ["DB_HOST", "DB_USER", "DB_PASS", "DB_NAME"];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.warn(`⚠️ Falta la variable de entorno ${key}`);
  }
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Probar conexión al iniciar
(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("✅ Conexión a la base de datos correcta");
  } catch (err) {
    console.error("❌ Error al conectar a la base de datos:", err.message);
  }
})();

/* =========================
   2) Middlewares
   ========================= */
app.use(helmet());
app.use(cors()); // Puedes restringir origen si quieres
app.use(express.json());

/* =========================
   3) Rutas
   ========================= */

// Health check
app.get("/", (req, res) => {
  res.send("API Biblioteca Multimedia en la Nube - OK");
});

// GET /api/resources -> lista todos los recursos
app.get("/api/resources", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, title, description, url, type, platform, created_at FROM resources ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error("Error al obtener recursos:", err);
    res.status(500).json({ message: "Error al obtener los recursos" });
  }
});

// POST /api/resources -> crea un nuevo recurso
app.post("/api/resources", async (req, res) => {
  try {
    const { title, description, url, type, platform } = req.body;

    if (!title || !url) {
      return res
        .status(400)
        .json({ message: "El título y la URL son obligatorios" });
    }

    const [result] = await pool.query(
      `
      INSERT INTO resources (title, description, url, type, platform)
      VALUES (?, ?, ?, ?, ?)
    `,
      [
        title.trim(),
        (description || "").trim(),
        url.trim(),
        (type || "Otro").trim(),
        (platform || "Otro").trim()
      ]
    );

    const insertedId = result.insertId;

    const [rows] = await pool.query(
      "SELECT id, title, description, url, type, platform, created_at FROM resources WHERE id = ?",
      [insertedId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error al crear recurso:", err);
    res.status(500).json({ message: "Error al crear el recurso" });
  }
});

// DELETE /api/resources/:id -> elimina recurso
app.delete("/api/resources/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: "ID inválido" });
    }

    const [result] = await pool.query("DELETE FROM resources WHERE id = ?", [
      id
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Recurso no encontrado" });
    }

    res.json({ message: "Recurso eliminado correctamente" });
  } catch (err) {
    console.error("Error al eliminar recurso:", err);
    res.status(500).json({ message: "Error al eliminar el recurso" });
  }
});

// 404 básico para rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ message: "Ruta no encontrada" });
});

/* =========================
   4) Iniciar servidor
   ========================= */
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en el puerto ${PORT}`);
});
