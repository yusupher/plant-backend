const express = require("express");
const cors = require("cors");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// ======================
// PLANT IDENTIFICATION
// ======================
app.post("/identify", upload.single("image"), async (req, res) => {
  try {
    const form = new FormData();
    form.append("images", req.file.buffer, "plant.jpg");

    const response = await axios.post(
      "https://my-api.plantnet.org/v2/identify/all?api-key=YOUR_PLANTNET_KEY",
      form,
      { headers: form.getHeaders() }
    );

    res.json(response.data);
  } catch (err) {
    res.status(500).json({
      error: "Plant identification failed",
      details: err.message,
    });
  }
});

// ======================
// DISEASE DETECTION (Plant.id optional)
// ======================
app.post("/disease", upload.single("image"), async (req, res) => {
  try {
    const response = await axios.post(
      "https://api.plant.id/v3/health_assessment",
      {
        images: [req.file.buffer.toString("base64")],
        similar_images: true,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Api-Key": "YOUR_PLANT_ID_KEY",
        },
      }
    );

    res.json(response.data);
  } catch (err) {
    res.status(500).json({
      error: "Disease detection failed",
      details: err.message,
    });
  }
});

app.listen(3000, () => console.log("Server running on http://localhost:3000"));
