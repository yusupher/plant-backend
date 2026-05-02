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
// KEYS (use environment variables)
// ==============================
const PLANTNET_KEY = "2b104s5nNyqRjHHyiCJveuBwu";
const ROBOFLOW_KEY = "33LnNNZCWrWy3FQGulD9";
const ROBOFLOW_MODEL = "plant-dataset-ypln5-to68g/1";
const PEST_MODEL = "insect-e746x-iuclt/1";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;  // MUST be set

if (!ANTHROPIC_API_KEY) {
  console.error("❌ ANTHROPIC_API_KEY environment variable not set!");
  process.exit(1);
}

// ==============================
// Helper: build prompt exactly like your working frontend
// ==============================
function buildPrompt(query, type) {
  if (type === "plant") {
    return `You are a professional botanist and agronomist with access to current botanical databases. Provide accurate, specific, research-based information about the plant: "${query}".
Return ONLY valid JSON (no markdown, no extra text):
{"commonName":"real common name","scientificName":"real scientific name","family":"real family","order":"real order","kingdom":"Plantae","class":"real class","category":"crop or tree or weed or shrub or herb or grass","origin":"specific origin region","description":"3-4 specific sentences about this exact plant","uses":["specific use 1","specific use 2","specific use 3","specific use 4","specific use 5"],"nutritionalValue":"specific nutritional details if food crop, else null","economicImportance":"specific economic importance with data","ecologicalRole":"specific ecological role","growingConditions":{"climate":"specific climate type","soil":"specific soil requirements","rainfall":"specific mm range","temperature":"specific °C range"},"isWeed":false,"weedControl":null,"interestingFacts":["specific fact 1","specific fact 2","specific fact 3"]}
If it is a weed set isWeed:true and weedControl:{"cultural":["specific method 1","specific method 2","specific method 3"],"mechanical":["specific method 1","specific method 2"],"biological":["specific bioagent and exact application method"],"chemical":["specific herbicide name - exact dosage and timing","specific herbicide 2 - rate"],"ipmSummary":"specific integrated weed management strategy for this exact weed species"}`;
  } else if (type === "disease") {
    return `You are a plant pathologist with expertise in tropical and subtropical crop diseases. Provide accurate, specific, research-based information about the plant disease: "${query}".
Return ONLY valid JSON (no markdown, no extra text):
{"diseaseName":"exact disease name","pathogenType":"fungal or bacterial or viral or nematode or physiological","pathogenName":"exact pathogen scientific name","affectedPlants":["specific crop 1","specific crop 2","specific crop 3"],"symptoms":["specific symptom 1","specific symptom 2","specific symptom 3","specific symptom 4","specific symptom 5"],"spreadMechanism":"specific detailed spread mechanism","favorableConditions":"specific temperature, humidity, and seasonal conditions","economicImpact":"specific yield loss percentages and economic data","control":{"cultural":["specific practice 1","specific practice 2","specific practice 3"],"biological":["specific bioagent name and application rate","specific bioagent 2"],"chemical":["specific fungicide/bactericide name - exact dosage per litre and spray interval","specific chemical 2 - rate and timing"],"resistant_varieties":["specific variety name 1","specific variety 2 if available"],"ipmSummary":"specific integrated disease management strategy combining all methods"},"preventionTips":["specific prevention tip 1","specific tip 2","specific tip 3","specific tip 4"]}`;
  } else { // pest
    return `You are an entomologist and IPM specialist with expertise in tropical crop pests. Provide accurate, specific, research-based information about the pest: "${query}".
Return ONLY valid JSON (no markdown, no extra text):
{"pestName":"exact pest common name","scientificName":"exact scientific name","pestType":"insect or mite or nematode or rodent or mollusk or bird","affectedPlants":["specific crop 1","specific crop 2","specific crop 3"],"damageDescription":"specific detailed damage this pest causes to plants","lifeStages":["egg - specific description and duration","larva/nymph - specific description","adult - specific description and lifespan"],"peakActivity":"specific season, temperature, and humidity conditions","economicThreshold":"specific number per plant or percentage damage before intervention","control":{"cultural":["specific practice 1","specific practice 2","specific practice 3"],"biological":["specific natural enemy species and how to deploy","specific biopesticide name and rate"],"mechanical":["specific trap type and placement instructions","specific physical barrier"],"chemical":["specific pesticide active ingredient - exact dosage and PHI","specific pesticide 2 - rate and safety interval"],"ipmSummary":"specific integrated pest management strategy for this pest"},"safetyNotes":"specific safety precautions including PPE, re-entry intervals, and disposal"}`;
  }
}

