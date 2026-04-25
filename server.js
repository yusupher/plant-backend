const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fetch = require("node-fetch");
const FormData = require("form-data");

const app = express();
const upload = multer();

app.use(cors());

// PlantNet API bridge
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
app.post("/detect-disease", (req, res) => {

  const diseases = [
    "🌽 Maize Rust",
    "🍂 Leaf Blight",
    "🌱 Healthy Plant",
    "🍄 Fungal Infection",
    "⚠️ Bacterial Spot"
  ];

  const result = diseases[Math.floor(Math.random() * diseases.length)];

  res.json({
    success: true,
    result: result,
    advice: "Check leaves, remove infected parts, improve soil moisture"
  });
});

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
