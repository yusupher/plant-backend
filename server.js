const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fetch = require("node-fetch");
const FormData = require("form-data");

const app = express();
const upload = multer();

app.use(cors());
app.use(express.json());

/* =========================
   🌿 PLANT IDENTIFICATION (ALWAYS FREE)
========================= */
app.post("/identify", upload.single("image"), async (req, res) => {

  try {

    if (!req.file) {
      return res.json({ result: "No image uploaded", confidence: 0 });
    }

    const form = new FormData();
    form.append("images", req.file.buffer, "plant.jpg");

    const response = await fetch(
      "https://my-api.plantnet.org/v2/identify/all?api-key=2b104s5nNyqRjHHyiCJveuBwu",
      {
        method: "POST",
        body: form
      }
    );

    const data = await response.json();

    return res.json(data);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

});


/* =========================
   🦠 DISEASE DETECTION (ROBUST + FALLBACK)
========================= */
app.post("/detect-disease", upload.single("image"), async (req, res) => {

  try {

    if (!req.file) {
      return res.json({ result: "No image uploaded", confidence: 0 });
    }

    const apiKey = "33LnNNZCWrWy3FQGulD9";

    const base64 = req.file.buffer.toString("base64");

    const url = `https://serverless.roboflow.com/plant-disease-xqd8b-tvz68/1?api_key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: base64
    });

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch (err) {
      console.log("RAW RESPONSE:", text);

      return res.json({
        result: "AI service unavailable ⚠️",
        confidence: 0
      });
    }

    /* =========================
       🚨 HANDLE CREDIT LIMIT / EMPTY RESPONSE
    ========================= */
    if (!data || !data.predictions || data.predictions.length === 0) {
      return res.json({
        result: "🌱 Healthy plant (or AI unavailable)",
        confidence: 0
      });
    }

    const filtered = data.predictions.filter(p => p.confidence >= 0.3);

    if (filtered.length === 0) {
      return res.json({
        result: "🌱 Healthy plant",
        confidence: 0
      });
    }

    const top = filtered[0];

    return res.json({
      result: top.class,
      confidence: Math.round(top.confidence * 100)
    });

  } catch (err) {

    return res.status(500).json({
      result: "Server error",
      error: err.message
    });

  }

});


/* =========================
   🐛 PEST DETECTION (ROBUST + FALLBACK)
========================= */
app.post("/detect-pest", upload.single("image"), async (req, res) => {

  try {

    if (!req.file) {
      return res.json({ result: "No image uploaded", confidence: 0 });
    }

    const apiKey = "33LnNNZCWrWy3FQGulD9";

    const base64 = req.file.buffer.toString("base64");

    const url = `https://serverless.roboflow.com/insect-e746x-iuclt/1?api_key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: base64
    });

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch (err) {
      return res.json({
        result: "AI service unavailable ⚠️",
        confidence: 0
      });
    }

    if (!data || !data.predictions || data.predictions.length === 0) {
      return res.json({
        result: "No pest detected 🟢",
        confidence: 0
      });
    }

    const filtered = data.predictions.filter(p => p.confidence >= 0.3);

    if (filtered.length === 0) {
      return res.json({
        result: "No pest detected 🟢",
        confidence: 0
      });
    }

    const top = filtered[0];

    return res.json({
      result: top.class,
      confidence: Math.round(top.confidence * 100)
    });

  } catch (err) {

    return res.status(500).json({
      result: "Server error",
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
