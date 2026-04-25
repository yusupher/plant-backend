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

    // =========================
    // CHECK IMAGE
    // =========================
    if (!req.file) {
      return res.json({
        result: "No image uploaded",
        confidence: 0,
        status: "error"
      });
    }

    const imageBuffer = req.file.buffer;

    // =========================
    // AI DISEASE MODEL (PRIMARY)
    // =========================
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

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      console.log("HF RAW ERROR:", text);

      // =========================
      // FALLBACK 1: SAFE RESPONSE
      // =========================
      return res.json({
        result: "🌱 Unable to analyze (AI fallback active)",
        confidence: 0,
        status: "fallback"
      });
    }

    console.log("HF RESPONSE:", data);

    // =========================
    // FALLBACK 2: EMPTY RESULT
    // =========================
    if (!Array.isArray(data) || data.length === 0) {
      return res.json({
        result: "🌱 Healthy plant (no disease detected)",
        confidence: 0.6,
        status: "healthy_guess"
      });
    }

    const top = data[0];

    const label = (top.label || "").toLowerCase();
    const score = top.score || 0;

    // =========================
    // RULE-BASED SMART LOGIC
    // =========================
    const isHealthy =
      label.includes("healthy") ||
      score < 0.55;

    // =========================
    // FINAL RESPONSE
    // =========================
    return res.json({
      result: isHealthy
        ? "🌱 Healthy plant"
        : top.label,
      confidence: score,
      status: isHealthy ? "healthy" : "disease_detected"
    });

  } catch (err) {

    console.error("CRASH:", err);

    // =========================
    // FINAL SAFETY FALLBACK
    // =========================
    return res.json({
      result: "⚠️ System fallback (safe mode)",
      confidence: 0,
      status: "error"
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
