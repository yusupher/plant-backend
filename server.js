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
// (web search powered — real results)
// ==============================

function buildFallback(query, type) {
  if (type === "plant") {
    return {
      commonName: query, scientificName: query, family: "—", order: "—",
      kingdom: "Plantae", class: "—", category: "crop", origin: "Tropical/Subtropical regions",
      description: `${query} is a plant species. Detailed information could not be retrieved at this time.`,
      uses: ["Food production", "Traditional medicine", "Agricultural use"],
      nutritionalValue: "Consult nutritional databases for specifics.",
      economicImportance: "Economically important in tropical and subtropical farming systems.",
      ecologicalRole: "Plays a role in local ecosystems and agricultural biodiversity.",
      growingConditions: { climate: "Tropical to subtropical", soil: "Well-drained loamy soil", rainfall: "500–1500mm/year", temperature: "18–35°C" },
      isWeed: false, weedControl: null,
      interestingFacts: ["Widely cultivated across Africa and Asia.", "Important for food security in developing regions."]
    };
  } else if (type === "disease") {
    return {
      diseaseName: query, pathogenType: "fungal", pathogenName: "Unknown pathogen",
      affectedPlants: ["Various crop plants"],
      symptoms: ["Leaf discoloration or spotting", "Wilting or stunted growth", "Lesions on stem or fruit", "Premature leaf drop"],
      spreadMechanism: "Spreads through infected plant material, wind, water splash, and contaminated tools.",
      favorableConditions: "High humidity, warm temperatures, and poor air circulation.",
      economicImpact: "Can cause significant yield losses if not managed early.",
      control: {
        cultural: ["Remove and destroy infected material", "Rotate crops", "Avoid overhead irrigation", "Use certified disease-free seeds"],
        biological: ["Trichoderma spp. — soil drench or foliar spray", "Bacillus subtilis-based biocontrol products"],
        chemical: ["Mancozeb 80WP — 2.5g/L, spray every 7–14 days", "Copper oxychloride — 3g/L as preventive spray"],
        resistant_varieties: ["Use locally recommended resistant varieties"],
        ipmSummary: "Combine cultural practices, biological agents, and targeted chemical application only when disease pressure is high."
      },
      preventionTips: ["Inspect plants regularly", "Maintain field hygiene", "Use certified seed and resistant varieties", "Avoid working in wet fields"]
    };
  } else {
    return {
      pestName: query, scientificName: "Unknown species", pestType: "insect",
      affectedPlants: ["Various crop plants"],
      damageDescription: "Causes physical damage to leaves, stems, roots, or fruits reducing yield and plant vigor.",
      lifeStages: ["Egg", "Larva/Nymph", "Adult"], peakActivity: "Most active during warm, humid seasons.",
      economicThreshold: "Act when 10–15% of plants show visible damage or >5 pests per plant.",
      control: {
        cultural: ["Crop rotation", "Deep ploughing to expose pupae", "Intercropping", "Remove crop residues"],
        biological: ["Encourage natural predators — ladybirds, lacewings, parasitic wasps", "Apply Beauveria bassiana or Metarhizium", "Neem-based biopesticides (Azadirachtin)"],
        mechanical: ["Yellow sticky traps", "Hand-picking of larvae", "Insect nets or row covers"],
        chemical: ["Cypermethrin 10EC — 10ml/L, spray at early infestation", "Lambda-cyhalothrin — 5ml/L for severe outbreaks"],
        ipmSummary: "Start with cultural controls, introduce biological agents early, use chemicals only as last resort when populations exceed economic thresholds."
      },
      safetyNotes: "Wear PPE when applying pesticides. Observe pre-harvest intervals. Store chemicals safely away from children and food."
    };
  }
}

