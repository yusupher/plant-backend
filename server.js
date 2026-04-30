const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fetch = require("node-fetch");
const FormData = require("form-data");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ==============================
// KEYS (YOUR REAL KEYS)
// ==============================
const PLANTNET_KEY = "2b104s5nNyqRjHHyiCJveuBwu";
const ROBOFLOW_KEY = "33LnNNZCWrWy3FQGulD9";
const ROBOFLOW_MODEL = "plant-dataset-ypln5-to68g/1";
const ANTHROPIC_KEY = "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";

// ==============================
// HEALTH CHECK
// ==============================
app.get("/", (req, res) => {
  res.json({
    status: "Plant AI Backend Running 🚀",
    endpoints: ["/identify", "/disease", "/claude-info"]
  });
});

// ==============================
// 🌿 PLANT IDENTIFICATION
// ==============================
app.post("/identify", upload.single("image"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ success: false, error: "No image uploaded" });

    const form = new FormData();
    form.append("images", req.file.buffer, {
      filename: "plant.jpg",
      contentType: "image/jpeg"
    });

    const response = await fetch(
      `https://my-api.plantnet.org/v2/identify/all?api-key=${PLANTNET_KEY}`,
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
      error: err.message
    });
  }
});

// ==============================
// 🦠 DISEASE DETECTION (ROBUST)
// ==============================
app.post("/disease", upload.single("image"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ success: false, error: "No image uploaded" });

    const base64 = req.file.buffer.toString("base64");

    // ==========================
    // 1. ROBOFLOW (FIXED SERVERLESS)
    // ==========================
    try {
      const rfUrl = `https://serverless.roboflow.com/${ROBOFLOW_MODEL}?api_key=${ROBOFLOW_KEY}`;

      const rfRes = await fetch(rfUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: base64
      });

      const rfText = await rfRes.text();
      let rfData;

      try {
        rfData = JSON.parse(rfText);
      } catch {
        rfData = { raw: rfText };
      }

      if (rfData && !rfData.error) {
        return res.json({
          success: true,
          source: "Roboflow",
          data: rfData
        });
      }
    } catch (err) {
      console.log("Roboflow failed:", err.message);
    }

    // ==========================
    // 2. PLANT.ID SAFE FALLBACK
    // ==========================
    try {
      const plantRes = await fetch(
        "https://api.plant.id/v3/health_assessment",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Api-Key": "PUT_YOUR_PLANT_ID_KEY_HERE"
          },
          body: JSON.stringify({
            images: [{ image: base64 }],
            health: "only"
          })
        }
      );

      const text = await plantRes.text();

      let plantData;
      try {
        plantData = JSON.parse(text);
      } catch {
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
        data: plantData
      });

    } catch (err) {
      return res.json({
        success: false,
        source: "Plant.id",
        error: err.message
      });
    }

  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// ==============================
// 🤖 CLAUDE AI COMPREHENSIVE INFO
// ==============================
app.post("/claude-info", async (req, res) => {
  try {
    const { query, type } = req.body;

    if (!query || !type) {
      return res.status(400).json({ success: false, error: "Missing query or type" });
    }

    let prompt = "";

    if (type === "plant") {
      prompt = `You are a professional botanist and agronomist. Provide comprehensive information about the plant: "${query}".
Return ONLY valid JSON (no markdown fences, no extra text) with this structure:
{"commonName":"","scientificName":"","family":"","order":"","kingdom":"Plantae","class":"","category":"crop|tree|weed|shrub|herb|grass","origin":"","description":"2-3 sentences about appearance and habitat","uses":["use1","use2","use3"],"nutritionalValue":"string or null","economicImportance":"","ecologicalRole":"","growingConditions":{"climate":"","soil":"","rainfall":"","temperature":""},"isWeed":false,"weedControl":null,"interestingFacts":["fact1","fact2"]}
If it is a weed set isWeed:true and fill weedControl:{"cultural":["method1"],"mechanical":["method1"],"biological":["agent - description"],"chemical":["herbicide - dosage/use"],"ipmSummary":"IPM summary for this weed"}`;

    } else if (type === "disease") {
      prompt = `You are a plant pathologist. Provide comprehensive information about the plant disease: "${query}".
Return ONLY valid JSON (no markdown, no extra text):
{"diseaseName":"","pathogenType":"fungal|bacterial|viral|nematode|physiological","pathogenName":"","affectedPlants":["plant1"],"symptoms":["symptom1","symptom2"],"spreadMechanism":"","favorableConditions":"","economicImpact":"","control":{"cultural":["practice1"],"biological":["agent1"],"chemical":["fungicide - rate"],"resistant_varieties":["variety1"],"ipmSummary":""},"preventionTips":["tip1","tip2"]}`;

    } else if (type === "pest") {
      prompt = `You are an entomologist and pest management expert. Provide comprehensive information about the pest: "${query}".
Return ONLY valid JSON (no markdown, no extra text):
{"pestName":"","scientificName":"","pestType":"insect|mite|nematode|rodent|mollusk|bird","affectedPlants":["plant1"],"damageDescription":"","lifeStages":["stage1"],"peakActivity":"","economicThreshold":"","control":{"cultural":["practice1"],"biological":["natural enemy 1"],"mechanical":["trap/barrier"],"chemical":["pesticide - dosage"],"ipmSummary":""},"safetyNotes":""}`;
    } else {
      return res.status(400).json({ success: false, error: "Invalid type. Use: plant, disease, or pest" });
    }

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      return res.status(500).json({ success: false, error: "Claude API error: " + errText });
    }

    const claudeData = await claudeRes.json();
    const rawText = claudeData.content.map(b => b.text || "").join("");
    const clean = rawText.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      return res.status(500).json({ success: false, error: "Failed to parse Claude response", raw: clean });
    }

    res.json({ success: true, data: parsed });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================
// START SERVER
// ==============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Plant AI running on port", PORT);
});
