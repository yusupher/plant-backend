const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fetch = require("node-fetch");
const FormData = require("form-data");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

/* =========================
   MIDDLEWARE
========================= */
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));

/* =========================
   ENV KEYS
========================= */
const PLANTNET_KEY = process.env.PLANTNET_KEY;
const ROBOFLOW_KEY = process.env.ROBOFLOW_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

/* =========================
   MODELS
========================= */
const PLANT_MODEL = "plant-dataset-ypln5-to68g/1";
const DISEASE_MODEL = "plant-disease-xqd8b-tvz68/1";
const INSECT_MODEL = "insect-e746x-iuclt/1";

/* =========================
   HEALTH CHECK
========================= */
app.get("/", (req, res) => {
  res.json({
    status: "🌿 Smart Farm AI Backend Running",
    endpoints: [
      "/identify",
      "/disease",
      "/insect",
      "/analyze-all",
      "/comprehensive-info"
    ]
  });
});

/* =========================
   🔥 ROBOFLOW FIXED HELPER
========================= */
async function runRoboflow(model, base64) {
  try {
    const url = `https://detect.roboflow.com/${model}?api_key=${ROBOFLOW_KEY}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: base64
    });

    const data = await res.json();
    return data;
  } catch (err) {
    return { error: err.message };
  }
}

/* =========================
   🌿 PLANT IDENTIFICATION (PlantNet)
========================= */
app.post("/identify", upload.single("image"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ error: "No image uploaded" });

    const form = new FormData();
    form.append("images", req.file.buffer, {
      filename: "plant.jpg",
      contentType: "image/jpeg"
    });

    const response = await fetch(
      `https://my-api.plantnet.org/v2/identify/all?api-key=${PLANTNET_KEY}`,
      {
        method: "POST",
        body: form,
        headers: form.getHeaders()
      }
    );

    const data = await response.json();

    res.json({
      success: true,
      source: "PlantNet",
      data
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   🦠 DISEASE DETECTION
========================= */
app.post("/disease", upload.single("image"), async (req, res) => {
  try {
    const base64 = req.file.buffer.toString("base64");

    const rf = await runRoboflow(DISEASE_MODEL, base64);

    if (rf.error) {
      return res.json({
        success: false,
        source: "Roboflow error",
        error: rf.error
      });
    }

    res.json({
      success: true,
      source: "Roboflow",
      data: rf
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   🐛 INSECT DETECTION
========================= */
app.post("/insect", upload.single("image"), async (req, res) => {
  try {
    const base64 = req.file.buffer.toString("base64");

    const rf = await runRoboflow(INSECT_MODEL, base64);

    let best = null;

    if (rf.predictions?.length > 0) {
      best = rf.predictions.reduce((a, b) =>
        b.confidence > a.confidence ? b : a
      );
    }

    res.json({
      success: true,
      result: best ? best.class : "No insect detected",
      confidence: best ? Math.round(best.confidence * 100) : 0,
      raw: rf
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   🌾 FULL ANALYSIS
========================= */
app.post("/analyze-all", upload.single("image"), async (req, res) => {
  try {
    const base64 = req.file.buffer.toString("base64");

    const plant = await runRoboflow(PLANT_MODEL, base64);
    const disease = await runRoboflow(DISEASE_MODEL, base64);
    const insect = await runRoboflow(INSECT_MODEL, base64);

    res.json({
      success: true,
      plant,
      disease,
      insect
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   🤖 CLAUDE AI (FULL INFO)
========================= */
app.post("/comprehensive-info", async (req, res) => {
  try {
    const { query, type } = req.body;

    if (!query || !type) {
      return res.status(400).json({
        error: "query and type required"
      });
    }

    const prompt = `
You are an expert agricultural AI.

Return ONLY valid JSON:

{
  "name": "",
  "description": "",
  "causes": [],
  "symptoms": [],
  "treatment": [],
  "prevention": [],
  "farming_tips": []
}

Type: ${type}
Query: ${query}
`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();

    const text = data?.content?.[0]?.text || "";
    const clean = text.replace(/```json|```/g, "").trim();

    try {
      return res.json(JSON.parse(clean));
    } catch {
      return res.json({
        success: true,
        raw: text
      });
    }

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   START SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Smart Farm AI running on port", PORT);
});
