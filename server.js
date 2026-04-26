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

/* ================= ROOT ================= */
app.get("/", (req, res) => {
  res.send("🌾 Smart Farm AI FULL SYSTEM Running");
});

/* ================= WEATHER ================= */
app.get("/weather", async (req, res) => {
  try {
    const { lat, lon, city } = req.query;

    if (!city && (!lat || !lon)) {
      return res.status(400).json({ error: "Missing location" });
    }

    const url = city
      ? `https://api.openweathermap.org/data/2.5/weather?q=${city},NG&appid=${WEATHER_KEY}&units=metric`
      : `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_KEY}&units=metric`;

    const r = await fetch(url);
    const data = await r.json();

    if (!r.ok) {
      return res.status(400).json({ error: data.message });
    }

    res.json({
      temp: data.main?.temp,
      rain: data.rain?.["1h"] || 0,
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
      return res.json({
        ph: 6.2,
        source: "fallback",
        note: "missing coordinates"
      });
    }

    const url =
      `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon}&lat=${lat}&property=phh2o&depth=0-5cm&value=mean`;

    const r = await fetch(url);
    const data = await r.json();

    const ph =
      data?.properties?.layers?.[0]?.depths?.[0]?.values?.mean;

    res.json({
      ph: ph || 6.2,
      source: ph ? "live" : "fallback"
    });

  } catch {
    res.json({ ph: 6.2, source: "fallback" });
  }
});

/* ================= CORE AI FUNCTIONS ================= */

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

function riskCheck(c, e) {
  let r = [];

  if (e.temp < c.temp[0] || e.temp > c.temp[1])
    r.push("Temperature stress");

  if (e.rain < c.rain[0])
    r.push("Low rainfall risk");

  if (e.soilPh < c.ph[0] || e.soilPh > c.ph[1])
    r.push("Soil pH mismatch");

  return r;
}

function label(score) {
  if (score >= 12) return "⭐ BEST MATCH";
  if (score >= 8) return "⭐ GOOD MATCH";
  return "⚠ RISKY";
}

function profit(c, e) {
  const base = c.yield || 5;
  const price = 200000;
  const boost = 1 + scoreCrop(c, e) / 20;
  return Math.round(base * boost * price);
}

/* ================= AI CROP ENGINE ================= */
app.post("/ai-crop", (req, res) => {
  try {
    const { temp, rain, soilPh, zone, drought } = req.body;

    if (temp == null || rain == null || soilPh == null) {
      return res.status(400).json({ error: "Missing inputs" });
    }

    const env = { temp, rain, soilPh, zone, drought };

    let list = crops;

    if (zone) {
      list = crops.filter(c =>
        c.zones.includes("All") || c.zones.includes(zone)
      );
    }

    const result = list.map(c => {
      const score = scoreCrop(c, env);

      return {
        name: c.name,
        score,
        label: label(score),
        yield: c.yield,
        fertilizer: c.fertilizer,
        profit: profit(c, env),
        risks: riskCheck(c, env),
        explanation:
          riskCheck(c, env).length === 0
            ? "Ideal growing conditions"
            : "Issues: " + riskCheck(c, env).join(", ")
      };
    });

    result.sort((a, b) => b.score - a.score);

    res.json({ top: result.slice(0, 5) });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ================= PLANT IDENTIFICATION ================= */
app.post("/identify-plant", upload.single("image"), async (req, res) => {
  try {
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

/* ================= START ================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Smart Farm AI FULL SYSTEM running on " + PORT);
});
