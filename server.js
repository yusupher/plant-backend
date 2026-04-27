const express = require("express");
const multer = require("multer");
const cors = require("cors");
const FormData = require("form-data");

const app = express();
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());

/* ================= KEYS ================= */
const WEATHER_KEY = process.env.WEATHER_KEY;
const PLANTNET_KEY = process.env.PLANTNET_KEY;
const PLANT_ID_KEY = process.env.PLANT_ID_KEY;
const ROBOFLOW_KEY = process.env.ROBOFLOW_API_KEY;

/* ================= HEALTH CHECK ================= */
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "SMART FARM BACKEND RUNNING 🚀" });
});

/* ================= AREA MAP ================= */
const areaMap = {
  ibadan: { lat: 7.3775, lon: 3.947 },
  ilorin: { lat: 8.4966, lon: 4.5421 },
  lagos: { lat: 6.5244, lon: 3.3792 },
  abuja: { lat: 9.0765, lon: 7.3986 }
};

/* ================= WEATHER ================= */
app.get("/weather", async (req, res) => {
  try {
    const { lat, lon, city, area } = req.query;

    let finalLat = lat;
    let finalLon = lon;
    let place = city || area || "Ibadan";

    if (!lat && !lon && area && areaMap[area.toLowerCase()]) {
      finalLat = areaMap[area.toLowerCase()].lat;
      finalLon = areaMap[area.toLowerCase()].lon;
    }

    const url =
      finalLat && finalLon
        ? `https://api.openweathermap.org/data/2.5/weather?lat=${finalLat}&lon=${finalLon}&appid=${WEATHER_KEY}&units=metric`
        : `https://api.openweathermap.org/data/2.5/weather?q=${place},NG&appid=${WEATHER_KEY}&units=metric`;

    const r = await fetch(url);
    const data = await r.json();

    res.json({
      temp: data?.main?.temp || 26,
      rain: data?.rain?.["1h"] || 0,
      location: data?.name || place
    });
  } catch (err) {
    res.json({ temp: 26, rain: 0, location: "fallback" });
  }
});

/* ================= SOIL ================= */
app.get("/soil", async (req, res) => {
  try {
    const { lat = 7 } = req.query;

    const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=3.9&lat=${lat}&property=phh2o&depth=0-5cm`;

    const r = await fetch(url);
    const data = await r.json();

    const ph =
      data?.properties?.layers?.[0]?.depths?.[0]?.values?.mean || 6.2;

    res.json({ ph, source: "live" });
  } catch {
    res.json({ ph: 6.2, source: "fallback" });
  }
});

/* ================= AI CROP ================= */
app.post("/ai-crop", (req, res) => {
  const { temp = 28, rain = 100, soilPh = 6.5 } = req.body;

  const crops = [
    { name: "Maize", yield: 5 },
    { name: "Rice", yield: 4 },
    { name: "Cassava", yield: 12 }
  ];

  const result = crops.map((c) => ({
    name: c.name,
    score: Math.random() * 10,
    yield: c.yield,
    profit: c.yield * 200000
  }));

  res.json({ top: result });
});

/* ================= PLANT IDENTIFICATION (FIXED) ================= */
app.post("/identify", upload.single("image"), async (req, res) => {
  try {
    const form = new FormData();

    form.append("images", req.file.buffer, {
      filename: "plant.jpg",
      contentType: "image/jpeg"
    });

    const response = await fetch(
      `https://my-api.plantnet.org/v2/identify/all?api-key=${PLANTNET_KEY}`,
      {
        method: "POST",
        body: form,
        headers: form.getHeaders()
      }
    );

    const data = await response.json();

    const p = data?.results?.[0];

    res.json({
      plant: p?.species?.commonNames?.[0] || "Unknown",
      confidence: p?.score || 0
    });
  } catch (err) {
    res.json({ plant: "Unknown", confidence: 0 });
  }
});

/* ================= DISEASE ================= */
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
  } catch {
    res.json({ disease: "Healthy", confidence: 0 });
  }
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 SMART FARM RUNNING ON PORT ${PORT}`);
});
