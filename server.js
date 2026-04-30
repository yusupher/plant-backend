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
// (with built-in fallback if API fails)
// ==============================

function buildFallback(query, type) {
  const q = query.toLowerCase();
  if (type === "plant") {
    return {
      commonName: query,
      scientificName: query,
      family: "Unknown",
      order: "Unknown",
      kingdom: "Plantae",
      class: "Unknown",
      category: "crop",
      origin: "Tropical/Subtropical regions",
      description: `${query} is a plant species. For detailed botanical information, consult a local agricultural extension office or botanical reference.`,
      uses: ["Food production", "Traditional medicine", "Agricultural use"],
      nutritionalValue: "Contains essential nutrients — consult nutritional databases for specifics.",
      economicImportance: "Economically important crop in tropical and subtropical farming systems.",
      ecologicalRole: "Plays a role in local ecosystems and agricultural biodiversity.",
      growingConditions: {
        climate: "Tropical to subtropical",
        soil: "Well-drained loamy soil",
        rainfall: "500–1500mm per year",
        temperature: "18–35°C"
      },
      isWeed: false,
      weedControl: null,
      interestingFacts: [
        "Widely cultivated across Africa and Asia.",
        "Important for food security in developing regions."
      ]
    };
  } else if (type === "disease") {
    return {
      diseaseName: query,
      pathogenType: "fungal",
      pathogenName: "Unknown pathogen",
      affectedPlants: ["Various crop plants"],
      symptoms: [
        "Leaf discoloration or spotting",
        "Wilting or stunted growth",
        "Lesions on stem or fruit",
        "Premature leaf drop"
      ],
      spreadMechanism: "Spreads through infected plant material, wind, water splash, and contaminated tools.",
      favorableConditions: "High humidity, warm temperatures, and poor air circulation favor disease development.",
      economicImpact: "Can cause significant yield losses if not managed early.",
      control: {
        cultural: [
          "Remove and destroy infected plant material",
          "Rotate crops to break disease cycle",
          "Avoid overhead irrigation",
          "Plant certified disease-free seeds"
        ],
        biological: [
          "Trichoderma spp. — apply as soil drench or foliar spray",
          "Bacillus subtilis-based biocontrol products"
        ],
        chemical: [
          "Mancozeb 80WP — 2.5g/L water, spray every 7–14 days",
          "Copper oxychloride — 3g/L water as preventive spray",
          "Consult local agronomist for registered products"
        ],
        resistant_varieties: ["Use locally recommended resistant varieties where available"],
        ipmSummary: "Apply IPM by combining cultural practices (sanitation, rotation), biological agents, and targeted chemical application only when disease pressure is high. Monitor regularly and act early."
      },
      preventionTips: [
        "Inspect plants regularly for early signs",
        "Maintain field hygiene — remove crop debris",
        "Use certified seed and resistant varieties",
        "Avoid working in fields when plants are wet"
      ]
    };
  } else {
    return {
      pestName: query,
      scientificName: "Unknown species",
      pestType: "insect",
      affectedPlants: ["Various crop plants"],
      damageDescription: "Causes physical damage to leaves, stems, roots, or fruits, leading to reduced yield and plant vigor.",
      lifeStages: ["Egg", "Larva/Nymph", "Adult"],
      peakActivity: "Most active during warm, humid seasons.",
      economicThreshold: "Take action when 10–15% of plants show visible damage or pest count exceeds 5 per plant.",
      control: {
        cultural: [
          "Crop rotation to disrupt pest lifecycle",
          "Deep ploughing to expose pupae and eggs",
          "Intercropping to reduce pest buildup",
          "Remove crop residues after harvest"
        ],
        biological: [
          "Encourage natural predators — ladybirds, lacewings, parasitic wasps",
          "Apply Beauveria bassiana or Metarhizium for fungal biocontrol",
          "Use neem-based biopesticides (Azadirachtin)"
        ],
        mechanical: [
          "Yellow sticky traps to monitor and catch flying adults",
          "Hand-picking of larvae from small farms",
          "Use of insect nets or row covers"
        ],
        chemical: [
          "Cypermethrin 10EC — 10ml/L water, spray at early infestation",
          "Lambda-cyhalothrin — 5ml/L water for severe outbreaks",
          "Rotate chemical classes to prevent resistance"
        ],
        ipmSummary: "Use IPM: start with cultural controls and monitoring, introduce biological agents early, and only use chemicals as a last resort when pest populations exceed economic thresholds. Always follow label instructions."
      },
      safetyNotes: "Wear protective clothing when applying pesticides. Observe pre-harvest intervals. Store chemicals safely away from children and food. Dispose of containers responsibly."
    };
  }
}

