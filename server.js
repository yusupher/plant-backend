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

const WEATHER_KEY = process.env.WEATHER_KEY;
const PLANTNET_KEY = process.env.PLANTNET_KEY;
const ROBOFLOW_KEY = process.env.ROBOFLOW_API_KEY;
const PLANT_ID_KEY = process.env.PLANT_ID_KEY;

/* =========================
   🏠 ROOT CHECK (IMPORTANT FOR RENDER)
========================= */
app.get("/", (req, res) => {
  res.send("🌾 Smart Farm API Running");
});


/* =========================
   🌤️ WEATHER
========================= */
app.get("/weather", async (req, res) => {
  try {
    const { lat, lon, city } = req.query;

    let url = city
      ? `https://api.openweathermap.org/data/2.5/weather?q=${city},NG&appid=${WEATHER_KEY}&units=metric`
      : `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_KEY}&units=metric`;

    const r = await fetch(url);
    const data = await r.json();

    res.json({
      temp: data.main?.temp,
      rain: data.rain?.["1h"] || 0,
      desc: data.weather?.[0]?.description,
      location: data.name
    });

  } catch (e) {
    res.status(500).json({ error: "weather failed", detail: e.message });
  }
});


/* =========================
   🌍 SOIL (ISRIC)
========================= */
app.get("/soil", async (req, res) => {
  try {
    const { lat, lon } = req.query;

    const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon}&lat=${lat}&property=phh2o&depth=0-5cm&value=mean`;

    const r = await fetch(url);
    const data = await r.json();

    res.json(data);

  } catch (e) {
    res.status(500).json({ error: "soil failed", detail: e.message });
  }
});


/* =========================
   🧠 SMART CROP ENGINE (FIXED + DYNAMIC)
========================= */
function scoreCrop(crop, env) {
  let score = 0;

  if (env.temp >= crop.tempMin && env.temp <= crop.tempMax) score += 3;
  if (env.rain >= crop.rainMin) score += 2;
  if (env.soilPh >= crop.phMin && env.soilPh <= crop.phMax) score += 2;

  if (env.drought && crop.droughtTolerance >= 4) score += 2;
  if (env.pests && crop.pestResistance >= 4) score += 2;

  return score;
}

app.post("/ai-crop", (req, res) => {
  try {
    const { temp, rain, soilPh, drought, pests, zone } = req.body;

    let filtered = crops;

    if (zone) {
      filtered = crops.filter(c => c.zone.includes(zone));
    }

    const scored = filtered.map(c => ({
      ...c,
      score: scoreCrop(c, { temp, rain, soilPh, drought, pests })
    }));

    scored.sort((a, b) => b.score - a.score);

    res.json({
      top: scored.slice(0, 5),
      total: scored.length
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


/* =========================
   🌿 PLANT IDENTIFICATION (PlantNet FIXED)
========================= */
app.post("/identify-plant", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.json({ error: "No image uploaded" });

    const form = new FormData();
    form.append("images", req.file.buffer, {
      filename: "plant.jpg",
      contentType: "image/jpeg"
    });

    const response = await fetch(
      `https://my-api.plantnet.org/v2/identify/all?api-key=${PLANTNET_KEY}`,
      {
        method: "POST",
        body: form
      }
    );

    const data = await response.json();

    const top = data?.results?.[0];

    res.json({
      plant:
        top?.species?.commonNames?.[0] ||
        top?.species?.scientificNameWithoutAuthor ||
        "Unknown",
      confidence: top?.score || 0
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


/* =========================
   🦠 DISEASE DETECTION (FIXED ROBofLOW)
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

  } catch (e) {
    res.status(500).json({ error: e.message });
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

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


/* =========================
   🌱 PLANT HEALTH (Plant.id FIXED)
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

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


/* =========================
   🚀 START
========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Backend running on port " + PORT));
