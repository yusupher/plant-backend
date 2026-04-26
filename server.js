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

/* ================= WEATHER (ROBUST + FALLBACK) ================= */
app.get("/weather", async (req, res) => {
  try {
    const { lat, lon, city } = req.query;

    // fallback if no API key
    if (!WEATHER_KEY) {
      return res.json({
        temp: 30,
        rain: 0,
        desc: "fallback weather",
        location: city || "unknown"
      });
    }

    let url = city
      ? `https://api.openweathermap.org/data/2.5/weather?q=${city},NG&appid=${WEATHER_KEY}&units=metric`
      : `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_KEY}&units=metric`;

    const r = await fetch(url);
    const data = await r.json();

    if (!data || !data.main) {
      return res.json({
        temp: 30,
        rain: 0,
        desc: "fallback weather",
        location: city || "unknown"
      });
    }

    res.json({
      temp: data.main.temp || 30,
      rain: data.rain?.["1h"] || 0,
      desc: data.weather?.[0]?.description || "unknown",
      location: data.name || city || "unknown"
    });

  } catch (err) {
    res.json({
      temp: 30,
      rain: 0,
      desc: "fallback",
      location: "unknown"
    });
  }
});

/* ================= SOIL (ISRIC + SAFE FALLBACK) ================= */
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
    const data = await r.json();

    const phRaw =
      data?.properties?.layers?.[0]?.depths?.[0]?.values?.mean;

    const ph = phRaw ? (phRaw / 10).toFixed(1) : 6.2;

    res.json({
      ph,
      source: phRaw ? "isric" : "fallback",
      note: phRaw ? "real soil data" : "estimated safe default"
    });

  } catch (err) {
    res.json({
      ph: 6.2,
      source: "fallback",
      note: "error fallback"
    });
  }
});

/* ================= AI CROP ENGINE (NO CRASH VERSION) ================= */
app.post("/ai-crop", (req, res) => {
  try {
    const { temp = 30, rain = 800, soilPh = 6.5, zone = "All" } = req.body || {};

    const results = crops.map(crop => {
      let score = 0;

      // climate match
      if (temp >= crop.temp[0] && temp <= crop.temp[1]) score += 3;
      if (rain >= crop.rain[0] && rain <= crop.rain[1]) score += 3;
      if (soilPh >= crop.ph[0] && soilPh <= crop.ph[1]) score += 2;

      // zone match
      if (crop.zones.includes(zone) || crop.zones.includes("All")) {
        score += 2;
      }

      // pest resistance boost
      score += crop.pestResistanceScore || 0;

      return {
        name: crop.name,
        varieties: crop.varieties,
        yield: crop.yield,
        fertilizer: crop.fertilizer,
        waterNeedScore: crop.waterNeedScore,
        pestResistanceScore: crop.pestResistanceScore,
        score
      };
    });

    results.sort((a, b) => b.score - a.score);

    res.json({
      top: results.slice(0, 5)
    });

  } catch (err) {
    res.json({
      top: [],
      error: "AI crop engine safe fallback"
    });
  }
});

/* ================= PLANT IDENTIFICATION ================= */
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

  } catch (err) {
    res.json({ error: "plant identification failed" });
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
    const top = data?.predictions?.[0];

    res.json({
      disease: top?.class || "Healthy",
      confidence: Math.round((top?.confidence || 0) * 100)
    });

  } catch (err) {
    res.json({ error: "disease detection failed" });
  }
});

/* ================= PEST DETECTION ================= */
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
    res.json({ error: "pest detection failed" });
  }
});

/* ================= PLANT HEALTH ================= */
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
    res.json({ error: "health check failed" });
  }
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Backend running on port " + PORT);
});
