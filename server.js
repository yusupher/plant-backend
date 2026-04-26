const multer = require("multer");
const cors = require("cors");
const fetch = require("node-fetch");
const FormData = require("form-data");

const app = express();
const upload = multer();

app.use(cors());
app.use(express.json());

/* =========================
   🌿 PLANT IDENTIFICATION (PlantNet)
========================= */
app.post("/identify", upload.single("image"), async (req, res) => {

  try {

    if (!req.file) {
      return res.json({
        result: "No image uploaded",
        confidence: 0
      });
    }

    const form = new FormData();
    form.append("images", req.file.buffer, "plant.jpg");

    const response = await fetch(
      "https://my-api.plantnet.org/v2/identify/all?api-key=2b104s5nNyqRjHHyiCJveuBwu",
      {
        method: "POST",
        body: form
      }
    );

    const data = await response.json();

    return res.json(data);

  } catch (err) {
    console.error("PlantNet Error:", err);
    return res.status(500).json({ error: err.message });
  }

});


/* =========================
   🦠 DISEASE DETECTION (FIXED ROBUST)
========================= */
app.post("/detect-disease", upload.single("image"), async (req, res) => {

  try {

    if (!req.file) {
      return res.json({
        result: "No image uploaded",
        confidence: 0
      });
    }

    const apiKey = "33LnNNZCWrWy3FQGulD9";

    const base64 = req.file.buffer.toString("base64");

    const url = `https://serverless.roboflow.com/plant-disease-xqd8b-tvz68/1?api_key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: base64
    });

    const data = await response.json();

    console.log("DISEASE RESPONSE:", data);

    /* =========================
       ❌ NO DETECTION HANDLING
    ========================= */
    if (!data.predictions || data.predictions.length === 0) {
      return res.json({
        result: "🌱 Healthy plant (no disease detected)",
        confidence: 0
      });
    }

    /* =========================
       🔥 FILTER LOW CONFIDENCE
    ========================= */
    const filtered = data.predictions.filter(p => p.confidence >= 0.3);

    if (filtered.length === 0) {
      return res.json({
        result: "🌱 Healthy plant (low confidence)",
        confidence: 0
      });
    }

    const top = filtered[0];

    return res.json({
      result: top.class,
      confidence: top.confidence
    });

  } catch (err) {

    console.error("Disease Error:", err);

    return res.status(500).json({
      error: err.message
    });

  }

});


/* =========================
   🐛 PEST DETECTION (ROBOFLOW)
========================= */
app.post("/detect-pest", upload.single("image"), async (req, res) => {

  try {

    if (!req.file) {
      return res.json({
        result: "No image uploaded",
        confidence: 0
      });
    }

    const apiKey = "33LnNNZCWrWy3FQGulD9";

    const base64 = req.file.buffer.toString("base64");

    const url = `https://serverless.roboflow.com/insect-e746x-iuclt/1?api_key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: base64
    });

    const data = await response.json();

    console.log("PEST RESPONSE:", data);

    if (!data.predictions || data.predictions.length === 0) {
      return res.json({
        result: "No pest detected 🟢",
        confidence: 0
      });
    }

    const filtered = data.predictions.filter(p => p.confidence >= 0.3);

    if (filtered.length === 0) {
      return res.json({
        result: "No pest detected 🟢",
        confidence: 0
      });
    }

    const top = filtered[0];

    return res.json({
      result: top.class,
      confidence: top.confidence
    });

  } catch (err) {

    console.error("PEST Error:", err);

    return res.status(500).json({
      error: err.message
    });

  }

});


/* =========================
   🚀 START SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
