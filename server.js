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
// 🔑 ENV VARIABLES (RENDER)
// ==============================
const PLANTNET_KEY = process.env.PLANTNET_KEY;
const ROBOFLOW_KEY = process.env.ROBOFLOW_KEY;
const ROBOFLOW_PLANT_MODEL = "plant-dataset-ypln5-to68g/1";
const ROBOFLOW_PEST_MODEL = "insect-e746x-iuclt/1";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const PLANT_ID_KEY = process.env.PLANT_ID_KEY;

// ==============================
// 🟢 HEALTH CHECK
// ==============================
app.get("/", (req, res) => {
  res.json({
    status: "🌿 Smart Farm AI Backend Running",
    endpoints: ["/identify", "/disease", "/detect-pest", "/comprehensive-info"]
  });
});

// ==============================
// 🌿 PLANT IDENTIFICATION (PlantNet)
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

    // =======================
    // 🔹 ROBOFLOW DISEASE MODEL
    // =======================
    try {
      const rfUrl = `https://serverless.roboflow.com/${ROBOFLOW_PLANT_MODEL}?api_key=${ROBOFLOW_KEY}`;

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
      console.log("Roboflow disease failed:", err.message);
    }

    // =======================
    // 🔹 Plant.id fallback
    // =======================
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
// 🐛 PEST DETECTION (FIXED)
// ==============================
app.post("/detect-pest", upload.single("image"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({
        success: false,
        error: "No image uploaded"
      });

    const base64 = req.file.buffer.toString("base64");

    const url = `https://serverless.roboflow.com/${ROBOFLOW_PEST_MODEL}?api_key=${ROBOFLOW_KEY}`;

    const rfRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: base64
    });

    const text = await rfRes.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.json({
        success: false,
        error: "Invalid Roboflow response",
        raw: text
      });
    }

    let best = null;

    if (data.predictions && data.predictions.length > 0) {
      best = data.predictions.reduce((a, b) =>
        b.confidence > a.confidence ? b : a
      );
    }

    return res.json({
      success: true,
      result: best ? best.class : "No pest detected",
      confidence: best ? Math.round(best.confidence * 100) : 0,
      raw: data
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
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
      prompt = `Return structured JSON plant info for: ${query}`;
    } else if (type === "disease") {
      prompt = `Return structured JSON plant disease info for: ${query}`;
    } else if (type === "pest") {
      prompt = `Return structured JSON pest info for: ${query}`;
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

    try {
      return res.json(JSON.parse(clean));
    } catch {
      return res.json({ raw: text });
    }

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================
// 🚀 START SERVER
// ==============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Smart Farm AI running on port", PORT);
});
