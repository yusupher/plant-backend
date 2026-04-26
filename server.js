const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fetch = require("node-fetch");
const FormData = require("form-data");

const app = express();
const upload = multer({ limits: { fileSize: 2 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());

/* =========================
   🌿 ROOT
========================= */
app.get("/", (req, res) => {
  res.send("🌿 AI Farming Backend Running");
});

/* =========================
   🚀 FULL ANALYSIS (BEST ENDPOINT)
========================= */
app.post("/analyze-full", upload.single("image"), async (req, res) => {

  try {
    if (!req.file) {
      return res.json({ error: "No image uploaded" });
    }

    const imageBuffer = req.file.buffer;
    const base64 = imageBuffer.toString("base64");

    /* =========================
       🌿 STEP 1: PLANT IDENTIFICATION (PlantNet)
    ========================= */
    let plantName = "Unknown";

    try {
      const form = new FormData();
      form.append("images", imageBuffer, "plant.jpg");

      const plantRes = await fetch(
        `https://my-api.plantnet.org/v2/identify/all?api-key=${process.env.PLANTNET_KEY}`,
        { method: "POST", body: form }
      );

      const plantData = await plantRes.json();

      plantName =
        plantData?.results?.[0]?.species?.commonNames?.[0] ||
        plantData?.results?.[0]?.species?.scientificNameWithoutAuthor ||
        "Unknown";

    } catch {
      plantName = "Unknown";
    }

    /* =========================
       🦠 STEP 2: DISEASE DETECTION
    ========================= */
    let disease = "Healthy";
    let diseaseConfidence = 0;

    try {
      const diseaseRes = await fetch(
        `https://serverless.roboflow.com/plant-disease-xqd8b-tvz68/1?api_key=${process.env.ROBOFLOW_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: base64
        }
      );

      const diseaseData = await diseaseRes.json();

      const d = diseaseData?.predictions?.find(p => p.confidence >= 0.3);

      if (d) {
        disease = d.class;
        diseaseConfidence = Math.round(d.confidence * 100);
      }

    } catch {}

    /* =========================
       🐛 STEP 3: PEST DETECTION
    ========================= */
    let pest = "No pest";
    let pestConfidence = 0;

    try {
      const pestRes = await fetch(
        `https://serverless.roboflow.com/insect-e746x-iuclt/1?api_key=${process.env.ROBOFLOW_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: base64
        }
      );

      const pestData = await pestRes.json();

      const p = pestData?.predictions?.find(p => p.confidence >= 0.3);

      if (p) {
        pest = p.class;
        pestConfidence = Math.round(p.confidence * 100);
      }

    } catch {}

    /* =========================
       📚 STEP 4: PERENUAL INFO
    ========================= */
    let care = {
      watering: "N/A",
      sunlight: "N/A"
    };

    try {
      if (plantName !== "Unknown") {
        const infoRes = await fetch(
          `https://perenual.com/api/species-list?key=${process.env.PERENUAL_KEY}&q=${plantName}`
        );

        const infoData = await infoRes.json();

        const plant = infoData?.data?.[0];

        if (plant) {
          care = {
            watering: plant.watering || "N/A",
            sunlight: plant.sunlight || "N/A"
          };
        }
      }
    } catch {}

    /* =========================
       🎯 FINAL RESPONSE
    ========================= */
    return res.json({
      plant: plantName,
      disease: {
        name: disease,
        confidence: diseaseConfidence
      },
      pest: {
        name: pest,
        confidence: pestConfidence
      },
      care: care
    });

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
});

/* =========================
   🚀 START SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
});
