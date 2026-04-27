const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fetch = require("node-fetch");
const FormData = require("form-data");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// ✅ FIXED CORS (important for frontend)
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"]
}));

app.use(express.json());


// ==============================
// HEALTH CHECK
// ==============================
app.get("/", (req, res) => {
  res.json({
    status: "Plant AI Backend Running 🚀",
    endpoints: ["/identify", "/disease"]
  });
});


// ==============================
// 🌿 PLANT IDENTIFICATION (PLANTNET)
// ==============================
app.post("/identify", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });

    const form = new FormData();
    form.append("images", req.file.buffer, {
      filename: "plant.jpg",
      contentType: "image/jpeg"
    });

    form.append("organs", "leaf");

    const response = await fetch(
      `https://my-api.plantnet.org/v2/identify/all?api-key=2b104s5nNyqRjHHyiCJveuBwu`,
      {
        method: "POST",
        body: form,
        headers: form.getHeaders()
      }
    );

    const data = await response.json();

    return res.json({
      source: "PlantNet",
      data
    });

  } catch (err) {
    res.status(500).json({
      error: "Plant identification failed",
      message: err.message
    });
  }
});


// ==============================
// 🦠 DISEASE DETECTION
// ==============================
app.post("/disease", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });

    const base64 = req.file.buffer.toString("base64");

    // ==========================
    // 1. ROBOFLOW (PRIMARY)
    // ==========================
    const roboflowUrl =
      "https://detect.roboflow.com/YOUR_MODEL_NAME/1?api_key=33LnNNZCWrWy3FQGulD9";

    const rfResponse = await fetch(roboflowUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: base64
    });

    const rfData = await rfResponse.json();

    if (rfData && rfData.predictions) {
      return res.json({
        source: "Roboflow",
        data: rfData
      });
    }

    // ==========================
    // 2. PLANT.ID FALLBACK
    // ==========================
    const plantIdResponse = await fetch(
      "https://api.plant.id/v3/health_assessment",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Api-Key": "ywQIn1Yv9I2T8aJ2dNbkL1YMo1ri6tGkhrMOT9FhPnnmcuQViH"
        },
        body: JSON.stringify({
          images: [base64],
          similar_images: true
        })
      }
    );

    const plantIdData = await plantIdResponse.json();

    return res.json({
      source: "Plant.id (fallback)",
      data: plantIdData
    });

  } catch (err) {
    res.status(500).json({
      error: "Disease detection failed",
      message: err.message
    });
  }
});


// ==============================
// START SERVER
// ==============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Plant AI Backend running on port ${PORT}`);
});
