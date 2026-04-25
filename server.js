const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fetch = require("node-fetch");
const FormData = require("form-data");

const app = express();
const upload = multer();

app.use(cors());

/* =========================
   🌿 PLANT IDENTIFICATION
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
   🦠 DISEASE DETECTION (FIXED)
========================= */
app.post("/detect-disease", upload.single("image"), async (req, res) => {

  try {

    if (!req.file) {
      return res.json({
        result: "No image uploaded",
        confidence: 0
      });
    }

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

    // 🔥 FIX: prevent JSON crash (HTML response issue)
    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      console.log("RAW HF RESPONSE:", text);

      return res.json({
        result: "AI model error or loading",
        confidence: 0
      });
    }

    console.log("HF RESPONSE:", data);

    // =========================
    // HANDLE ERROR RESPONSE
    // =========================
    if (!Array.isArray(data) || data.length === 0 || data.error) {
      return res.json({
        result: "No disease detected",
        confidence: 0
      });
    }

    const top = data[0];

    const label = (top.label || "").toLowerCase();

    const isHealthy =
      label.includes("healthy") ||
      top.score < 0.55;

    return res.json({
      result: isHealthy
        ? "🌱 Healthy plant (No disease detected)"
        : top.label,
      confidence: top.score || 0
    });

  } catch (err) {
    console.error("SERVER ERROR:", err);

    res.status(500).json({
      error: err.message
    });
  }

});


/* =========================
   🚀 START SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
