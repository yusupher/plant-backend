const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fetch = require("node-fetch");
const FormData = require("form-data");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

/* =========================
   ✅ CORS FIXED
========================= */
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json({ limit: "10mb" }));

/* =========================
   🔑 ENV KEYS
========================= */
const PLANTNET_KEY = process.env.PLANTNET_KEY;
const ROBOFLOW_KEY = process.env.ROBOFLOW_KEY;
const PLANT_ID_KEY = process.env.PLANT_ID_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

/* =========================
   🤖 MODELS (IMPORTANT FIX)
========================= */
const PLANT_MODEL = "plant-dataset-ypln5-to68g";
const DISEASE_MODEL = "plant-disease-xqd8b-tvz68";
const INSECT_MODEL = "insect-e746x-iuclt";

/* =========================
   🟢 HEALTH CHECK
========================= */
app.get("/", (req, res) => {
  res.json({
    status: "🌿 Smart Farm AI Backend Running",
    endpoints: [
      "/identify",
      "/disease",
      "/detect-insect",
      "/analyze-all",
      "/comprehensive-info"
    ]
  });
});

/* =========================
   🔥 ROBOFLOW FIXED HELPER
========================= */
async function runRoboflow(model, base64) {
  const url = `https://detect.roboflow.com/${model}/1?api_key=${ROBOFLOW_KEY}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: base64
    });

    const text = await res.text();

    try {
      return JSON.parse(text);
    } catch {
      return { error: "Invalid JSON", raw: text };
    }
  } catch (err) {
    return { error: err.message };
  }
}

/* =========================
   🌿 PLANT IDENTIFICATION
========================= */
app.post("/identify", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });

    const form = new FormData();
    form.append("images", req.file.buffer, {
      filename: "plant.jpg",
      contentType: "image/jpeg"
    });

    const response = await fetch(
      `https://my-api.plantnet.org/v2/identify/all?api-key=${PLANTNET_KEY}`,
      { method: "POST", body: form, headers: form.getHeaders() }
    );

    const data = await response.json();

    res.json({ success: true, source: "PlantNet", data });

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

    if (!rf.error && rf.predictions) {
      return res.json({
        success: true,
        source: "Roboflow",
        data: rf
      });
    }

    const plantRes = await fetch(
      "https://api.plant.id/v3/health_assessment",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Api-Key": PLANT_ID_KEY
        },
        body: JSON.stringify({
          images: [{ image: base64 }],
          health: "only"
        })
      }
    );

    const plantData = await plantRes.json();

    res.json({
      success: true,
      source: "Plant.id fallback",
      data: plantData
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   🐛 INSECT DETECTION
========================= */
app.post("/detect-insect", upload.single("image"), async (req, res) => {
  try {
    const base64 = req.file.buffer.toString("base64");

    const rf = await runRoboflow(INSECT_MODEL, base64);

    if (rf.error) {
      return res.json({
        success: false,
        error: rf.error
      });
    }

    let best = null;

    if (rf.predictions?.length) {
      best = rf.predictions.reduce((a, b) =>
        b.confidence > a.confidence ? b : a
      );
    }

    res.json({
      success: true,
      result: best?.class || "No insect detected",
      confidence: best ? Math.round(best.confidence * 100) : 0,
      raw: rf
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   🌾 FULL ANALYSIS (FIXED)
========================= */
app.post("/analyze-all", upload.single("image"), async (req, res) => {
  try {
    const base64 = req.file.buffer.toString("base64");

    const [plant, disease, insect] = await Promise.all([
      runRoboflow(PLANT_MODEL, base64),
      runRoboflow(DISEASE_MODEL, base64),
      runRoboflow(INSECT_MODEL, base64)
    ]);

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
   🤖 AI INFO
========================= */
app.post("/comprehensive-info", async (req, res) => {
  try {
    const { query, type } = req.body;

    const prompt = `Return structured JSON ${type} info for: ${query}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();

    const text = data.content?.map(b => b.text).join("") || "";

    try {
      res.json(JSON.parse(text));
    } catch {
      res.json({ raw: text });
    }

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   🚀 START SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Smart Farm AI running on port", PORT);
});
