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

/* ================= ENV KEYS ================= */
const WEATHER_KEY = process.env.WEATHER_KEY;
const PLANTNET_KEY = process.env.PLANTNET_KEY;
const ROBOFLOW_KEY = process.env.ROBOFLOW_API_KEY;
const PLANT_ID_KEY = process.env.PLANT_ID_KEY;

/* ================= ROOT ================= */
app.get("/", (req, res) => {
  res.send("🌾 Smart Farm API Running");
});

/* ================= WEATHER ================= */
app.get("/weather", async (req, res) => {
  try {
    const { lat, lon, city } = req.query;

    if (!WEATHER_KEY) {
      return res.json({
        error: "Missing WEATHER_KEY",
        temp: 0,
        rain: 0,
        desc: "no api key",
        location: city || "unknown"
      });
    }

    const url = city
      ? `https://api.openweathermap.org/data/2.5/weather?q=${city},NG&appid=${WEATHER_KEY}&units=metric`
      : `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_KEY}&units=metric`;

    const r = await fetch(url);
    const data = await r.json();

    if (!r.ok) {
      return res.status(400).json({
        error: "Invalid weather response",
        detail: data.message || "weather failed"
      });
    }

    res.json({
      temp: data.main?.temp ?? 0,
      rain: data.rain?.["1h"] ?? 0,
      desc: data.weather?.[0]?.description ?? "unknown",
      location: data.name ?? city ?? "unknown"
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= SOIL (ISRIC) ================= */
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

    const url =
      `https://rest.isric.org/soilgrids/v2.0/properties/query?` +
      `lon=${lon}&lat=${lat}&property=phh2o&depth=0-5cm&value=mean`;

    const r = await fetch(url);
    const data = await r.json();

    const ph =
      data?.properties?.layers?.[0]?.depths?.[0]?.values?.mean;

    res.json({
      ph: ph ?? 6.2,
      source: ph ? "live" : "fallback",
      note: ph ? "real data" : "estimated safe default"
    });

  } catch (err) {
    res.json({
      ph: 6.2,
      source: "fallback",
      note: "error fallback"
    });
  }
});

/* ================= SMART CROP ENGINE ================= */
function scoreCrop(crop, env) {
  let score = 0;

  // temperature match
  if (env.temp >= crop.temp[0] && env.temp <= crop.temp[1]) score += 3;

  // rainfall match
  if (env.rain >= crop.rain[0] && env.rain <= crop.rain[1]) score += 3;

  // soil pH match
  if (env.soilPh >= crop.ph[0] && env.soilPh <= crop.ph[1]) score += 2;

  // zone match
  if (
    crop.zones?.includes("All") ||
    crop.zones?.includes(env.zone)
  ) {
    score += 3;
  }

  // pest resistance boost
  score += crop.pestResistanceScore || 0;

  // water logic
  if (env.drought && crop.waterNeedScore <= 2) score += 2;

  return score;
}

app.post("/ai-crop", (req, res) => {
  try {
    const { temp, rain, soilPh, zone, drought } = req.body;

    if (!temp || !rain || !soilPh) {
      return res.status(400).json({
        error: "Missing input values"
      });
    }

    let filtered = crops;

    if (zone) {
      filtered = crops.filter(c =>
        c.zones?.includes(zone) || c.zones?.includes("All")
      );
    }

    const scored = filtered.map(c => ({
      name: c.name,
      yield: c.yield,
      fertilizer: c.fertilizer,
      score: scoreCrop(c, {
        temp,
        rain,
        soilPh,
        zone,
        drought
      })
    }));

    scored.sort((a, b) => b.score - a.score);

    res.json({
      top: scored.slice(0, 5)
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Smart Farm API running on port " + PORT);
});
