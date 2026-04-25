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

    console.log("HF Response:", data);

    // ✅ FIX: correct parsing for Hugging Face response
    const label = data?.[0]?.label;
    const score = data?.[0]?.score;

    res.json({
      result: label || "Could not detect",
      confidence: score || 0
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
