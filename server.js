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
   🌿 PLANT IDENTIFICATION (PlantNet)
========================= */
app.post("/identify", upload.single("image"), async (req, res) => {

  try {

    if (!req.file) {
      return res.json({
        result: "No image uploaded",
        confidence: 0
      });
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
    console.error("PlantNet Error:", err);
    return res.status(500).json({ error: err.message });
  }

});


/* =========================
   🦠 DISEASE DETECTION (ROBOFLOW - FIXED)
========================= */
app.post("/detect-disease", upload.single("image"), async (req, res) => {

  try {

    if (!req.file) {
      return res.json({
        result: "No image uploaded",
        confidence: 0
      });
    }

    const apiKey = "33LnNNZCWrWy3FQGulD9"; // 🔴 PUT YOUR KEY HERE

    const base64 = req.file.buffer.toString("base64");

    const url = `https://serverless.roboflow.com/plant-disease-xqd8b-tvz68/1?api_key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: base64
    });

    const data = await response.json();

    console.log("ROBOFLOW RESPONSE:", data);

    if (data.predictions && data.predictions.length > 0) {

      const top = data.predictions[0];

      return res.json({
        result: top.class,
        confidence: top.confidence
      });

    }

    return res.json({
      result: "🌱 Healthy plant (no disease detected)",
      confidence: 0
    });

  } catch (err) {
    console.error("Disease Error:", err);

    return res.status(500).json({
      error: err.message
    });
  }

});


/* =========================
   🚀 START SERVER (RENDER READY)
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
