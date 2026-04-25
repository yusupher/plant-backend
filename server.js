const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fetch = require("node-fetch");
const FormData = require("form-data");

const app = express();
const upload = multer();

app.use(cors());

/* =========================
   🌿 PlantNet API (Plant ID)
========================= */
app.post("/identify", upload.single("image"), async (req, res) => {

  const form = new FormData();
  form.append("images", req.file.buffer, "plant.jpg");

  try {
    const response = await fetch(
      "https://my-api.plantnet.org/v2/identify/all?api-key=2b104s5nNyqRjHHyiCJveuBwu",
      {
        method: "POST",
        body: form
      }
    );

    const data = await response.json();
    res.json(data);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});


/* =========================
   🦠 Disease Detection (AI FIXED)
========================= */
app.post("/detect-disease", upload.single("image"), async (req, res) => {

  try {
    const imageBuffer = req.file.buffer;

    const response = await fetch(
      "https://api-inference.huggingface.co/models/nateraw/plant-disease-classification",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.HF_TOKEN}`,
          "Content-Type": "application/octet-stream"
        },
        body: imageBuffer
      }
    );

    const data = await response.json();

    console.log("HF RAW:", data);

    // ===============================
    // ❌ MODEL STILL LOADING
    // ===============================
    if (!data || data.error) {
      return res.json({
        result: "⏳ Model is loading, try again",
        confidence: 0
      });
    }

    // ===============================
    // ARRAY RESPONSE (NORMAL)
    // ===============================
    if (Array.isArray(data) && data.length > 0) {

      const best = data[0];

      if (!best.label || !best.score) {
        return res.json({
          result: "⚠️ No disease detected",
          confidence: 0
        });
      }

      const isHealthy =
        best.label.toLowerCase().includes("healthy") ||
        best.score < 0.5;

      return res.json({
        result: isHealthy
          ? "🌱 Healthy plant (No disease detected)"
          : best.label,
        confidence: best.score
      });
    }

    // ===============================
    // EMPTY RESPONSE
    // ===============================
    return res.json({
      result: "⚠️ No disease detected",
      confidence: 0
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});


/* =========================
   🚀 START SERVER
========================= */
app.listen(3000, () => {
  console.log("Server running on port 3000");
});
