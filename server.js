app.post("/detect-disease", upload.single("image"), async (req, res) => {

  try {
    const imageBuffer = req.file.buffer;

    const response = await fetch(
      "https://api-inference.huggingface.co/models/nateraw/plant-disease-classification",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.HF_TOKEN}`,
          "Content-Type": "application/octet-stream"
        },
        body: imageBuffer
      }
    );

    const data = await response.json();

    console.log("HF RESPONSE:", data);

    // ===============================
    // CASE 1: valid array response
    // ===============================
    if (Array.isArray(data) && data.length > 0) {

      const best = data[0];
      const label = best.label;
      const score = best.score;

      // 🌱 HEALTHY CHECK (important fix)
      const isHealthy =
        label.toLowerCase().includes("healthy") ||
        label.toLowerCase().includes("no disease") ||
        score < 0.5;

      if (isHealthy) {
        return res.json({
          result: "🌱 Healthy plant (No disease detected)",
          confidence: score || 0
        });
      }

      return res.json({
        result: label,
        confidence: score
      });
    }

    // ===============================
    // CASE 2: object response
    // ===============================
    if (data && data.label) {

      const isHealthy =
        data.label.toLowerCase().includes("healthy") ||
        data.score < 0.5;

      return res.json({
        result: isHealthy
          ? "🌱 Healthy plant (No disease detected)"
          : data.label,
        confidence: data.score || 0
      });
    }

    // ===============================
    // CASE 3: nothing returned
    // ===============================
    return res.json({
      result: "⚠️ Could not determine disease (try again)",
      confidence: 0
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});
