const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fetch = require("node-fetch");
const FormData = require("form-data");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// ==============================
// MIDDLEWARE
// ==============================
app.use(cors());
app.use(express.json({ limit: "10mb" }));

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
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No image uploaded" });
    }

    const form = new FormData();
    form.append("images", req.file.buffer, {
      filename: "plant.jpg",
      contentType: "image/jpeg"
    });

    const response = await fetch(
      "https://my-api.plantnet.org/v2/identify/all?api-key=2b104s5nNyqRjHHyiCJveuBwu",
      {
        method: "POST",
        body: form,
        headers: form.getHeaders()
      }
    );

    const data = await response.json();

    res.json({
      success: true,
      source: "PlantNet",
      data
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Plant identification failed",
      message: err.message
    });
  }
});


// ==============================
// 🦠 DISEASE DETECTION (ROBUST)
// ==============================
app.post("/disease", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: "No image uploaded" });
    }

    const base64 = req.file.buffer.toString("base64");

    // ==========================
    // 1. ROBOFLOW (PRIMARY)
    // ==========================
    try {
      const roboflowUrl =
        "https://detect.roboflow.com/cassava-disease/1?api_key=33LnNNZCWrWy3FQGulD9";

      const rfResponse = await fetch(roboflowUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: base64
      });

      const rfData = await rfResponse.json();

      if (rfData && !rfData.error) {
        return res.json({
          success: true,
          source: "Roboflow",
          data: rfData
        });
      }
    } catch (err) {
      console.log("Roboflow error:", err.message);
    }

    // ==========================
    // 2. PLANT.ID (FALLBACK FIXED)
    // ==========================
    try {
      const plantIdResponse = await fetch(
        "https://api.plant.id/v3/health_assessment",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Api-Key": "ywQIn1Yv9I2T8aJ2dNbkL1YMo1ri6tGkhrMOT9FhPnnmcuQViH"
          },
          body: JSON.stringify({
            images: [{ image: base64 }],
            health: "only",
            similar_images: true
          })
        }
      );

      const text = await plantIdResponse.text();

      let plantIdData;
      try {
        plantIdData = JSON.parse(text);
      } catch (e) {
        return res.json({
          success: false,
          source: "Plant.id",
          error: "Invalid response from Plant.id",
          raw: text
        });
      }

      return res.json({
        success: true,
        source: "Plant.id (fallback)",
        data: plantIdData
      });

    } catch (err) {
      return res.status(500).json({
        success: false,
        error: "Plant.id failed",
        message: err.message
      });
    }

  } catch (err) {
    res.status(500).json({
      success: false,
      error: "Disease detection failed",
      message: err.message
    });
  }
});


// ==============================
// START SERVER (RENDER SAFE)
// ==============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Plant AI Backend running on port ${PORT}`);
});
