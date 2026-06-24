import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configurar __dirname correctamente para ES Modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json());

// 1. Servir los archivos estáticos del frontend desde la carpeta 'dist'
app.use(express.static(path.join(__dirname, "dist")));

// =================================================================
// ENDPOINTS DE LA API
// =================================================================

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// API endpoint to fetch BCV rates
app.get("/api/rates", async (req, res) => {
  try {
    // Using a reliable unofficial API for BCV rates
    const [usdRes, eurRes] = await Promise.all([
      axios.get("https://ve.dolarapi.com/v1/dolares/bcv"),
      axios.get("https://ve.dolarapi.com/v1/euros/bcv")
    ]);

    res.json({
      usd: usdRes.data.promedio,
      eur: eurRes.data.promedio,
    });
  } catch (error) {
    console.error("Error fetching rates:", error);
    res.status(500).json({ error: "Failed to fetch exchange rates" });
  }
});

// =================================================================
// ENRUTAMIENTO DEL FRONTEND (SPA)
// =================================================================

// 2. Redirigir cualquier otra petición al index.html de React/Vite
app.get("*", (req, res) => {
  // Evita interceptar por error rutas destinadas a la API
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(__dirname, "dist", "index.html"));
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});