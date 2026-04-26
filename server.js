const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fetch = require("node-fetch");
const FormData = require("form-data");
const crops = require("./cropData");

const app = express();
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());

/* =========================
   🌿 1. PLANT IDENTIFICATION (PlantNet MAIN)
========================= */
app.post("/identify-plant", upload.single("image"), async (req, res) => {

  try {
    if (!req.file) return res.json({ error: "No image uploaded" });

    const form = new FormData();
    form.append("images", req.file.buffer, "plant.jpg");

    const response = await fetch(
      `https://my-api.plantnet.org/v2/identify/all?api-key=${process.env.PLANTNET_KEY}`,
      {
        method: "POST",
        body: form
      }
    );

    const data = await response.json();

    const top = data?.results?.[0];

    return res.json({
      plant:
        top?.species?.commonNames?.[0] ||
        top?.species?.scientificNameWithoutAuthor ||
        "Unknown",
      confidence: top?.score || 0
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

});


/* =========================
   🦠 2. DISEASE DETECTION (ROBOFLOW)
========================= */
app.post("/detect-disease", upload.single("image"), async (req, res) => {

  try {
    if (!req.file) return res.json({ error: "No image uploaded" });

    const base64 = req.file.buffer.toString("base64");

    const response = await fetch(
      `https://serverless.roboflow.com/plant-disease-xqd8b-tvz68/1?api_key=${process.env.ROBOFLOW_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: base64
      }
    );

    const data = await response.json();

    const top = data?.predictions?.[0];

    if (!top) {
      return res.json({
        disease: "Healthy",
        confidence: 0
      });
    }

    return res.json({
      disease: top.class,
      confidence: Math.round(top.confidence * 100)
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

});


/* =========================
   🐛 3. PEST DETECTION (ROBOFLOW)
========================= */
app.post("/detect-pest", upload.single("image"), async (req, res) => {

  try {
    if (!req.file) return res.json({ error: "No image uploaded" });

    const base64 = req.file.buffer.toString("base64");

    const response = await fetch(
      `https://serverless.roboflow.com/insect-e746x-iuclt/1?api_key=${process.env.ROBOFLOW_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: base64
      }
    );

    const data = await response.json();

    const top = data?.predictions?.[0];

    if (!top) {
      return res.json({
        pest: "No pest",
        confidence: 0
      });
    }

    return res.json({
      pest: top.class,
      confidence: Math.round(top.confidence * 100)
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

});


/* =========================
   🌱 4. PLANT HEALTH (Plant.id)
========================= */
app.post("/plant-health", upload.single("image"), async (req, res) => {

  try {
    if (!req.file) return res.json({ error: "No image uploaded" });

    const base64 = req.file.buffer.toString("base64");
    const imageData = `data:image/jpeg;base64,${base64}`;

    const response = await fetch("https://api.plant.id/v2/identify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": process.env.PLANT_ID_KEY
      },
      body: JSON.stringify({
        images: [imageData],
        modifiers: ["health_all"]
      })
    });

    const data = await response.json();

    const top = data?.suggestions?.[0];

    const health = top?.health?.probability || 0;

    return res.json({
      health: Math.round(health * 100),
      status: health > 0.6 ? "Healthy" : "Unhealthy"
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

});


/* =========================
   🚀 START SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Backend running on port " + PORT);
});
