const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fetch = require("node-fetch");
const FormData = require("form-data");

const crops = require("./cropdata");

const app = express();
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());

/* ================= ENV ================= */
const WEATHER_KEY = process.env.WEATHER_KEY;
const PLANTNET_KEY = process.env.PLANTNET_KEY;
const ROBOFLOW_KEY = process.env.ROBOFLOW_API_KEY;

/* ================= ROOT ================= */
app.get("/", (req, res) => {
  res.send("🌾 Smart Farm AI PRO SYSTEM RUNNING");
});

/* ================= WEATHER ================= */
app.get("/weather", async (req, res) => {
  try {
    const { city } = req.query;

    const url = `https://api.openweathermap.org/data/2.5/weather?q=${city},NG&appid=${WEATHER_KEY}&units=metric`;

    const r = await fetch(url);
    const data = await r.json();

    if (!r.ok) return res.status(400).json(data);

    res.json({
      temp: data.main?.temp,
      rain: data.rain?.["1h"] || 0,
      desc: data.weather?.[0]?.description,
      location: data.name,
      lat: data.coord?.lat,
      lon: data.coord?.lon
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ================= SOIL ================= */
app.get("/soil", async (req, res) => {
  try {
    const { lat, lon } = req.query;

    const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon}&lat=${lat}&property=phh2o&depth=0-5cm&value=mean`;

    const r = await fetch(url);
    const data = await r.json();

    const ph = data?.properties?.layers?.[0]?.depths?.[0]?.values?.mean;

    res.json({
      ph: ph || 6.2,
      source: ph ? "live" : "fallback"
    });

  } catch {
    res.json({ ph: 6.2, source: "fallback" });
  }
});

/* ================= SMART ENGINE HELPERS ================= */

function label(score) {
  if (score >= 15) return "⭐ BEST MATCH";
  if (score >= 10) return "⭐ GOOD MATCH";
  return "⚠ RISKY";
}

function riskCheck(c, e) {
  let r = [];

  if (e.temp < c.temp[0] || e.temp > c.temp[1]) r.push("Temperature stress");
  if (e.rain < c.rain[0]) r.push("Low rainfall risk");
  if (e.soilPh < c.ph[0] || e.soilPh > c.ph[1]) r.push("Soil pH mismatch");

  return r;
}

/* ================= NEW: EXPLANATION ENGINE ================= */
function explain(c, score, risks) {
  if (score >= 15) {
    return `${c.name} is highly suitable due to optimal climate and soil match.`;
  }
  if (risks.length > 0) {
    return `${c.name} may struggle due to ${risks.join(", ")}.`;
  }
  return `${c.name} is moderately suitable with stable yield potential.`;
}

/* ================= PROFIT ENGINE ================= */
function profit(c, e) {
  const baseYield = c.yield || 5;
  const price = 180000;

  return Math.round(baseYield * (1 + scoreCrop(c, e) / 20) * price);
}

/* ================= FERTILIZER ================= */
function fertilizer(c) {
  return {
    perAcreKg: 120,
    perHectareKg: 300
  };
}

/* ================= YIELD PREDICTION ================= */
function yieldPredict(c, score) {
  return +(c.yield * (1 + score / 25)).toFixed(2);
}

/* ================= PLANTING CALENDAR ================= */
function calendar(state) {
  const north = ["Kano", "Kaduna", "Sokoto", "Bauchi"];
  const south = ["Lagos", "Oyo", "Edo", "Rivers"];

  if (south.includes(state)) {
    return {
      zone: "Southern Nigeria",
      crops: ["Cassava", "Maize", "Yam"],
      season: "March - October"
    };
  }

  if (north.includes(state)) {
    return {
      zone: "Northern Nigeria",
      crops: ["Millet", "Sorghum", "Cowpea"],
      season: "June - September"
    };
  }

  return {
    zone: "Guinea Savanna",
    crops: ["Maize", "Soybean"],
    season: "Mixed season"
  };
}

/* ================= SCORE ================= */
function scoreCrop(c, e) {
  let s = 0;

  if (e.temp >= c.temp[0] && e.temp <= c.temp[1]) s += 3;
  if (e.rain >= c.rain[0] && e.rain <= c.rain[1]) s += 3;
  if (e.soilPh >= c.ph[0] && e.soilPh <= c.ph[1]) s += 2;

  if (c.zones.includes("All") || c.zones.includes(e.zone)) s += 3;

  s += c.pestResistanceScore || 0;

  if (e.drought && c.waterNeedScore <= 2) s += 2;

  return s;
}

/* ================= AI CROP ENGINE ================= */
app.post("/ai-crop", (req, res) => {
  try {
    const { temp, rain, soilPh, zone, drought, state } = req.body;

    const env = { temp, rain, soilPh, zone, drought };

    const result = crops.map(c => {
      const score = scoreCrop(c, env);
      const risks = riskCheck(c, env);

      return {
        name: c.name,
        score,
        label: label(score),
        yield: yieldPredict(c, score),
        fertilizer: fertilizer(c),
        profitPerHectare: profit(c, env),
        risks,
        explanation: explain(c, score, risks)
      };
    });

    result.sort((a, b) => b.score - a.score);

    res.json({
      top: result.slice(0, 5),
      calendar: state ? calendar(state) : null
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ================= VOICE ASSISTANT ================= */
app.post("/voice", (req, res) => {
  const { lang } = req.body;

  const replies = {
    igbo: "Cassava na Maize kacha mma maka ugbo gị.",
    yoruba: "Maize ati Cassava ni o dara julọ.",
    hausa: "Masara da Gero sun fi dacewa."
  };

  res.json({ reply: replies[lang] || replies.yoruba });
});

/* ================= PLANT IDENTIFICATION ================= */
app.post("/identify-plant", upload.single("image"), async (req, res) => {
  try {
    const form = new FormData();
    form.append("images", req.file.buffer, { filename: "plant.jpg" });

    const r = await fetch(
      `https://my-api.plantnet.org/v2/identify/all?api-key=${PLANTNET_KEY}`,
      { method: "POST", body: form }
    );

    const data = await r.json();

    res.json({
      plant: data?.results?.[0]?.species?.scientificNameWithoutAuthor || "Unknown"
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ================= DISEASE DETECTION ================= */
app.post("/detect-disease", upload.single("image"), async (req, res) => {
  try {
    const base64 = req.file.buffer.toString("base64");

    const r = await fetch(
      `https://serverless.roboflow.com/plant-disease-xqd8b-tvz68/1?api_key=${ROBOFLOW_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: base64
      }
    );

    const data = await r.json();

    res.json({
      disease: data?.predictions?.[0]?.class || "Healthy",
      confidence: Math.round((data?.predictions?.[0]?.confidence || 0) * 100)
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Smart Farm AI PRO SYSTEM running on " + PORT);
});
