const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fetch = require("node-fetch");
const FormData = require("form-data");

const app = express();
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });

/* ================= CORS ================= */
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  next();
});

/* ================= MIDDLEWARE ================= */
app.use(express.json());

/* ================= ENV ================= */
const WEATHER_KEY = process.env.WEATHER_KEY;
const PLANTNET_KEY = process.env.PLANTNET_KEY;
const PLANT_ID_KEY = process.env.PLANT_ID_KEY;
const ROBOFLOW_KEY = process.env.ROBOFLOW_API_KEY;

/* ================= ROOT ================= */
app.get("/", (req, res) => {
  res.json({
    status: "🌾 COMPLETE SMART FARM SYSTEM",
    endpoints: [
      "/weather",
      "/soil",
      "/ai-crop",
      "/identify",
      "/disease",
      "/calendar",
      "/fertilizer",
      "/full-analysis"
    ]
  });
});

/* ================= CALENDAR ================= */
const plantingCalendar = {
  Lagos: { maize: "Mar-Jun", rice: "Apr-Aug", cassava: "All year" },
  Ogun: { maize: "Mar-Jun", rice: "Apr-Aug", yam: "Mar-May" },
  Oyo: { maize: "Mar-Jul", rice: "May-Sep", yam: "Apr-Jun" },
  Kwara: { maize: "Apr-Jul", rice: "Jun-Sep", sorghum: "May-Jul" },
  Kano: { millet: "Jun-Jul", sorghum: "Jun-Aug", maize: "Jul-Aug" },
  Kaduna: { maize: "May-Jul", rice: "Jun-Sep", soybean: "Jun-Jul" }
};

