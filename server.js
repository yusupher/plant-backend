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
const PEST_MODEL = "insect-e746x-iuclt/1";
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
// 🤖 CLAUDE AI COMPREHENSIVE INFO (FIXED)
// ==============================

function isGenericData(data, type) {
  const genericPhrases = [
    "consult nutritional databases", "widespread across africa", "tropical/subtropical",
    "detailed information could not be retrieved", "economically important in",
    "plays a role in local ecosystems", "well-drained loamy soil", "unknown pathogen",
    "various crop plants", "causes physical damage", "most active during warm",
    "act when 10–15%", "wear ppe when applying", "combined with fallback"
  ];
  const str = JSON.stringify(data).toLowerCase();
  for (let phrase of genericPhrases) {
    if (str.includes(phrase)) return true;
  }
  if (type === "plant" && data.scientificName === data.commonName) return true;
  if (type === "disease" && data.pathogenName === "Unknown pathogen") return true;
  if (type === "pest" && data.scientificName === "Unknown species") return true;
  return false;
}

app.post("/claude-info", async (req, res) => {
  try {
    const { query, type } = req.body;
    if (!query || !type) return res.status(400).json({ success: false, error: "Missing query or type" });
    if (!["plant", "disease", "pest"].includes(type)) return res.status(400).json({ success: false, error: "Invalid type" });

    let systemPrompt = "";
    let userPrompt = "";

    if (type === "plant") {
      systemPrompt = `You are a professional botanist. Use the web search tool to find specific, real information about the plant "${query}". 
Return ONLY valid JSON with no extra text. Do not use generic placeholders.`;
      userPrompt = `Search the web for specific information about the plant: "${query}".
Return JSON exactly like this:
{
  "commonName": "",
  "scientificName": "",
  "family": "",
  "order": "",
  "kingdom": "Plantae",
  "class": "",
  "category": "crop|tree|weed|shrub|herb|grass",
  "origin": "specific country/region",
  "description": "3-4 specific sentences",
  "uses": ["use1","use2","use3","use4"],
  "nutritionalValue": "nutritional info or null",
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
  "interestingFacts": ["fact1","fact2","fact3"]
}`;
    } else if (type === "disease") {
      systemPrompt = "You are a plant pathologist. Use web search to find specific information about the disease. Return ONLY valid JSON.";
      userPrompt = `Search for the plant disease: "${query}". Return JSON:
{
  "diseaseName": "",
  "pathogenType": "fungal|bacterial|viral|nematode|physiological",
  "pathogenName": "scientific name",
  "affectedPlants": ["crop1","crop2"],
  "symptoms": ["symptom1","symptom2","symptom3","symptom4"],
  "spreadMechanism": "how it spreads",
  "favorableConditions": "temp, humidity",
  "economicImpact": "% loss or $",
  "control": {
    "cultural": ["practice1","practice2"],
    "biological": ["agent - how to apply"],
    "chemical": ["fungicide - dosage"],
    "resistant_varieties": ["variety"],
    "ipmSummary": "integrated strategy"
  },
  "preventionTips": ["tip1","tip2","tip3"]
}`;
    } else { // pest
      systemPrompt = "You are an entomologist. Use web search to find specific information about the pest. Return ONLY valid JSON.";
      userPrompt = `Search for the pest: "${query}". Return JSON:
{
  "pestName": "",
  "scientificName": "",
  "pestType": "insect|mite|nematode|rodent|mollusk|bird",
  "affectedPlants": ["crop1","crop2"],
  "damageDescription": "specific damage",
  "lifeStages": ["egg","larva","pupa","adult"],
  "peakActivity": "season/conditions",
  "economicThreshold": "e.g., 5 per plant",
  "control": {
    "cultural": ["practice1","practice2"],
    "biological": ["enemy - application"],
    "mechanical": ["trap type"],
    "chemical": ["pesticide - dosage"],
    "ipmSummary": "integrated strategy"
  },
  "safetyNotes": "PPE or PHI"
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
          tools: [{ type: "web_search", name: "web_search" }],
          tool_choice: { type: "auto" },
          messages: [{ role: "user", content: userPrompt }]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.log(`Claude error ${response.status}:`, errText.substring(0, 200));
        return null;
      }

      const data = await response.json();
      const textBlock = data.content.find(c => c.type === "text");
      if (!textBlock) return null;

      const raw = textBlock.text;
      const clean = raw.replace(/```json|```/g, "").trim();
      try {
        const parsed = JSON.parse(clean);
        if (type === "plant" && (!parsed.commonName && !parsed.scientificName)) return null;
        if (type === "disease" && !parsed.diseaseName) return null;
        if (type === "pest" && !parsed.pestName) return null;
        if (isGenericData(parsed, type)) return null;
        return parsed;
      } catch (e) {
        console.log("JSON parse error:", e.message);
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
      return res.json({ success: true, source: "claude-search", data: finalData });
    } else {
      // Return 200 with error flag (no 404)
      return res.json({
        success: false,
        error: `Could not retrieve specific information for "${query}". Try a more precise name.`
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
