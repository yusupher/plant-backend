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
// KEYS (YOUR REAL KEYS)
// ==============================
const PLANTNET_KEY = "2b104s5nNyqRjHHyiCJveuBwu";
const ROBOFLOW_KEY = "33LnNNZCWrWy3FQGulD9";
const ROBOFLOW_MODEL = "plant-dataset-ypln5-to68g/1";

// ==============================
// HEALTH CHECK
// ==============================
app.get("/", (req, res) => {
  res.json({
    status: "Plant AI Backend Running 🚀",
    endpoints: ["/identify", "/disease"]
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
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ==============================
// 🦠 DISEASE DETECTION (ROBUST)
// ==============================
app.post("/disease", upload.single("image"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ success: false, error: "No image uploaded" });

    const base64 = req.file.buffer.toString("base64");

    // ==========================
    // 1. ROBOFLOW (FIXED SERVERLESS)
    // ==========================
    try {
      const rfUrl = `https://serverless.roboflow.com/${ROBOFLOW_MODEL}?api_key=${ROBOFLOW_KEY}`;

      const rfRes = await fetch(rfUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: base64
      });

      const rfText = await rfRes.text();
      let rfData;

      try {
        rfData = JSON.parse(rfText);
      } catch {
        rfData = { raw: rfText };
      }

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

    // ==========================
    // 2. PLANT.ID SAFE FALLBACK
    // ==========================
    try {
      const plantRes = await fetch(
        "https://api.plant.id/v3/health_assessment",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Api-Key": "PUT_YOUR_PLANT_ID_KEY_HERE"
          },
          body: JSON.stringify({
            images: [{ image: base64 }],
            health: "only"
          })
        }
      );

      const text = await plantRes.text();

      let plantData;
      try {
        plantData = JSON.parse(text);
      } catch {
        return res.json({
          success: false,
          source: "Plant.id",
          error: "Invalid response from Plant.id",
          raw: text
        });
      }

      return res.json({
        success: true,
        source: "Plant.id (fallback)",
        data: plantData
      });

    } catch (err) {
      return res.json({
        success: false,
        source: "Plant.id",
        error: err.message
      });
    }

  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ==============================
// START SERVER
// ==============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Plant AI running on port", PORT);
});