/* ================= WEATHER ================= */
app.get("/weather", async (req, res) => {
  try {
    const { lat, lon, city } = req.query;

    if (!city && (!lat || !lon)) {
      return res.status(400).json({ error: "Provide city OR lat/lon" });
    }

    if (!WEATHER_KEY) {
      return res.json({
        temp: 30,
        rain: 0,
        humidity: 50,
        desc: "fallback",
        location: city || "Nigeria"
      });
    }

    const url = city
      ? `https://api.openweathermap.org/data/2.5/weather?q=${city},NG&appid=${WEATHER_KEY}&units=metric`
      : `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_KEY}&units=metric`;

    const r = await fetch(url);
    const data = await r.json();

    res.json({
      temp: data.main?.temp,
      rain: data.rain?.["1h"] || 0,
      humidity: data.main?.humidity,
      desc: data.weather?.[0]?.description,
      location: data.name
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
      return res.json({ ph: 6.2, source: "fallback" });
    }

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

/* ================= CROPS ================= */
const crops = [
  { name: "Maize", temp: [20, 35], rain: [500, 1200], ph: [5.5, 7], yield: 5, fertilizer: "NPK + Urea", zone: ["All"] },
  { name: "Rice", temp: [22, 30], rain: [800, 2000], ph: [5, 6.5], yield: 4, fertilizer: "Urea + NPK", zone: ["All"] },
  { name: "Cassava", temp: [25, 35], rain: [700, 1500], ph: [5, 7], yield: 12, fertilizer: "NPK 12-12-17", zone: ["All"] },
  { name: "Yam", temp: [24, 32], rain: [1000, 1500], ph: [5.5, 7], yield: 8, fertilizer: "Organic + NPK" },
  { name: "Sorghum", temp: [25, 38], rain: [300, 800], ph: [5.5, 7.5], yield: 3, fertilizer: "DAP + Urea" }
];

function scoreCrop(c, e) {
  let s = 0;
  if (e.temp >= c.temp[0] && e.temp <= c.temp[1]) s += 3;
  if (e.rain >= c.rain[0] && e.rain <= c.rain[1]) s += 3;
  if (e.soilPh >= c.ph[0] && e.soilPh <= c.ph[1]) s += 2;
  return s;
}

function label(score) {
  if (score >= 8) return "⭐ BEST";
  if (score >= 5) return "⭐ GOOD";
  return "⚠ RISKY";
}

function profit(c) {
  return c.yield * 200000;
}

/* ================= AI CROP ================= */
app.post("/ai-crop", (req, res) => {
  const { temp, rain, soilPh } = req.body;

  if (!temp || !rain || !soilPh) {
    return res.status(400).json({ error: "Missing inputs" });
  }

  const result = crops.map(c => {
    const score = scoreCrop(c, { temp, rain, soilPh });

    return {
      name: c.name,
      score,
      label: label(score),
      yield: c.yield,
      fertilizer: c.fertilizer,
      profit: profit(c)
    };
  });

  result.sort((a, b) => b.score - a.score);

  res.json({ top: result.slice(0, 5) });
});

/* ================= FULL ANALYSIS ================= */
app.get("/full-analysis", async (req, res) => {
  const { lat, lon, city } = req.query;

  const weather = await (await fetch(
    `${req.protocol}://${req.get("host")}/weather?${city ? `city=${city}` : `lat=${lat}&lon=${lon}`}`
  )).json();

  let soil = { ph: 6.2 };
  if (lat && lon) {
    soil = await (await fetch(
      `${req.protocol}://${req.get("host")}/soil?lat=${lat}&lon=${lon}`
    )).json();
  }

  const ai = await (await fetch(
    `${req.protocol}://${req.get("host")}/ai-crop`,
    {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        temp: weather.temp,
        rain: weather.rain,
        soilPh: soil.ph
      })
    }
  )).json();

  res.json({ weather, soil, crops: ai.top });
});

/* ================= IDENTIFY (PlantNet + Plant.id) ================= */
app.post("/identify", upload.single("image"), async (req, res) => {
  try {
    const imageBuffer = req.file.buffer;

    // Try PlantNet
    try {
      const form = new FormData();
      form.append("images", imageBuffer, "plant.jpg");

      const r = await fetch(
        `https://my-api.plantnet.org/v2/identify/all?api-key=${PLANTNET_KEY}`,
        { method: "POST", body: form }
      );

      const data = await r.json();

      if (data?.results?.[0]) {
        return res.json({
          source: "PlantNet",
          plant: data.results[0].species.commonNames?.[0],
          confidence: data.results[0].score
        });
      }
    } catch {}

    // Fallback to Plant.id
    const base64 = imageBuffer.toString("base64");

    const r2 = await fetch("https://api.plant.id/v2/identify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": PLANT_ID_KEY
      },
      body: JSON.stringify({ images: [base64] })
    });

    const data2 = await r2.json();

    res.json({
      source: "Plant.id",
      plant: data2?.suggestions?.[0]?.plant_name,
      confidence: data2?.suggestions?.[0]?.probability
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ================= DISEASE ================= */
app.post("/disease", upload.single("image"), async (req, res) => {
  const base64 = req.file.buffer.toString("base64");

  const r = await fetch(
    `https://serverless.roboflow.com/plant-disease/1?api_key=${ROBOFLOW_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: base64
    }
  );

  const data = await r.json();

  res.json({
    disease: data?.predictions?.[0]?.class || "Healthy",
    confidence: data?.predictions?.[0]?.confidence || 0
  });
});

/* ================= FERTILIZER ================= */
app.get("/fertilizer", (req, res) => {
  const { crop } = req.query;

  const found = crops.find(c => c.name.toLowerCase() === crop?.toLowerCase());

  if (!found) return res.json({ error: "Crop not found" });

  res.json({
    crop: found.name,
    recommendation: found.fertilizer
  });
});

/* ================= CALENDAR ================= */
app.get("/calendar", (req, res) => {
  const { state, crop } = req.query;

  res.json({
    state,
    crop,
    bestTime: plantingCalendar[state]?.[crop] || "Not available"
  });
});

/* ================= START ================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 FULL SYSTEM RUNNING ON " + PORT);
});
