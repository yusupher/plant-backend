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
// 🤖 CLAUDE AI COMPREHENSIVE INFO
// (Specific, search‑based, no generic fallback)
// ==============================

// Helper: check if parsed JSON looks generic (contains placeholder phrases)
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
  // Additional plant‑specific generic check
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
      systemPrompt = `You are a professional botanist and agronomist. You MUST use the web_search tool to find SPECIFIC, REAL information about the plant "${query}". 
- Do NOT use generic placeholders like "tropical/subtropical", "well-drained loamy soil", "consult nutritional databases".
- If the plant is a weed, set "category":"weed" and "isWeed":true, and provide detailed, practical weed control methods (cultural, mechanical, biological, chemical with specific herbicide names and rates).
- For crops/trees/herbs, provide real nutritional values, economic data, and growing conditions from authoritative sources (FAO, USDA, research papers).
- Return ONLY valid JSON, no markdown, no extra text.`;

      userPrompt = `Search the web for comprehensive, SPECIFIC information about the plant: "${query}".
Search for its scientific name, family, classification (weed/crop/tree/shrub/herb/grass), origin, detailed uses (not generic), real nutritional composition (if edible), economic importance (e.g., production volumes, market value), ecological role, and growing conditions with actual numbers (rainfall mm, temperature °C).
If it is a WEED, you MUST include:
- "isWeed": true, "category": "weed"
- weedControl object with specific methods:
  - cultural: ["crop rotation with ...", "cover cropping with ..."]
  - mechanical: ["hand pulling at growth stage", "mowing height X cm"]
  - biological: ["specific agent name and application method"]
  - chemical: ["herbicide name - dosage (g or ml per hectare)"]
  - ipmSummary: "Integrated strategy combining ..."
If it is NOT a weed, set isWeed:false, weedControl:null.

Return ONLY valid JSON (no extra text):
{
  "commonName": "",
  "scientificName": "",
  "family": "",
  "order": "",
  "kingdom": "Plantae",
  "class": "",
  "category": "weed|crop|tree|shrub|herb|grass",
  "origin": "specific country/region",
  "description": "3-4 specific sentences from search",
  "uses": ["specific use 1", "specific use 2", "specific use 3", "specific use 4"],
  "nutritionalValue": "specific per 100g values or null",
  "economicImportance": "specific data (e.g., 'Global production 50M tonnes, value $10B')",
  "ecologicalRole": "specific role (host plant, nitrogen fixer, etc.)",
  "growingConditions": {
    "climate": "specific (e.g., 'Köppen Aw', 'Mediterranean')",
    "soil": "specific texture/pH",
    "rainfall": "e.g., '800-1200 mm/year'",
    "temperature": "e.g., '15-28°C'"
  },
  "isWeed": false,
  "weedControl": null,
  "interestingFacts": ["specific fact 1", "specific fact 2", "specific fact 3"]
}`;

    } else if (type === "disease") {
      systemPrompt = `You are a plant pathologist. Use web_search to find SPECIFIC, real information about the disease "${query}". 
- Provide actual pathogen names, affected crops with real examples, specific symptoms (not generic leaf spots).
- Control measures must include real chemical names and dosages (e.g., "Mancozeb 80WP - 2.5g/L"), biological agents with application methods.
- Avoid generic phrases like "various crop plants" or "favorable conditions: high humidity".
- Return ONLY valid JSON.`;

      userPrompt = `Search for specific data on the plant disease: "${query}".
Find: causal pathogen (species name), exact affected crops list, specific symptoms (with descriptions of lesions, colours, patterns), spread mechanism (e.g., "water splash over 2m", "thrips transmission"), favourable conditions with numbers (e.g., "25-30°C, >90% RH for 6h"), economic impact (e.g., "yield loss 30-50% in [region]").
Control measures must be actionable:
- cultural: specific practices like "2-year rotation with non-host X"
- biological: "Trichoderma harzianum applied as seed treatment 10g/kg"
- chemical: "Azoxystrobin 250SC - 1.0ml/L, 7-day interval"
- resistant_varieties: exact variety names
- ipmSummary: concrete strategy

Return ONLY valid JSON:
{
  "diseaseName": "",
  "pathogenType": "fungal|bacterial|viral|nematode|physiological",
  "pathogenName": "specific scientific name",
  "affectedPlants": ["specific crop 1", "specific crop 2"],
  "symptoms": ["symptom 1", "symptom 2", "symptom 3", "symptom 4"],
  "spreadMechanism": "specific mechanism",
  "favorableConditions": "specific numbers (temp, RH, etc.)",
  "economicImpact": "specific % loss or $ value",
  "control": {
    "cultural": ["specific practice 1", "practice 2"],
    "biological": ["specific agent - how to apply"],
    "chemical": ["specific fungicide - rate per L/ha"],
    "resistant_varieties": ["variety name if found"],
    "ipmSummary": "specific integrated strategy"
  },
  "preventionTips": ["tip 1", "tip 2", "tip 3"]
}`;

    } else { // pest
      systemPrompt = `You are an entomologist. Use web_search to find SPECIFIC, real information about the pest "${query}". 
- Provide scientific name, exact host crops, detailed damage description (e.g., "leaf skeletonisation", "bore holes in stem").
- Control: specific chemical names + dosages (e.g., "Cypermethrin 10EC - 10ml/20L water"), biological agents, trap types.
- Avoid generic phrases like "various crops" or "causes physical damage".
- Return ONLY valid JSON.`;

      userPrompt = `Search for specific data on the pest: "${query}".
Find: scientific name, pest type, exact affected plants, specific damage description, life stages (list 3-4), peak activity (month/season/conditions), economic threshold (e.g., "5 larvae per plant").
Control measures must be concrete:
- cultural: crop rotation with specific crop, timing
- biological: specific predator/parasitoid (e.g., "Chrysoperla carnea - release 2 larvae/plant")
- mechanical: specific trap (e.g., "pheromone trap Delta type - 4 traps/ha")
- chemical: specific pesticide, dosage, timing
- ipmSummary: step-by-step strategy

Return ONLY valid JSON:
{
  "pestName": "",
  "scientificName": "",
  "pestType": "insect|mite|nematode|rodent|mollusk|bird",
  "affectedPlants": ["specific crop 1", "crop 2"],
  "damageDescription": "specific description",
  "lifeStages": ["egg", "larva", "pupa", "adult"],
  "peakActivity": "e.g., 'June-August, >25°C'",
  "economicThreshold": "e.g., '10% infested plants'",
  "control": {
    "cultural": ["specific practice 1", "practice 2"],
    "biological": ["specific enemy - application"],
    "mechanical": ["specific trap/barrier"],
    "chemical": ["chemical - dosage per L or ha"],
    "ipmSummary": "specific integrated strategy"
  },
  "safetyNotes": "specific PPE or pre‑harvest interval"
}`;
    }

    // Helper to call Claude and parse JSON
    async function callClaude() {
      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 2000,
          system: systemPrompt,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: userPrompt }]
        })
      });

      if (!claudeRes.ok) {
        const errText = await claudeRes.text();
        console.log(`Claude API error ${claudeRes.status}:`, errText.substring(0, 200));
        return null;
      }

      const claudeData = await claudeRes.json();
      const textBlocks = claudeData.content.filter(b => b.type === "text");
      if (textBlocks.length === 0) return null;

      const rawText = textBlocks.map(b => b.text || "").join("");
      const clean = rawText.replace(/```json|```/g, "").trim();

      try {
        const parsed = JSON.parse(clean);
        // Validate required fields exist and no generic content
        if (type === "plant" && (!parsed.commonName || !parsed.scientificName)) return null;
        if (type === "disease" && (!parsed.diseaseName || !parsed.pathogenName)) return null;
        if (type === "pest" && (!parsed.pestName || !parsed.scientificName)) return null;
        if (isGenericData(parsed, type)) return null;
        return parsed;
      } catch (e) {
        console.log("JSON parse failed, raw start:", rawText.substring(0, 200));
        return null;
      }
    }

    // Try Claude with web search (up to 2 attempts)
    let finalData = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      finalData = await callClaude();
      if (finalData) break;
      console.log(`Attempt ${attempt} failed for ${query}, retrying...`);
      await new Promise(r => setTimeout(r, 1000)); // short delay before retry
    }

    if (finalData) {
      console.log(`✅ Specific data retrieved for ${query} (${type})`);
      return res.json({ success: true, source: "claude-search", data: finalData });
    } else {
      // No generic fallback – return error so frontend can handle
      console.log(`❌ Could not obtain specific information for ${query} after retries`);
      return res.status(404).json({
        success: false,
        error: `Could not retrieve specific information about this ${type} from web search. Please try again with a more precise name or check spelling.`
      });
    }

  } catch (err) {
    console.error("Claude endpoint error:", err);
    res.status(500).json({ success: false, error: "Internal server error. Please try again later." });
  }
});

// ==============================
// START SERVER
// ==============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Plant AI running on port", PORT);
});
