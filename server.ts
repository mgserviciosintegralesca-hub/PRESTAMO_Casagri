import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

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
      lastUpdated: new Date().toISOString(),
      source: "BCV (via DolarAPI)"
    });
  } catch (error) {
    console.error("Error fetching rates:", error);
    res.status(500).json({ error: "Failed to fetch exchange rates" });
  }
});

// AI Summarization endpoint
app.post("/api/gemini/summarize-loan", async (req, res) => {
  const { loanData } = req.body;
  if (!loanData) return res.status(400).json({ error: "Missing loan data" });

  try {
    const prompt = `Analiza este préstamo y genera un resumen profesional detallado para el patrono y el trabajador en español. 
    Datos: ${JSON.stringify(loanData)}. 
    Incluye proyecciones de ahorro o impacto financiero si aplica.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
    });

    res.json({ summary: response.text });
  } catch (error) {
    console.error("Gemini error:", error);
    res.status(500).json({ error: "AI processing failed" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
