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
// KEYS (USE ENVIRONMENT VARIABLES)
// ==============================
const PLANTNET_KEY = "2b104s5nNyqRjHHyiCJveuBwu";
const ROBOFLOW_KEY = "33LnNNZCWrWy3FQGulD9";
const ROBOFLOW_MODEL = "plant-dataset-ypln5-to68g/1";
const PEST_MODEL = "insect-e746x-iuclt/1";
// ✅ IMPORTANT: Anthropic key from Render environment (never hardcode)
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY;

if (!ANTHROPIC_KEY) {
  console.error("❌ ANTHROPIC_KEY environment variable not set!");
}

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
    // 1. ROBOFLOW
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
    // 2. PLANT.ID FALLBACK
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
// 🐛 PEST DETECTION
// ==============================
app.post("/detect-pest", upload.single("image"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ success: false, error: "No image uploaded" });

    const base64 = req.file.buffer.toString("base64");

    const rfUrl = `https://serverless.roboflow.com/${PEST_MODEL}?api_key=${ROBOFLOW_KEY}`;

    const rfRes = await fetch(rfUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: base64
    });

    const rfText = await rfRes.text();
    let rfData;
    try { rfData = JSON.parse(rfText); } catch { rfData = { raw: rfText }; }

    if (rfData && rfData.predictions && rfData.predictions.length > 0) {
      const top = rfData.predictions.reduce((max, p) => p.confidence > max.confidence ? p : max, rfData.predictions[0]);
      return res.json({
        success: true,
        result: top.class || "Unknown pest",
        confidence: Math.round(top.confidence * 100)
      });
    }

    return res.json({
      success: true,
      result: "No pest detected",
      confidence: 0
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================
// 🤖 CLAUDE AI COMPREHENSIVE INFO (USES ENV KEY)
// ==============================

app.post("/claude-info", async (req, res) => {
  try {
    const { query, type } = req.body;
    if (!query || !type) return res.status(400).json({ success: false, error: "Missing query or type" });
    if (!["plant", "disease", "pest"].includes(type)) return res.status(400).json({ success: false, error: "Invalid type" });

    // Check if Anthropic key is available
    if (!ANTHROPIC_KEY) {
      return res.json({ success: false, error: "Anthropic API key not configured on server." });
    }

    let systemPrompt = "";
    let userPrompt = "";

    if (type === "plant") {
      systemPrompt = `You are a professional botanist. Answer based on your knowledge. Return ONLY valid JSON, no extra text. Use specific, factual information.`;
      userPrompt = `Provide comprehensive information about the plant "${query}" in this exact JSON format:
{
  "commonName": "",
  "scientificName": "",
  "family": "",
  "order": "",
  "kingdom": "Plantae",
  "class": "",
  "category": "crop|tree|weed|shrub|herb|grass",
  "origin": "specific region",
  "description": "3-4 detailed sentences",
  "uses": ["use1", "use2", "use3", "use4"],
  "nutritionalValue": "nutritional facts if edible, else null",
  "economicImportance": "economic data",
  "ecologicalRole": "role in ecosystem",
  "growingConditions": {
    "climate": "",
    "soil": "",
    "rainfall": "",
    "temperature": ""
  },
  "isWeed": false,
  "weedControl": null,
  "interestingFacts": ["fact1", "fact2", "fact3"]
}
Be specific. Do not use placeholders like "various" or "some".`;
    } else if (type === "disease") {
      systemPrompt = `You are a plant pathologist. Return ONLY valid JSON with specific information.`;
      userPrompt = `Provide information about the plant disease "${query}" in this JSON:
{
  "diseaseName": "",
  "pathogenType": "fungal|bacterial|viral|nematode|physiological",
  "pathogenName": "scientific name",
  "affectedPlants": ["crop1", "crop2"],
  "symptoms": ["symptom1", "symptom2", "symptom3", "symptom4"],
  "spreadMechanism": "how it spreads",
  "favorableConditions": "temp, humidity, etc.",
  "economicImpact": "yield loss % or $",
  "control": {
    "cultural": ["practice1", "practice2"],
    "biological": ["agent - application"],
    "chemical": ["fungicide - dosage"],
    "resistant_varieties": ["variety"],
    "ipmSummary": "integrated strategy"
  },
  "preventionTips": ["tip1", "tip2", "tip3"]
}`;
    } else { // pest
      systemPrompt = `You are an entomologist. Return ONLY valid JSON with specific information.`;
      userPrompt = `Provide information about the pest "${query}" in this JSON:
{
  "pestName": "",
  "scientificName": "",
  "pestType": "insect|mite|nematode|rodent|mollusk|bird",
  "affectedPlants": ["crop1", "crop2"],
  "damageDescription": "detailed damage description",
  "lifeStages": ["egg", "larva", "pupa", "adult"],
  "peakActivity": "season/conditions",
  "economicThreshold": "e.g., 5 per plant",
  "control": {
    "cultural": ["practice1", "practice2"],
    "biological": ["enemy - application"],
    "mechanical": ["trap type"],
    "chemical": ["pesticide - dosage"],
    "ipmSummary": "integrated strategy"
  },
  "safetyNotes": "PPE or pre-harvest interval"
}`;
    }

    async function callClaude() {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 2000,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.log(`Claude API error ${response.status}:`, errText.substring(0, 200));
        return null;
      }

      const data = await response.json();
      const textBlock = data.content.find(c => c.type === "text");
      if (!textBlock) return null;

      const raw = textBlock.text;
      const clean = raw.replace(/```json|```/g, "").trim();
      try {
        const parsed = JSON.parse(clean);
        if (type === "plant" && !parsed.commonName && !parsed.scientificName) return null;
        if (type === "disease" && !parsed.diseaseName) return null;
        if (type === "pest" && !parsed.pestName) return null;
        return parsed;
      } catch (e) {
        console.log("JSON parse error:", e.message, "Raw:", raw.substring(0, 200));
        return null;
      }
    }

    let finalData = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      finalData = await callClaude();
      if (finalData) break;
      console.log(`Retry ${attempt} for ${query}`);
      await new Promise(r => setTimeout(r, 1000));
    }

    if (finalData) {
      return res.json({ success: true, source: "claude", data: finalData });
    } else {
      return res.json({
        success: false,
        error: `Could not retrieve information for "${query}". Try a more precise name.`
      });
    }
  } catch (err) {
    console.error("Claude endpoint error:", err);
    res.json({ success: false, error: "Internal server error" });
  }
});

// ==============================
// START SERVER
// ==============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Plant AI running on port", PORT);
});
