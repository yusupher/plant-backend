const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fetch = require("node-fetch");
const FormData = require("form-data");

const app = express(); // ✅ MUST BE FIRST
const upload = multer();

app.use(cors());
app.use(express.json());

/* =========================
   🌿 PlantNet API
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
   🦠 Disease Detection
========================= */
app.post("/detect-disease", upload.single("image"), async (req, res) => {

  try {

    // =========================
    // CHECK FILE FIRST
    // =========================
    if (!req.file) {
      return res.status(400).json({
        result: "No image uploaded",
        confidence: 0
      });
    }

    const imageBuffer = req.file.buffer;

    // =========================
    // CALL AI MODEL
    // =========================
    const response = await fetch(
      "https://api-inference.huggingface.co/models/plantdoc/plant-disease-classifier",
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

    console.log("HF RESPONSE:", data);

    // =========================
    // HANDLE ERROR FROM HF
    // =========================
    if (!data || data.error) {
      return res.json({
        result: "AI model loading or error",
        confidence: 0
      });
    }

    // =========================
    // HANDLE EMPTY RESULT
    // =========================
    if (!Array.isArray(data) || data.length === 0) {
      return res.json({
        result: "No disease detected",
        confidence: 0
      });
    }

    const top = data[0];

    return res.json({
      result: top.label || "Unknown",
      confidence: top.score || 0
    });

  } catch (err) {

    console.error("CRASH ERROR:", err);

    return res.status(500).json({
      error: "Server crashed: " + err.message
    });

  }

});

/* =========================
   🚀 START SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
