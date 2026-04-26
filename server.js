const express = require("express");
const multer = require("multer");
const cors = require("cors");
const FormData = require("form-data");
const crops = require("./cropdata");

const app = express();
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());

/* =========================
   ENV KEYS
========================= */
const WEATHER_KEY = process.env.WEATHER_KEY;
const PLANTNET_KEY = process.env.PLANTNET_KEY;
const ROBOFLOW_KEY = process.env.ROBOFLOW_API_KEY;
const PLANT_ID_KEY = process.env.PLANT_ID_KEY;

/* =========================
   ROOT CHECK (RENDER SAFE)
========================= */
app.get("/", (req, res) => {
  res.send("🌾 Smart Farm API Running");
});

/* =========================
   🌤 WEATHER (FIXED + SAFE)
========================= */
app.get("/weather", async (req, res) => {
  try {
    const { lat, lon, city } = req.query;

    if (!WEATHER_KEY) {
      return res.status(400).json({ error: "Missing WEATHER_KEY in env" });
    }

    const url = city
      ? `https://api.openweathermap.org/data/2.5/weather?q=${city},NG&appid=${WEATHER_KEY}&units=metric`
      : `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_KEY}&units=metric`;

    const r = await fetch(url);
    const data = await r.json();

    if (!data || !data.main) {
      return res.status(500).json({
        error: "Invalid weather response",
        detail: data
      });
    }

    res.json({
      temp: data.main.temp,
      rain: data.rain?.["1h"] || 0,
      desc: data.weather?.[0]?.description || "unknown",
      location: data.name
    });

  } catch (err) {
    res.status(500).json({ error: "weather failed", detail: err.message });
  }
});

/* =========================
   🌍 SOIL (SAFE ISRIC)
========================= */
app.get("/soil", async (req, res) => {
  try {
    const { lat, lon } = req.query;

    const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon}&lat=${lat}&property=phh2o&depth=0-5cm&value=mean`;

    const r = await fetch(url);
    const data = await r.json();

    const ph =
      data?.properties?.layers?.[0]?.depths?.[0]?.values?.mean;

    res.json({
      ph: ph ? ph / 10 : 6.2,
      source: ph ? "isric" : "fallback",
      note: ph ? "real data" : "estimated safe default"
    });

  } catch (err) {
    res.status(500).json({ error: "soil failed", detail: err.message });
  }
});

/* =========================
   🌾 SMART CROP ENGINE
   (GET + POST SUPPORT FIXED)
========================= */
function scoreCrop(crop, env) {
  let score = 0;

  if (env.temp >= crop.temp[0] && env.temp <= crop.temp[1]) score += 3;
  if (env.rain >= crop.rain[0] && env.rain <= crop.rain[1]) score += 2;
  if (env.soilPh >= crop.ph[0] && env.soilPh <= crop.ph[1]) score += 2;

  score += crop.pestResistanceScore || 0;
  score += (4 - (crop.waterNeedScore || 2));

  return score;
}

/* POST */
app.post("/ai-crop", (req, res) => {
  runCropEngine(req.body, res);
});

/* GET (FOR BROWSER TESTING) */
app.get("/ai-crop", (req, res) => {
  runCropEngine({
    temp: Number(req.query.temp),
    rain: Number(req.query.rain),
    soilPh: Number(req.query.soilPh),
    zone: req.query.zone
  }, res);
});

/* ENGINE */
function runCropEngine(body, res) {
  try {
    const { temp, rain, soilPh, zone } = body;

    if (!temp || !rain || !soilPh) {
      return res.status(400).json({
        error: "Missing required inputs: temp, rain, soilPh"
      });
    }

    let filtered = crops;

    if (zone) {
      filtered = crops.filter(c =>
        c.zones.includes(zone)
      );
    }

    const scored = filtered
      .map(c => ({
        ...c,
        score: scoreCrop(c, { temp, rain, soilPh })
      }))
      .sort((a, b) => b.score - a.score);

    res.json({
      top: scored.slice(0, 5),
      total: scored.length
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/* =========================
   🌿 PLANT IDENTIFICATION
========================= */
app.post("/identify-plant", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.json({ error: "No image uploaded" });

    const form = new FormData();
    form.append("images", req.file.buffer, {
      filename: "plant.jpg",
      contentType: "image/jpeg"
    });

    const r = await fetch(
      `https://my-api.plantnet.org/v2/identify/all?api-key=${PLANTNET_KEY}`,
      {
        method: "POST",
        body: form
      }
    );

    const data = await r.json();
    const top = data?.results?.[0];

    res.json({
      plant:
        top?.species?.commonNames?.[0] ||
        top?.species?.scientificNameWithoutAuthor ||
        "Unknown",
      confidence: top?.score || 0
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   🦠 DISEASE DETECTION
========================= */
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
    const top = data?.predictions?.[0];

    res.json({
      disease: top?.class || "Healthy",
      confidence: Math.round((top?.confidence || 0) * 100)
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   🐛 PEST DETECTION
========================= */
app.post("/detect-pest", upload.single("image"), async (req, res) => {
  try {
    const base64 = req.file.buffer.toString("base64");

    const r = await fetch(
      `https://serverless.roboflow.com/insect-e746x-iuclt/1?api_key=${ROBOFLOW_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: base64
      }
    );

    const data = await r.json();
    const top = data?.predictions?.[0];

    res.json({
      pest: top?.class || "None",
      confidence: Math.round((top?.confidence || 0) * 100)
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   🌱 PLANT HEALTH
========================= */
app.post("/plant-health", upload.single("image"), async (req, res) => {
  try {
    const base64 = req.file.buffer.toString("base64");

    const r = await fetch("https://api.plant.id/v2/identify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": PLANT_ID_KEY
      },
      body: JSON.stringify({
        images: [`data:image/jpeg;base64,${base64}`],
        modifiers: ["health_all"]
      })
    });

    const data = await r.json();
    const top = data?.suggestions?.[0];

    const health = top?.health?.probability || 0;

    res.json({
      health: Math.round(health * 100),
      status: health > 0.6 ? "Healthy" : "Unhealthy"
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   🚀 START SERVER (RENDER SAFE)
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Smart Farm API running on port " + PORT);
});
