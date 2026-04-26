const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fetch = require("node-fetch");
const FormData = require("form-data");

const app = express();
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());

/* ================= KEYS ================= */
const WEATHER_KEY = process.env.WEATHER_KEY;
const PLANTNET_KEY = process.env.PLANTNET_KEY;     // 🌿 Plant AI
const PLANT_ID_KEY = process.env.PLANT_ID_KEY;     // 🧠 internal system key
const ROBOFLOW_KEY = process.env.ROBOFLOW_API_KEY;

/* ================= AREA MAP ================= */
const areaMap = {
  ibadan: { lat: 7.3775, lon: 3.9470 },
  ilorin: { lat: 8.4966, lon: 4.5421 },
  lagos: { lat: 6.5244, lon: 3.3792 },
  abuja: { lat: 9.0765, lon: 7.3986 }
};

/* ================= MIDDLEWARE (PLANT ID SECURITY) ================= */
function validatePlantKey(req, res, next) {
  const key = req.headers["x-plant-id-key"];

  if (PLANT_ID_KEY && key !== PLANT_ID_KEY) {
    return res.status(401).json({ error: "Unauthorized PLANT_ID access" });
  }

  next();
}

/* ================= CROPS DATABASE ================= */
const crops = [
  { name: "Maize", temp: [20, 35], rain: [500, 1200], ph: [5.5, 7], yield: 5, fertilizer: "NPK + Urea" },
  { name: "Rice", temp: [22, 30], rain: [800, 2000], ph: [5, 6.5], yield: 4, fertilizer: "Urea + NPK" },
  { name: "Cassava", temp: [25, 35], rain: [700, 1500], ph: [5, 7], yield: 12, fertilizer: "Organic + NPK" },
  { name: "Yam", temp: [24, 32], rain: [1000, 1500], ph: [5.5, 7], yield: 8, fertilizer: "Organic manure" },
  { name: "Sorghum", temp: [25, 38], rain: [300, 800], ph: [5.5, 7.5], yield: 3, fertilizer: "DAP + Urea" }
];

/* ================= UTIL FUNCTIONS ================= */
function scoreCrop(c, e) {
  let s = 0;
  if (e.temp >= c.temp[0] && e.temp <= c.temp[1]) s += 3;
  if (e.rain >= c.rain[0] && e.rain <= c.rain[1]) s += 3;
  if (e.soilPh >= c.ph[0] && e.soilPh <= c.ph[1]) s += 2;
  return s;
}

function getCalendar(crop) {
  const map = {
    Maize: "Mar - Jun (Rainy Season)",
    Rice: "Apr - Aug (Wet Season)",
    Cassava: "All year planting",
    Yam: "Apr - Jul",
    Sorghum: "Jun - Aug"
  };
  return map[crop] || "Not available";
}

function getFertilizer(cropObj) {
  return {
    crop: cropObj.name,
    recommendation: cropObj.fertilizer,
    advice: "Apply in 2–3 split doses for best yield"
  };
}

/* ================= WEATHER (GPS + CITY + AREA) ================= */
app.get("/weather", async (req, res) => {
  try {
    const { lat, lon, city, area } = req.query;

    let finalLat = lat;
    let finalLon = lon;
    let place = city || area || "Ibadan";

    if (!lat && !lon && area) {
      const key = area.toLowerCase();
      if (areaMap[key]) {
        finalLat = areaMap[key].lat;
        finalLon = areaMap[key].lon;
      }
    }

    const url = finalLat && finalLon
      ? `https://api.openweathermap.org/data/2.5/weather?lat=${finalLat}&lon=${finalLon}&appid=${WEATHER_KEY}&units=metric`
      : `https://api.openweathermap.org/data/2.5/weather?q=${place},NG&appid=${WEATHER_KEY}&units=metric`;

    const r = await fetch(url);
    const data = await r.json();

    res.json({
      temp: data.main?.temp,
      rain: data.rain?.["1h"] || 0,
      humidity: data.main?.humidity,
      location: data.name || place
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ================= SMART FARM ENGINE ================= */
app.post("/smart-farm", (req, res) => {
  try {
    const { temp, rain, soilPh } = req.body;

    const scored = crops.map(c => {
      const score = scoreCrop(c, { temp, rain, soilPh });

      return {
        crop: c.name,
        score,
        yield: c.yield,
        profit: c.yield * 200000
      };
    });

    scored.sort((a, b) => b.score - a.score);

    const best = scored[0];
    const cropObj = crops.find(c => c.name === best.crop);

    res.json({
      bestCrop: best.crop,
      score: best.score,

      plantingCalendar: getCalendar(best.crop),

      fertilizer: getFertilizer(cropObj),

      alternatives: scored.slice(1, 5)
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ================= 🌿 PLANT ID (IMAGE) ================= */
app.post("/plant-id", validatePlantKey, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded" });
    }

    const form = new FormData();
    form.append("images", req.file.buffer, {
      filename: "plant.jpg",
      contentType: "image/jpeg"
    });

    const r = await fetch(
      `https://my-api.plantnet.org/v2/identify/all?api-key=${PLANTNET_KEY}`,
      { method: "POST", body: form }
    );

    const data = await r.json();
    const result = data?.results?.[0];

    if (!result) {
      return res.json({
        mode: "image",
        plant: "Unknown",
        confidence: 0
      });
    }

    res.json({
      mode: "image",
      plant: result.species?.commonNames?.[0] || "Unknown",
      scientific: result.species?.scientificName,
      family: result.species?.family?.scientificName,
      confidence: result.score
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ================= 🌿 PLANT ID (NAME SEARCH) ================= */
app.get("/plant-id/search", validatePlantKey, async (req, res) => {
  try {
    const { name } = req.query;

    if (!name) {
      return res.status(400).json({ error: "Name required" });
    }

    const r = await fetch(
      `https://my-api.plantnet.org/v2/species?search=${name}&api-key=${PLANTNET_KEY}`
    );

    const data = await r.json();

    res.json({
      mode: "text",
      query: name,
      results: (data?.results || []).slice(0, 5).map(p => ({
        scientific: p?.species?.scientificName,
        common: p?.species?.commonNames?.[0]
      }))
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ================= DISEASE DETECTION ================= */
app.post("/disease", upload.single("image"), async (req, res) => {
  try {
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

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ================= CALENDAR ================= */
app.get("/calendar", (req, res) => {
  const { crop } = req.query;

  res.json({
    crop,
    season: getCalendar(crop)
  });
});

/* ================= FERTILIZER ================= */
app.get("/fertilizer", (req, res) => {
  const { crop } = req.query;

  const found = crops.find(c => c.name.toLowerCase() === crop?.toLowerCase());

  if (!found) {
    return res.json({ error: "Crop not found" });
  }

  res.json(getFertilizer(found));
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 SMART FARM AI FULL SYSTEM RUNNING ON PORT " + PORT);
});