app.post("/claude-info", async (req, res) => {
  try {
    const { query, type } = req.body;
    if (!query || !type) {
      return res.status(400).json({ success: false, error: "Missing query or type" });
    }
    if (!["plant", "disease", "pest"].includes(type)) {
      return res.status(400).json({ success: false, error: "Invalid type. Use: plant, disease, or pest" });
    }

    let prompt = "";
    if (type === "plant") {
      prompt = `You are a professional botanist and agronomist. Provide comprehensive information about the plant: "${query}".
Return ONLY valid JSON (no markdown fences, no extra text) with this exact structure:
{"commonName":"","scientificName":"","family":"","order":"","kingdom":"Plantae","class":"","category":"crop|tree|weed|shrub|herb|grass","origin":"","description":"2-3 sentences about appearance and habitat","uses":["use1","use2","use3"],"nutritionalValue":"string or null","economicImportance":"","ecologicalRole":"","growingConditions":{"climate":"","soil":"","rainfall":"","temperature":""},"isWeed":false,"weedControl":null,"interestingFacts":["fact1","fact2"]}
If it is a weed set isWeed:true and fill weedControl:{"cultural":["method1"],"mechanical":["method1"],"biological":["agent - description"],"chemical":["herbicide - dosage/use"],"ipmSummary":"full IPM weed control summary"}`;
    } else if (type === "disease") {
      prompt = `You are a plant pathologist. Provide comprehensive information about the plant disease: "${query}".
Return ONLY valid JSON (no markdown, no extra text):
{"diseaseName":"","pathogenType":"fungal|bacterial|viral|nematode|physiological","pathogenName":"","affectedPlants":["plant1"],"symptoms":["symptom1","symptom2"],"spreadMechanism":"","favorableConditions":"","economicImpact":"","control":{"cultural":["practice1"],"biological":["agent1"],"chemical":["fungicide - rate"],"resistant_varieties":["variety1"],"ipmSummary":""},"preventionTips":["tip1","tip2"]}`;
    } else {
      prompt = `You are an entomologist and pest management expert. Provide comprehensive information about the pest: "${query}".
Return ONLY valid JSON (no markdown, no extra text):
{"pestName":"","scientificName":"","pestType":"insect|mite|nematode|rodent|mollusk|bird","affectedPlants":["plant1"],"damageDescription":"","lifeStages":["stage1"],"peakActivity":"","economicThreshold":"","control":{"cultural":["practice1"],"biological":["natural enemy 1"],"mechanical":["trap/barrier"],"chemical":["pesticide - dosage"],"ipmSummary":""},"safetyNotes":""}`;
    }

    // Try Claude API first, fall back to built-in data if anything fails
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
          max_tokens: 1500,
          messages: [{ role: "user", content: prompt }]
        })
      });

      if (claudeRes.ok) {
        const claudeData = await claudeRes.json();
        const rawText = claudeData.content.map(b => b.text || "").join("");
        const clean = rawText.replace(/```json|```/g, "").trim();
        try {
          const parsed = JSON.parse(clean);
          console.log("✅ Claude API succeeded for:", query);
          return res.json({ success: true, source: "claude", data: parsed });
        } catch (e) {
          console.log("⚠️ Claude JSON parse failed, using fallback");
        }
      } else {
        console.log("⚠️ Claude API returned", claudeRes.status, "— using fallback");
      }
    } catch (e) {
      console.log("⚠️ Claude API unreachable:", e.message, "— using fallback");
    }

    // Fallback: return built-in data
    const fallback = buildFallback(query, type);
    return res.json({ success: true, source: "fallback", data: fallback });

  } catch (err) {
    // Last resort fallback — never return 500
    try {
      const fallback = buildFallback(req.body.query || "Unknown", req.body.type || "plant");
      return res.json({ success: true, source: "fallback", data: fallback });
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
