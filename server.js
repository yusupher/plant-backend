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
  res.json({ status: "🌾 Smart Farm API Running" });
});

/* ================= WEATHER (FIXED) ================= */
app.get("/weather", async (req, res) => {
  try {
    const { lat, lon, city } = req.query;

    if (!city && (!lat || !lon)) {
      return res.status(400).json({
        error: "Provide city OR lat & lon"
      });
    }

    const url = city
      ? `https://api.openweathermap.org/data/2.5/weather?q=${city},NG&appid=${WEATHER_KEY}&units=metric`
      : `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_KEY}&units=metric`;

    const r = await fetch(url);
    const data = await r.json();

    if (!data || data.cod !== 200) {
      return res.status(400).json({
        error: "Invalid weather response",
        detail: data.message || "unknown error"
      });
    }

    res.json({
      temp: data.main?.temp,
      humidity: data.main?.humidity,
      rain: data.rain?.["1h"] || 0,
      desc: data.weather?.[0]?.description,
      location: data.name
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ================= SOIL (FIXED + FALLBACK) ================= */
app.get("/soil", async (req, res) => {
  try {
    const { lat, lon } = req.query;

    const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon}&lat=${lat}&property=phh2o&depth=0-5cm&value=mean`;

    const r = await fetch(url);
    const data = await r.json();

    const ph =
      data?.properties?.layers?.[0]?.depths?.[0]?.values?.mean;

    let soilPh;

    if (ph === null || ph === undefined) {
      soilPh = 6.2; // fallback for West Africa soil average
    } else {
      soilPh = ph / 10;
    }

    res.json({
      ph: soilPh,
      source: ph ? "ISRIC" : "fallback",
      note: ph ? "real data" : "estimated"
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ================= SMART CROP ENGINE ================= */
function scoreCrop(crop, env) {
  let score = 0;

  if (env.temp >= crop.temp[0] && env.temp <= crop.temp[1]) score += 3;
  if (env.rain >= crop.rain[0] && env.rain <= crop.rain[1]) score += 2;
  if (env.ph >= crop.ph[0] && env.ph <= crop.ph[1]) score += 2;

  score += (crop.pestResistanceScore || 0);
  score += (4 - (crop.waterNeedScore || 2));

  return score;
}

app.post("/ai-crop", (req, res) => {
  try {
    const { temp, rain, ph, zone } = req.body;

    let list = crops;

    if (zone) {
      list = crops.filter(c =>
        c.zones.includes(zone) || c.zones.includes("All")
      );
    }

    const scored = list.map(c => ({
      ...c,
      score: scoreCrop(c, { temp, rain, ph })
    }));

    scored.sort((a, b) => b.score - a.score);

    res.json({
      best: scored.slice(0, 5),
      total: scored.length
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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

/* ================= DISEASE ================= */
app.post("/detect-disease", async (req, res) => {
  try {
    const base64 = req.body.image;

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

/* ================= PEST ================= */
app.post("/detect-pest", async (req, res) => {
  try {
    const base64 = req.body.image;

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

/* ================= PLANT HEALTH ================= */
app.post("/plant-health", async (req, res) => {
  try {
    const base64 = req.body.image;

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

/* ================= START ================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Smart Farm API running on port " + PORT);
});
