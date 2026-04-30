const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fetch = require("node-fetch");
const FormData = require("form-data");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));

/* ======================
   🔑 KEYS
====================== */
const PLANTNET_KEY = process.env.PLANTNET_KEY;
const ROBOFLOW_KEY = process.env.ROBOFLOW_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

/* ======================
   MODELS
====================== */
const PLANT_MODEL = "plant-dataset-ypln5-to68g/1";
const DISEASE_MODEL = "plant-disease-xqd8b-tvz68/1";
const PEST_MODEL = "insect-e746x-iuclt/1";

/* ======================
   HEALTH CHECK
====================== */
app.get("/", (req, res) => {
  res.json({ status: "🌿 Smart Farm AI Running" });
});

/* ======================
   PLANT IDENTIFICATION
====================== */
app.post("/identify", upload.single("image"), async (req, res) => {
  try {
    const form = new FormData();
    form.append("images", req.file.buffer, "plant.jpg");

    const response = await fetch(
      `https://my-api.plantnet.org/v2/identify/all?api-key=${PLANTNET_KEY}`,
      { method: "POST", body: form, headers: form.getHeaders() }
    );

    const data = await response.json();

    res.json({ success: true, plant: data });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ======================
   ROBOFLOW HELPER
====================== */
async function runRoboflow(model, base64) {
  const url = `https://serverless.roboflow.com/${model}?api_key=${ROBOFLOW_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: base64
  });

  return await res.json();
}

/* ======================
   DISEASE DETECTION
====================== */
app.post("/disease", upload.single("image"), async (req, res) => {
  const base64 = req.file.buffer.toString("base64");
  const result = await runRoboflow(DISEASE_MODEL, base64);
  res.json({ success: true, disease: result });
});

/* ======================
   PEST DETECTION
====================== */
app.post("/pest", upload.single("image"), async (req, res) => {
  const base64 = req.file.buffer.toString("base64");
  const result = await runRoboflow(PEST_MODEL, base64);
  res.json({ success: true, pest: result });
});

/* ======================
   🤖 CLAUDE AI ANALYSIS
====================== */
async function askClaude(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }]
    })
  });

  const data = await res.json();
  return data.content?.[0]?.text || "";
}

/* ======================
   🌾 FULL ANALYSIS
====================== */
app.post("/analyze-all", upload.single("image"), async (req, res) => {
  try {
    const base64 = req.file.buffer.toString("base64");

    const plant = await runRoboflow(PLANT_MODEL, base64);
    const disease = await runRoboflow(DISEASE_MODEL, base64);
    const pest = await runRoboflow(PEST_MODEL, base64);

    const prompt = `
You are an agricultural AI expert.

Based on:
Plant: ${JSON.stringify(plant)}
Disease: ${JSON.stringify(disease)}
Pest: ${JSON.stringify(pest)}

Give:
1. Plant explanation
2. Disease status
3. Pest risk
4. Treatment advice
5. Best crop recommendation for Nigeria climate
Return in simple farmer-friendly language.
`;

    const advice = await askClaude(prompt);

    res.json({
      success: true,
      plant,
      disease,
      pest,
      advice
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ======================
   START SERVER
====================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Running on", PORT));
