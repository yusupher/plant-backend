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
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.error("❌ ANTHROPIC_API_KEY environment variable not set!");
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

    try {
      const rfUrl = `https://serverless.roboflow.com/${ROBOFLOW_MODEL}?api_key=${ROBOFLOW_KEY}`;
      const rfRes = await fetch(rfUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: base64
      });
      const rfText = await rfRes.text();
      let rfData;
      try { rfData = JSON.parse(rfText); } catch { rfData = { raw: rfText }; }
      if (rfData && !rfData.error) {
        return res.json({ success: true, source: "Roboflow", data: rfData });
      }
    } catch (err) {
      console.log("Roboflow failed:", err.message);
    }

    try {
      const plantRes = await fetch("https://api.plant.id/v3/health_assessment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Api-Key": "PUT_YOUR_PLANT_ID_KEY_HERE"
        },
        body: JSON.stringify({ images: [{ image: base64 }], health: "only" })
      });
      const text = await plantRes.text();
      let plantData;
      try { plantData = JSON.parse(text); } catch { plantData = null; }
      if (plantData) {
        return res.json({ success: true, source: "Plant.id (fallback)", data: plantData });
      }
      return res.json({ success: false, source: "Plant.id", error: "Invalid response", raw: text });
    } catch (err) {
      return res.json({ success: false, source: "Plant.id", error: err.message });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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
    return res.json({ success: true, result: "No pest detected", confidence: 0 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================
// 🤖 CLAUDE AI COMPREHENSIVE INFO (WITH CORRECT MODEL)
// ==============================

app.post("/claude-info", async (req, res) => {
  try {
    const { query, type } = req.body;
    if (!query || !type) return res.status(400).json({ success: false, error: "Missing query or type" });
    if (!["plant", "disease", "pest"].includes(type)) return res.status(400).json({ success: false, error: "Invalid type" });

    if (!ANTHROPIC_API_KEY) {
      return res.json({ success: false, error: "ANTHROPIC_API_KEY not configured on server." });
    }

    let systemPrompt = "", userPrompt = "";

    if (type === "plant") {
      systemPrompt = "You are a botanist. Return ONLY valid JSON. No extra text.";
      userPrompt = `Provide info for plant "${query}" in this exact JSON:
{
  "commonName": "",
  "scientificName": "",
  "family": "",
  "order": "",
  "kingdom": "Plantae",
  "class": "",
  "category": "crop|tree|weed|shrub|herb|grass",
  "origin": "specific region",
  "description": "3-4 sentences",
  "uses": ["use1","use2","use3","use4"],
  "nutritionalValue": "nutritional facts or null",
  "economicImportance": "economic data",
  "ecologicalRole": "role",
  "growingConditions": {"climate":"","soil":"","rainfall":"","temperature":""},
  "isWeed": false,
  "weedControl": null,
  "interestingFacts": ["fact1","fact2","fact3"]
}`;
    } else if (type === "disease") {
      systemPrompt = "You are a plant pathologist. Return ONLY valid JSON.";
      userPrompt = `Provide info for disease "${query}" in JSON:
{
  "diseaseName": "",
  "pathogenType": "fungal|bacterial|viral|nematode|physiological",
  "pathogenName": "",
  "affectedPlants": [],
  "symptoms": [],
  "spreadMechanism": "",
  "favorableConditions": "",
  "economicImpact": "",
  "control": {
    "cultural": [],
    "biological": [],
    "chemical": [],
    "resistant_varieties": [],
    "ipmSummary": ""
  },
  "preventionTips": []
}`;
    } else {
      systemPrompt = "You are an entomologist. Return ONLY valid JSON.";
      userPrompt = `Provide info for pest "${query}" in JSON:
{
  "pestName": "",
  "scientificName": "",
  "pestType": "insect|mite|nematode|rodent|mollusk|bird",
  "affectedPlants": [],
  "damageDescription": "",
  "lifeStages": [],
  "peakActivity": "",
  "economicThreshold": "",
  "control": {
    "cultural": [],
    "biological": [],
    "mechanical": [],
    "chemical": [],
    "ipmSummary": ""
  },
  "safetyNotes": ""
}`;
    }

    async function callClaude() {
      // ✅ CORRECTED MODEL NAME
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-3-5-haiku-20241022",  // <-- FIXED: valid model name
          max_tokens: 2000,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Claude API error ${response.status}:`, errorText);
        return { error: `Claude API error ${response.status}: ${errorText.substring(0, 200)}` };
      }

      const data = await response.json();
      const textBlock = data.content.find(c => c.type === "text");
      if (!textBlock) return { error: "No text block in Claude response" };

      const raw = textBlock.text;
      const clean = raw.replace(/```json|```/g, "").trim();
      try {
        const parsed = JSON.parse(clean);
        if (type === "plant" && !parsed.commonName && !parsed.scientificName) return { error: "Missing required fields" };
        if (type === "disease" && !parsed.diseaseName) return { error: "Missing diseaseName" };
        if (type === "pest" && !parsed.pestName) return { error: "Missing pestName" };
        return { success: true, data: parsed };
      } catch (e) {
        return { error: `JSON parse error: ${e.message}. Raw: ${raw.substring(0, 200)}` };
      }
    }

    let finalResult = null;
    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const result = await callClaude();
      if (result.success) {
        finalResult = result.data;
        break;
      } else if (result.error) {
        lastError = result.error;
        console.log(`Attempt ${attempt} failed: ${lastError}`);
      }
      await new Promise(r => setTimeout(r, 1000));
    }

    if (finalResult) {
      return res.json({ success: true, source: "claude", data: finalResult });
    } else {
      return res.json({ success: false, error: lastError || `Could not retrieve information for "${query}". Try a more precise name.` });
    }
  } catch (err) {
    console.error("Claude endpoint error:", err);
    res.json({ success: false, error: "Internal server error: " + err.message });
  }
});

// ==============================
// START SERVER
// ==============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Plant AI running on port", PORT));
