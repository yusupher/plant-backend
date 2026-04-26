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
const PLANT_ID_KEY = process.env.plant_id;

/* ================= ROOT ================= */
app.get("/", (req, res) => {
  res.send("🌾 Smart Farm AI FULL SYSTEM ACTIVE");
});

/* ================= WEATHER ================= */
app.get("/weather", async (req, res) => {
  try {
    const { city, lat, lon } = req.query;

    if (!city && (!lat || !lon)) {
      return res.status(400).json({ error: "Missing location" });
    }

    const url = city
      ? `https://api.openweathermap.org/data/2.5/weather?q=${city},NG&appid=${WEATHER_KEY}&units=metric`
      : `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_KEY}&units=metric`;

    const r = await fetch(url);
    const d = await r.json();

    if (!r.ok) return res.status(400).json(d);

    res.json({
      temp: d.main.temp,
      rain: d.rain?.["1h"] || 0,
      desc: d.weather[0].description,
      location: d.name
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ================= SOIL ================= */
app.get("/soil", async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.json({
        ph: 6.2,
        source: "fallback",
        note: "missing coordinates"
      });
    }

    const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon}&lat=${lat}&property=phh2o&depth=0-5cm&value=mean`;

    const r = await fetch(url);
    const d = await r.json();

    const ph =
      d?.properties?.layers?.[0]?.depths?.[0]?.values?.mean;

    res.json({
      ph: ph || 6.2,
      source: ph ? "live" : "fallback"
    });

  } catch {
    res.json({ ph: 6.2, source: "fallback" });
  }
});

/* ================= AI ENGINE ================= */

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

function label(score) {
  if (score >= 12) return "⭐ BEST MATCH";
  if (score >= 8) return "⭐ GOOD MATCH";
  return "⚠ RISKY";
}

/* ================= AI CROP ================= */
app.post("/ai-crop", (req, res) => {
  const { temp, rain, soilPh, zone, drought } = req.body;

  if (temp == null || rain == null || soilPh == null) {
    return res.status(400).json({ error: "Missing inputs" });
  }

  const env = { temp, rain, soilPh, zone, drought };

  const result = crops.map(c => {
    const score = scoreCrop(c, env);

    return {
      name: c.name,
      score,
      label: label(score),
      yield: c.yield,
      fertilizer: c.fertilizer,
      fertilizerType: c.fertilizerType,
      profitPerHa: Math.round(c.yield * 120000 * (1 + score / 20)),
      risk: score < 8 ? "High Risk" : "Low Risk",
      explanation:
        score < 8
          ? "Crop not ideal for current conditions"
          : "Good farming conditions"
    };
  });

  result.sort((a, b) => b.score - a.score);

  res.json({ top: result.slice(0, 5) });
});

/* ================= FERTILIZER CALCULATOR ================= */
app.post("/fertilizer", (req, res) => {
  const { cropName, areaHa } = req.body;

  const crop = crops.find(c => c.name === cropName);

  if (!crop) return res.status(404).json({ error: "Crop not found" });

  res.json({
    crop: crop.name,
    recommendation: crop.fertilizer,
    area: areaHa,
    estimatedUsageKg: areaHa * 200
  });
});

/* ================= PROFIT ================= */
app.post("/profit", (req, res) => {
  const { cropName, areaHa } = req.body;

  const crop = crops.find(c => c.name === cropName);

  if (!crop) return res.status(404).json({ error: "Crop not found" });

  const revenue = crop.yield * 120000 * areaHa;

  res.json({
    crop: crop.name,
    areaHa,
    estimatedProfit: Math.round(revenue)
  });
});

/* ================= PLANT CALENDAR ================= */
app.get("/calendar", (req, res) => {
  const { state } = req.query;

  const zones = {
    "Lagos": "South",
    "Kano": "North",
    "Oyo": "South",
    "Kaduna": "North"
  };

  const zone = zones[state] || "South";

  res.json({
    state,
    zone,
    planting: zone === "North"
      ? ["May", "June", "July"]
      : ["March", "April", "September"]
  });
});

/* ================= VOICE ASSISTANT ================= */
app.post("/voice", (req, res) => {
  const { crop, lang } = req.body;

  const messages = {
    yoruba: `Igbinrere: ${crop} dara fun oko yi. Rii daju fertiliza to to.`,
    igbo: `Nduzi: ${crop} dị mma maka ala a. jiri fatịlaiza kwesịrị ekwesị.`,
    hausa: `Shawarwari: ${crop} ya dace da wannan ƙasa. yi amfani da taki mai kyau.`
  };

  res.json({
    text: messages[lang] || messages.yoruba
  });
});

/* ================= PLANTNET ================= */
app.post("/identify-plant", upload.single("image"), async (req, res) => {
  const form = new FormData();
  form.append("images", req.file.buffer, { filename: "plant.jpg" });

  const r = await fetch(
    `https://my-api.plantnet.org/v2/identify/all?api-key=${PLANTNET_KEY}`,
    { method: "POST", body: form }
  );

  const d = await r.json();
  const top = d.results?.[0];

  res.json({
    plant:
      top?.species?.commonNames?.[0] ||
      top?.species?.scientificNameWithoutAuthor,
    confidence: top?.score
  });
});

/* ================= PLANT ID ================= */
app.post("/plant-health", async (req, res) => {
  const { image } = req.body;

  const r = await fetch("https://api.plant.id/v2/identify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": PLANT_ID_KEY
    },
    body: JSON.stringify({
      images: [image],
      modifiers: ["health_all"]
    })
  });

  const d = await r.json();

  res.json({
    health: d?.suggestions?.[0]?.health?.probability || 0
  });
});

/* ================= START ================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Smart Farm FULL AI running on " + PORT);
});