app.post("/claude-info", async (req, res) => {
  try {
    const { query, type } = req.body;
    if (!query || !type) return res.status(400).json({ success: false, error: "Missing query or type" });
    if (!["plant", "disease", "pest"].includes(type)) return res.status(400).json({ success: false, error: "Invalid type" });

    let systemPrompt = "";
    let userPrompt = "";

    if (type === "plant") {
      systemPrompt = "You are a professional botanist and agronomist. You MUST use the web_search tool to search for accurate, specific information about the plant before answering. Search for its scientific classification, uses, growing conditions, and if it is a weed, its IPM control methods. Base your answer entirely on search results, not generic knowledge.";
      userPrompt = `Search the web for comprehensive information about the plant: "${query}". 
Search for: its scientific name, family, classification (crop/tree/weed), origin, uses, nutritional value, economic importance, growing conditions, and if it is a weed its full IPM control methods.
After searching, return ONLY valid JSON (no markdown, no extra text):
{"commonName":"","scientificName":"","family":"","order":"","kingdom":"Plantae","class":"","category":"crop|tree|weed|shrub|herb|grass","origin":"","description":"3-4 specific sentences from search results","uses":["specific use 1","specific use 2","specific use 3","specific use 4"],"nutritionalValue":"specific nutritional info or null","economicImportance":"specific economic data","ecologicalRole":"","growingConditions":{"climate":"","soil":"","rainfall":"","temperature":""},"isWeed":false,"weedControl":null,"interestingFacts":["specific fact 1","specific fact 2","specific fact 3"]}
If weed, set isWeed:true and weedControl:{"cultural":["specific method"],"mechanical":["specific method"],"biological":["specific agent and how"],"chemical":["specific herbicide name - specific dosage"],"ipmSummary":"specific IPM strategy for this exact weed"}`;

    } else if (type === "disease") {
      systemPrompt = "You are a plant pathologist. You MUST use the web_search tool to search for accurate, specific information about this plant disease before answering. Search for the pathogen name, symptoms, spread, and specific control measures including fungicide/bactericide names and dosages.";
      userPrompt = `Search the web for comprehensive information about the plant disease: "${query}".
Search for: its causal pathogen, affected crops, specific symptoms, how it spreads, favorable conditions, economic impact, and specific IPM control measures with chemical names and rates.
After searching, return ONLY valid JSON (no markdown, no extra text):
{"diseaseName":"","pathogenType":"fungal|bacterial|viral|nematode|physiological","pathogenName":"specific pathogen scientific name","affectedPlants":["specific crop 1","specific crop 2"],"symptoms":["specific symptom 1","specific symptom 2","specific symptom 3","specific symptom 4"],"spreadMechanism":"specific spread mechanism from search","favorableConditions":"specific conditions","economicImpact":"specific yield loss data","control":{"cultural":["specific practice 1","specific practice 2"],"biological":["specific bioagent 1","specific bioagent 2"],"chemical":["specific fungicide name - specific rate per litre","specific fungicide 2 - rate"],"resistant_varieties":["specific variety name if found"],"ipmSummary":"specific integrated strategy for this disease"},"preventionTips":["specific tip 1","specific tip 2","specific tip 3"]}`;

    } else {
      systemPrompt = "You are an entomologist and pest management expert. You MUST use the web_search tool to search for accurate, specific information about this pest before answering. Search for its scientific name, life cycle, damage it causes, and specific IPM control methods including pesticide names and dosages.";
      userPrompt = `Search the web for comprehensive information about the pest: "${query}".
Search for: its scientific name, pest type, crops it attacks, specific damage it causes, life stages, peak activity periods, economic threshold, and specific IPM control measures with pesticide names and rates.
After searching, return ONLY valid JSON (no markdown, no extra text):
{"pestName":"","scientificName":"specific scientific name","pestType":"insect|mite|nematode|rodent|mollusk|bird","affectedPlants":["specific crop 1","specific crop 2"],"damageDescription":"specific damage description from search","lifeStages":["specific stage 1","specific stage 2","specific stage 3"],"peakActivity":"specific season/conditions","economicThreshold":"specific threshold value","control":{"cultural":["specific practice 1","specific practice 2"],"biological":["specific natural enemy 1 - how to use","specific agent 2"],"mechanical":["specific trap type","specific barrier"],"chemical":["specific pesticide name - specific dosage","specific pesticide 2 - rate"],"ipmSummary":"specific integrated pest management strategy for this pest"},"safetyNotes":"specific safety precautions"}`;
    }

    // Try Claude with web search tool
    try {
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

      if (claudeRes.ok) {
        const claudeData = await claudeRes.json();
        // Extract the final text block (after tool use)
        const textBlocks = claudeData.content.filter(b => b.type === "text");
        if (textBlocks.length > 0) {
          const rawText = textBlocks.map(b => b.text || "").join("");
          const clean = rawText.replace(/```json|```/g, "").trim();
          try {
            const parsed = JSON.parse(clean);
            console.log("✅ Claude web search succeeded for:", query);
            return res.json({ success: true, source: "claude-search", data: parsed });
          } catch (e) {
            console.log("⚠️ Claude JSON parse failed:", e.message);
            console.log("Raw text was:", rawText.substring(0, 300));
          }
        }
      } else {
        const errText = await claudeRes.text();
        console.log("⚠️ Claude API returned", claudeRes.status, errText.substring(0, 200));
      }
    } catch (e) {
      console.log("⚠️ Claude API error:", e.message);
    }

    // Fallback — never return 500
    console.log("Using built-in fallback for:", query);
    return res.json({ success: true, source: "fallback", data: buildFallback(query, type) });

  } catch (err) {
    try {
      return res.json({ success: true, source: "fallback", data: buildFallback(req.body.query || "Unknown", req.body.type || "plant") });
    } catch(e2) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
});

// ==============================
// START SERVER
// ==============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Plant AI running on port", PORT);
});
