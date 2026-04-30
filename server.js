const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fetch = require("node-fetch");
const FormData = require("form-data");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ==============================
// 🔑 ENV VARIABLES (SET ON RENDER)
// ==============================
const PLANTNET_KEY = process.env.PLANTNET_KEY;
const ROBOFLOW_KEY = process.env.ROBOFLOW_KEY;
const ROBOFLOW_MODEL = "plant-dataset-ypln5-to68g/1";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const PLANT_ID_KEY = process.env.PLANT_ID_KEY;

// ==============================
// 🟢 HEALTH CHECK
// ==============================
app.get("/", (req, res) => {
  res.json({
    status: "🌿 Smart Farm AI Backend Running",
    endpoints: [
      "/identify",
      "/disease",
      "/detect-pest",
      "/comprehensive-info"
    ]
  });
});

// ==============================
// 🌿 PLANT IDENTIFICATION
// ==============================
app.post("/identify", upload.single("image"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ success: false, error: "No image uploaded" });

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
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================
// 🦠 DISEASE DETECTION
// ==============================
app.post("/disease", upload.single("image"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ success: false, error: "No image uploaded" });

    const base64 = req.file.buffer.toString("base64");

    // 🔹 Roboflow
    try {
      const rfUrl = `https://serverless.roboflow.com/${ROBOFLOW_MODEL}?api_key=${ROBOFLOW_KEY}`;

      const rfRes = await fetch(rfUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: base64
      });

      const rfData = await rfRes.json();

      if (rfData && !rfData.error) {
        return res.json({
          success: true,
          source: "Roboflow",
          data: rfData
        });
      }
    } catch (err) {
      console.log("Roboflow failed:", err.message);
    }

    // 🔹 Plant.id fallback
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
      source: "Plant.id (fallback)",
      data: plantData
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================
// 🐛 PEST DETECTION
// ==============================
app.post("/detect-pest", upload.single("image"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ error: "No image uploaded" });

    const base64 = req.file.buffer.toString("base64");

    const rfUrl = `https://serverless.roboflow.com/${ROBOFLOW_MODEL}?api_key=${ROBOFLOW_KEY}`;

    const rfRes = await fetch(rfUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: base64
    });

    const data = await rfRes.json();

    let best = null;
    if (data.predictions && data.predictions.length > 0) {
      best = data.predictions.reduce((max, p) =>
        p.confidence > max.confidence ? p : max
      );
    }

    res.json({
      result: best ? best.class : "No pest detected",
      confidence: best ? Math.round(best.confidence * 100) : 0
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================
// 🤖 COMPREHENSIVE INFO (CLAUDE)
// ==============================
app.post("/comprehensive-info", async (req, res) => {
  try {
    const { query, type } = req.body;

    let prompt = "";

    if (type === "plant") {
      prompt = `Give structured JSON info about plant: ${query}`;
    } else if (type === "disease") {
      prompt = `Give structured JSON info about plant disease: ${query}`;
    } else if (type === "pest") {
      prompt = `Give structured JSON info about pest: ${query}`;
    }

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

    const text = data.content?.map(b => b.text || "").join("") || "";
    const clean = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      return res.json({ raw: text });
    }

    res.json(parsed);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================
// 🚀 START SERVER
// ==============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