// ==============================
// 🤖 Enhanced Claude Info endpoint (secure, uses your working prompts)
// ==============================
app.post("/claude-info", async (req, res) => {
  try {
    const { query, type } = req.body;
    if (!query || !type) return res.status(400).json({ success: false, error: "Missing query or type" });
    if (!["plant", "disease", "pest"].includes(type)) return res.status(400).json({ success: false, error: "Invalid type" });

    const prompt = buildPrompt(query, type);

    // Use a reliable model – choose one that your API key supports
    // Options: "claude-3-haiku-20240307" (fast, cheap) or "claude-3-5-sonnet-20240620" (smarter)
    const model = "claude-3-haiku-20240307";  // change to "claude-3-5-sonnet-20240620" if needed

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Claude API error ${response.status}:`, errorText);
      return res.status(502).json({ success: false, error: `Claude API error: ${response.status}` });
    }

    const data = await response.json();
    const textBlock = data.content?.find(c => c.type === "text");
    if (!textBlock) throw new Error("No text block in response");

    const raw = textBlock.text;
    const jsonMatch = raw.replace(/```json|```/g, "").match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Could not extract JSON from response");

    const parsed = JSON.parse(jsonMatch[0]);
    res.json({ success: true, data: parsed });
  } catch (err) {
    console.error("/claude-info error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==============================
// Other endpoints (unchanged, but you can keep them)
// ==============================
app.get("/", (req, res) => {
  res.json({ status: "Plant AI Backend Running 🚀", endpoints: ["/identify", "/disease", "/detect-pest", "/claude-info"] });
});

app.post("/identify", upload.single("image"), async (req, res) => {
  // ... your original code
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

app.post("/disease", upload.single("image"), async (req, res) => {
  // ... same as your original (Roboflow + fallback)
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "No image uploaded" });
    const base64 = req.file.buffer.toString("base64");
    try {
      const rfUrl = `https://serverless.roboflow.com/${ROBOFLOW_MODEL}?api_key=${ROBOFLOW_KEY}`;
      const rfRes = await fetch(rfUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: base64 });
      const rfData = await rfRes.json();
      if (rfData && !rfData.error) return res.json({ success: true, source: "Roboflow", data: rfData });
    } catch (e) { console.log("Roboflow failed:", e.message); }
    // fallback – you should replace with your own key
    return res.json({ success: false, error: "No disease detection available" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/detect-pest", upload.single("image"), async (req, res) => {
  // ... same as your original
  try {
    if (!req.file) return res.status(400).json({ success: false, error: "No image uploaded" });
    const base64 = req.file.buffer.toString("base64");
    const rfUrl = `https://serverless.roboflow.com/${PEST_MODEL}?api_key=${ROBOFLOW_KEY}`;
    const rfRes = await fetch(rfUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: base64 });
    const rfData = await rfRes.json();
    if (rfData && rfData.predictions && rfData.predictions.length > 0) {
      const top = rfData.predictions.reduce((max, p) => p.confidence > max.confidence ? p : max, rfData.predictions[0]);
      return res.json({ success: true, result: top.class || "Unknown pest", confidence: Math.round(top.confidence * 100) });
    }
    return res.json({ success: true, result: "No pest detected", confidence: 0 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Plant AI running on port ${PORT}`));
