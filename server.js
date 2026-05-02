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
// API KEYS (replace with your own if needed)
// ==============================
const PLANTNET_KEY = "2b104s5nNyqRjHHyiCJveuBwu";
const ROBOFLOW_KEY = "33LnNNZCWrWy3FQGulD9";
const ROBOFLOW_MODEL = "plant-dataset-ypln5-to68g/1";
const PEST_MODEL = "insect-e746x-iuclt/1";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "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";

app.get("/", (req, res) => {
  res.json({
    status: "Plant AI Backend Running 🚀",
    endpoints: ["/identify", "/disease", "/detect-pest", "/claude-info"]
  });
});

// ==============================
// 🌿 PLANT IDENTIFICATION (PlantNet)
// ==============================
app.post("/identify", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "No image uploaded" });
    const form = new FormData();
    form.append("images", req.file.buffer, { filename: "plant.jpg", contentType: "image/jpeg" });
    const response = await fetch(`https://my-api.plantnet.org/v2/identify/all?api-key=${PLANTNET_KEY}`, {
      method: "POST", body: form, headers: form.getHeaders()
    });
    const data = await response.json();
    res.json({ success: true, source: "PlantNet", data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================
// 🦠 DISEASE DETECTION (Roboflow + fallback)
// ==============================
app.post("/disease", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "No image uploaded" });
    const base64 = req.file.buffer.toString("base64");
    try {
      const rfUrl = `https://serverless.roboflow.com/${ROBOFLOW_MODEL}?api_key=${ROBOFLOW_KEY}`;
      const rfRes = await fetch(rfUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: base64 });
      const rfText = await rfRes.text();
      let rfData;
      try { rfData = JSON.parse(rfText); } catch { rfData = { raw: rfText }; }
      if (rfData && !rfData.error) return res.json({ success: true, source: "Roboflow", data: rfData });
    } catch (err) { console.log("Roboflow failed:", err.message); }
    try {
      const plantRes = await fetch("https://api.plant.id/v3/health_assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Api-Key": "PUT_YOUR_PLANT_ID_KEY_HERE" },
        body: JSON.stringify({ images: [{ image: base64 }], health: "only" })
      });
      const text = await plantRes.text();
      let plantData;
      try { plantData = JSON.parse(text); } catch { plantData = null; }
      if (plantData) return res.json({ success: true, source: "Plant.id (fallback)", data: plantData });
      return res.json({ success: false, source: "Plant.id", error: "Invalid response", raw: text });
    } catch (err) {
      return res.json({ success: false, source: "Plant.id", error: err.message });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================
// 🐛 PEST DETECTION (Roboflow)
// ==============================
app.post("/detect-pest", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "No image uploaded" });
    const base64 = req.file.buffer.toString("base64");
    const rfUrl = `https://serverless.roboflow.com/${PEST_MODEL}?api_key=${ROBOFLOW_KEY}`;
    const rfRes = await fetch(rfUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: base64 });
    const rfText = await rfRes.text();
    let rfData;
    try { rfData = JSON.parse(rfText); } catch { rfData = { raw: rfText }; }
    if (rfData && rfData.predictions && rfData.predictions.length > 0) {
      const top = rfData.predictions.reduce((max, p) => p.confidence > max.confidence ? p : max, rfData.predictions[0]);
      return res.json({ success: true, result: top.class || "Unknown pest", confidence: Math.round(top.confidence * 100) });
    }
    return res.json({ success: true, result: "No pest detected", confidence: 0 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================
// 🤖 CLAUDE AI COMPREHENSIVE INFO (FIXED MODEL)
// ==============================
function buildPrompt(query, type) {
  if (type === "plant") {
    return {
      system: "You are a professional botanist and agronomist. Return ONLY valid JSON. No markdown, no extra text, no explanation.",
      user: `Provide accurate, specific, research-based information about the plant: "${query}".
Return ONLY this JSON structure filled with real specific data:
{
  "commonName": "real common name",
  "scientificName": "real scientific name",
  "family": "real family name",
  "order": "real order",
  "kingdom": "Plantae",
  "class": "real class",
  "category": "crop or tree or weed or shrub or herb or grass",
  "origin": "specific region of origin",
  "description": "3-4 specific sentences describing this exact plant appearance, habitat, and characteristics",
  "uses": ["specific use 1", "specific use 2", "specific use 3", "specific use 4", "specific use 5"],
  "nutritionalValue": "specific nutritional composition if food crop, else null",
  "economicImportance": "specific economic data and importance",
  "ecologicalRole": "specific ecological role and interactions",
  "growingConditions": {
    "climate": "specific climate type required",
    "soil": "specific soil type and pH",
    "rainfall": "specific mm range per year",
    "temperature": "specific celsius range"
  },
  "isWeed": false,
  "weedControl": null,
  "interestingFacts": ["specific fact 1", "specific fact 2", "specific fact 3"]
}
If this plant is a weed, set isWeed to true and replace weedControl null with:
{
  "cultural": ["specific cultural control method 1", "specific method 2", "specific method 3"],
  "mechanical": ["specific mechanical method 1", "specific method 2"],
  "biological": ["specific biocontrol agent and exact application method"],
  "chemical": ["specific herbicide name - exact dosage and timing", "specific herbicide 2 - rate"],
  "ipmSummary": "specific integrated weed management strategy for this exact weed species"
}`
    };
  } else if (type === "disease") {
    return {
      system: "You are a plant pathologist. Return ONLY valid JSON. No markdown, no extra text, no explanation.",
      user: `Provide accurate, specific, research-based information about the plant disease: "${query}".
Return ONLY this JSON structure filled with real specific data:
{
  "diseaseName": "exact disease name",
  "pathogenType": "fungal or bacterial or viral or nematode or physiological",
  "pathogenName": "exact pathogen scientific name",
  "affectedPlants": ["specific crop 1", "specific crop 2", "specific crop 3"],
  "symptoms": ["specific symptom 1", "specific symptom 2", "specific symptom 3", "specific symptom 4", "specific symptom 5"],
  "spreadMechanism": "specific detailed how this disease spreads",
  "favorableConditions": "specific temperature, humidity, and seasonal conditions that favor this disease",
  "economicImpact": "specific yield loss data and economic impact",
  "control": {
    "cultural": ["specific cultural practice 1", "specific practice 2", "specific practice 3"],
    "biological": ["specific biocontrol agent name and application method", "specific agent 2"],
    "chemical": ["specific fungicide or bactericide name - exact dosage per litre and spray interval", "specific chemical 2 - rate and timing"],
    "resistant_varieties": ["specific resistant variety name 1", "specific variety 2"],
    "ipmSummary": "specific integrated disease management strategy combining all methods"
  },
  "preventionTips": ["specific prevention tip 1", "specific tip 2", "specific tip 3", "specific tip 4"]
}`
    };
  } else {
    return {
      system: "You are an entomologist and IPM specialist. Return ONLY valid JSON. No markdown, no extra text, no explanation.",
      user: `Provide accurate, specific, research-based information about the pest: "${query}".
Return ONLY this JSON structure filled with real specific data:
{
  "pestName": "exact pest common name",
  "scientificName": "exact scientific name",
  "pestType": "insect or mite or nematode or rodent or mollusk or bird",
  "affectedPlants": ["specific crop 1", "specific crop 2", "specific crop 3"],
  "damageDescription": "specific detailed description of damage this pest causes",
  "lifeStages": ["egg - specific description and duration", "larva or nymph - specific description and duration", "adult - specific description and lifespan"],
  "peakActivity": "specific season, temperature, and humidity conditions for peak activity",
  "economicThreshold": "specific number per plant or percentage damage before intervention",
  "control": {
    "cultural": ["specific cultural practice 1", "specific practice 2", "specific practice 3"],
    "biological": ["specific natural enemy species and how to deploy", "specific biopesticide name and rate"],
    "mechanical": ["specific trap type and placement instructions", "specific physical barrier method"],
    "chemical": ["specific pesticide active ingredient - exact dosage and pre-harvest interval", "specific pesticide 2 - rate and safety interval"],
    "ipmSummary": "specific integrated pest management strategy for this exact pest"
  },
  "safetyNotes": "specific safety precautions including PPE required, re-entry intervals, and container disposal"
}`
    };
  }
}

async function callClaude(query, type) {
  const { system, user } = buildPrompt(query, type);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",   // ✅ FIXED – ACTIVE MODEL
      max_tokens: 2000,
      system: system,
      messages: [{ role: "user", content: user }]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API ${response.status}: ${errText.substring(0, 300)}`);
  }

  const data = await response.json();
  const textBlock = data.content.find(c => c.type === "text");
  if (!textBlock) throw new Error("No text block in Claude response");

  const clean = textBlock.text.replace(/```json|```/g, "").trim();
  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON object found in Claude response");

  return JSON.parse(jsonMatch[0]);
}

app.post("/claude-info", async (req, res) => {
  try {
    const { query, type } = req.body;
    if (!query || !type) return res.status(400).json({ success: false, error: "Missing query or type" });
    if (!["plant", "disease", "pest"].includes(type)) return res.status(400).json({ success: false, error: "Invalid type" });

    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await callClaude(query, type);
        console.log(`✅ Claude succeeded for "${query}" (${type}) attempt ${attempt}`);
        return res.json({ success: true, source: "claude", data: result });
      } catch (err) {
        lastError = err.message;
        console.log(`⚠️ Attempt ${attempt} failed: ${lastError}`);
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
      }
    }

    console.error(`❌ All attempts failed for "${query}": ${lastError}`);
    return res.json({ success: false, error: lastError });
  } catch (err) {
    console.error("Claude endpoint error:", err);
    res.json({ success: false, error: err.message });
  }
});

// ==============================
// START SERVER
// ==============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Plant AI running on port", PORT));
