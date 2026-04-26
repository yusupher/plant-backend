<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>🌿 KWASU SMART FARM AI (Plant + Disease + Pest)</title>
  <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.15.0/dist/tf.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@tensorflow-models/mobilenet@2.1.1/dist/mobilenet.min.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #c8e0bc; font-family: system-ui, sans-serif; padding: 16px; }
    .app { max-width: 750px; margin: 0 auto; background: white; border-radius: 2rem; overflow: hidden; box-shadow: 0 20px 35px rgba(0,0,0,0.2); }
    header { background: #1a3c2a; color: white; padding: 1rem; text-align: center; }
    header h1 { font-size: 1.5rem; display: flex; justify-content: center; gap: 10px; align-items: center; }
    .mode-selector { display: flex; justify-content: center; gap: 12px; margin-top: 8px; flex-wrap: wrap; align-items: center; }
    .mode-btn { background: #2d6a4f; border: none; padding: 6px 14px; border-radius: 40px; font-size: 0.7rem; font-weight: bold; cursor: pointer; color: white; }
    .mode-btn.active { background: #f4a261; color: #1a3c2a; }
    .refresh-btn, .owner-btn, .logout-btn { background: #1b5e3f; color: white; border: none; padding: 6px 14px; border-radius: 40px; font-size: 0.7rem; cursor: pointer; }
    .logout-btn { background: #b1624b; margin-left: 8px; }
    .camera-area { background: #1e3323; padding: 14px; }
    .video-box { position: relative; background: #0f1f12; border-radius: 28px; overflow: hidden; aspect-ratio: 4 / 3; }
    video { width: 100%; height: 100%; object-fit: cover; display: block; }
    .placeholder { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: #172e1a; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #b8daa4; gap: 8px; text-align: center; }
    .buttons { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; padding: 15px; background: white; }
    button, .file-label { background: #eef5ea; border: none; padding: 10px 18px; border-radius: 60px; font-weight: 600; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; }
    button.primary { background: #2f6b47; color: white; }
    button.danger { background: #b1624b; color: white; }
    button.disease-btn { background: #9e6b3e; color: white; }
    button.pest-btn { background: #7a5d3c; color: white; }
    .file-label { background: #e2eed9; }
    .preview-area { text-align: center; margin-top: 8px; }
    #preview { max-width: 100%; max-height: 180px; border-radius: 20px; display: none; margin-top: 6px; border: 2px solid #b8daa4; object-fit: contain; background: #f0f7eb; }
    .status { background: #eef3e8; padding: 8px 16px; font-size: 0.8rem; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .result { padding: 20px; background: #fffef7; }
    .plant-card, .disease-card, .pest-card { background: #fefbe6; border-radius: 24px; padding: 18px; border-left: 6px solid #3b8b5a; margin-bottom: 16px; }
    .disease-card { border-left-color: #c4682c; background: #fff4ea; }
    .pest-card { border-left-color: #b56533; background: #faefdf; }
    .error-msg { background: #ffe5d9; border-radius: 20px; padding: 16px; text-align: center; }
    .loader { display: inline-block; width: 16px; height: 16px; border: 2px solid #2f6b47; border-top-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .hidden { display: none; }
    .confidence { background: #e3f1db; display: inline-block; padding: 4px 12px; border-radius: 40px; font-size: 0.7rem; margin: 8px 0; }
    .owner-panel { background: #f0ebe0; border-radius: 20px; padding: 14px; margin-top: 12px; display: none; }
    .owner-panel.visible { display: block; }
    .owner-field { margin-bottom: 10px; }
    .owner-field label { display: block; font-size: 0.8rem; font-weight: bold; margin-bottom: 4px; }
    .owner-field input, .owner-field textarea { width: 100%; padding: 8px; border-radius: 40px; border: 1px solid #c8e0bc; font-size: 0.85rem; }
    .owner-field textarea { border-radius: 20px; resize: vertical; }
    .correction-item { background: white; border-radius: 16px; padding: 8px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
    .delete-correction { background: #b1624b; color: white; border: none; border-radius: 30px; padding: 2px 12px; cursor: pointer; }
    footer { font-size: 0.7rem; text-align: center; padding: 12px; background: #f0f7eb; color: #4a6e3c; border-top: 1px solid #d9efcd; }
    .modal { display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); align-items: center; justify-content: center; z-index: 1000; }
    .modal-content { background: white; padding: 24px; border-radius: 32px; max-width: 300px; text-align: center; }
    .scientific { font-style: italic; margin: 4px 0; color: #2d5a2c; }
    .info-section { margin-top: 10px; background: #eaf5e6; padding: 8px 12px; border-radius: 20px; }
    .treatment-section { background: #fbefdb; padding: 10px; border-radius: 20px; margin-top: 12px; font-size: 0.9rem; }
    .debug-info { font-size: 0.7rem; color: #666; margin-top: 12px; border-top: 1px solid #ddd; padding-top: 8px; }
  </style>
</head>
<body>
<div class="app">
  <header>
    <h1><i class="fas fa-leaf"></i> KWASU SMART FARM AI</h1>
    <div class="mode-selector">
      <button id="modeAuto" class="mode-btn active">🔄 Auto</button>
      <button id="modeOnline" class="mode-btn">🌐 Online</button>
      <button id="modeOffline" class="mode-btn">📴 Offline</button>
      <button id="refreshCorrectionsBtn" class="refresh-btn"><i class="fas fa-sync-alt"></i> Reload</button>
      <button id="ownerLoginBtn" class="owner-btn"><i class="fas fa-lock"></i> Owner</button>
      <button id="logoutBtn" class="logout-btn" style="display:none;"><i class="fas fa-sign-out-alt"></i> Exit</button>
    </div>
  </header>

  <div class="camera-area">
    <div class="video-box">
      <video id="video" autoplay playsinline muted></video>
      <div id="placeholder" class="placeholder">
        <i class="fas fa-camera-slash"></i> Camera off<br>
        <span style="font-size:0.7rem;">Use upload or start camera</span>
      </div>
    </div>
  </div>

  <div class="buttons">
    <button id="startCam" class="primary"><i class="fas fa-play"></i> Start Camera</button>
    <button id="stopCam" disabled><i class="fas fa-stop"></i> Stop</button>
    <button id="captureBtn" disabled><i class="fas fa-camera"></i> Capture & Preview</button>
    <button id="plantBtn" class="primary" disabled><i class="fas fa-seedling"></i> 🌿 Identify Plant</button>
    <button id="diseaseBtn" class="disease-btn" disabled><i class="fas fa-biohazard"></i> 🦠 Disease</button>
    <button id="pestBtn" class="pest-btn" disabled><i class="fas fa-bug"></i> 🐛 Pest</button>
    <label class="file-label" id="uploadLabel"><i class="fas fa-upload"></i> Upload Image</label>
    <input type="file" id="fileInput" accept="image/*" style="display:none">
  </div>

  <div class="preview-area">
    <img id="preview" alt="Preview">
  </div>

  <div class="status">
    <span id="statusMsg">📸 Ready – take/upload a photo, then choose analysis.</span>
    <span id="spinner" class="loader hidden"></span>
    <span id="correctionStats" style="font-size:0.7rem; margin-left:auto;">—</span>
  </div>

  <div class="result" id="resultArea">
    <div id="defaultMsg" class="error-msg">
      <i class="fas fa-info-circle"></i> Take or upload a picture, then click one of the analysis buttons: Plant, Disease, or Pest.
    </div>
    <div id="aiOutput"></div>
  </div>

  <div id="ownerPanel" class="owner-panel">
    <h4><i class="fas fa-crown"></i> Owner Correction (Plants only)</h4>
    <div class="owner-field">
      <label>AI predicted key:</label>
      <input type="text" id="correctionKey" readonly>
    </div>
    <div class="owner-field">
      <label>Correct common name:</label>
      <input type="text" id="commonName" placeholder="e.g. Cowpea">
      <button id="autoFillBtn" class="primary" style="margin-top:5px;"><i class="fas fa-magic"></i> Auto‑fill</button>
    </div>
    <div class="owner-field">
      <label>Scientific name:</label>
      <input type="text" id="scientificName" placeholder="Vigna unguiculata">
    </div>
    <div class="owner-field">
      <label>Family:</label>
      <input type="text" id="familyName" placeholder="Fabaceae">
    </div>
    <div class="owner-field">
      <label>Importance / Uses:</label>
      <textarea id="importance" rows="2" placeholder="Legume crop, rich in protein, drought-tolerant."></textarea>
    </div>
    <div class="owner-field">
      <label><input type="checkbox" id="ownerSure"> ✅ I am sure (100% confidence)</label>
    </div>
    <button id="saveCorrectionBtn" class="primary"><i class="fas fa-save"></i> Save Correction</button>
    <hr>
    <button id="downloadCorrectionsBtn" style="background:#2f6b47; color:white;"><i class="fas fa-download"></i> Download corrections.json</button>
    <div id="correctionsList"></div>
  </div>

  <footer>
    🌿 Identify plants, diseases, pests. Uses PlantNet for plants, Roboflow for disease/pest.
  </footer>
</div>

<div id="passwordModal" class="modal">
  <div class="modal-content">
    <h3><i class="fas fa-key"></i> Owner Access</h3>
    <input type="password" id="ownerPassword" placeholder="Enter password">
    <button id="submitPassword" class="primary">Unlock</button>
  </div>
</div>

<script>
  (function() {
    const CORRECTIONS_URL = 'corrections.json';
    const OWNER_PASSWORD = 'yusupher01';
    let ownerAuthenticated = false;

    // DOM elements
    const video = document.getElementById('video');
    const startCam = document.getElementById('startCam');
    const stopCam = document.getElementById('stopCam');
    const captureBtn = document.getElementById('captureBtn');
    const plantBtn = document.getElementById('plantBtn');
    const diseaseBtn = document.getElementById('diseaseBtn');
    const pestBtn = document.getElementById('pestBtn');
    const fileInput = document.getElementById('fileInput');
    const uploadLabel = document.getElementById('uploadLabel');
    const previewImg = document.getElementById('preview');
    const statusSpan = document.getElementById('statusMsg');
    const spinner = document.getElementById('spinner');
    const defaultMsg = document.getElementById('defaultMsg');
    const aiOutput = document.getElementById('aiOutput');
    const correctionStatsSpan = document.getElementById('correctionStats');
    const refreshBtn = document.getElementById('refreshCorrectionsBtn');
    const ownerLoginBtn = document.getElementById('ownerLoginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const ownerPanel = document.getElementById('ownerPanel');
    const correctionKeyInput = document.getElementById('correctionKey');
    const commonNameInput = document.getElementById('commonName');
    const scientificNameInput = document.getElementById('scientificName');
    const familyNameInput = document.getElementById('familyName');
    const importanceInput = document.getElementById('importance');
    const ownerSureCheckbox = document.getElementById('ownerSure');
    const saveCorrectionBtn = document.getElementById('saveCorrectionBtn');
    const downloadBtn = document.getElementById('downloadCorrectionsBtn');
    const correctionsListDiv = document.getElementById('correctionsList');
    const autoFillBtn = document.getElementById('autoFillBtn');

    let currentStream = null;
    let cameraActive = false;
    let offlineModel = null;
    let offlineReady = false;
    let currentMode = 'auto';
    let globalCorrections = {};
    let pendingCorrections = {};
    let currentImageBlob = null;
    let lastPlantResult = null;
    let lastPredictedKey = '';

    const BACKEND_URL = 'https://plant-backend-avof.onrender.com';
    const DISEASE_URL = BACKEND_URL + '/detect-disease';
    const PEST_URL = BACKEND_URL + '/detect-pest';

    // Plant database (unchanged)
    const plantDatabase = {
      "cowpea": { common: "Cowpea", scientific: "Vigna unguiculata", family: "Fabaceae", importance: "Legume crop, rich in protein, drought-tolerant. Used for human consumption (beans) and animal feed. Fixes nitrogen in soil." },
      "mango": { common: "Mango", scientific: "Mangifera indica", family: "Anacardiaceae", importance: "Tropical fruit tree, sweet fruit rich in vitamins A and C. Source of juice, dried fruit, and chutneys." },
      "cashew": { common: "Cashew", scientific: "Anacardium occidentale", family: "Anacardiaceae", importance: "Produces cashew nuts and cashew apple. Nuts are high in healthy fats; apple used for juice and fermented drinks." },
      "oak": { common: "Oak", scientific: "Quercus robur", family: "Fagaceae", importance: "Deciduous tree, produces acorns. Timber used in furniture and construction. Supports wildlife." },
      "rose": { common: "Rose", scientific: "Rosa spp.", family: "Rosaceae", importance: "Ornamental shrub, fragrant flowers used in perfumes and cosmetics. Rose hips rich in vitamin C." },
      "sunflower": { common: "Sunflower", scientific: "Helianthus annuus", family: "Asteraceae", importance: "Tall annual grown for edible seeds and oil. Seeds are rich in healthy fats and vitamin E." },
      "basil": { common: "Basil", scientific: "Ocimum basilicum", family: "Lamiaceae", importance: "Aromatic herb used in cooking (pesto, salads). Has medicinal properties (anti‑inflammatory)." },
      "tomato": { common: "Tomato", scientific: "Solanum lycopersicum", family: "Solanaceae", importance: "Fruit vegetable, rich in lycopene and vitamin C. Used in salads, sauces, and juices worldwide." },
      "maize": { common: "Maize", scientific: "Zea mays", family: "Poaceae", importance: "Cereal grain, staple food in many regions. Used for flour, oil, biofuel, and animal feed." },
      "rice": { common: "Rice", scientific: "Oryza sativa", family: "Poaceae", importance: "Staple cereal grain, feeds half the world. Source of carbohydrates, used in thousands of dishes." }
    };

    function autoFill(targetCommon, targetSci, targetFamily, targetImportance) {
      const raw = targetCommon.value.trim().toLowerCase();
      if (plantDatabase[raw]) {
        const p = plantDatabase[raw];
        targetSci.value = p.scientific;
        targetFamily.value = p.family;
        targetImportance.value = p.importance;
        setStatus(`✅ Auto-filled: ${p.common}`, false);
      } else {
        setStatus(`❌ No database entry for "${raw}"`, false);
      }
    }
    autoFillBtn.addEventListener('click', () => {
      autoFill(commonNameInput, scientificNameInput, familyNameInput, importanceInput);
    });

    // Mode buttons
    const modeAuto = document.getElementById('modeAuto');
    const modeOnline = document.getElementById('modeOnline');
    const modeOffline = document.getElementById('modeOffline');
    function setActiveMode(mode) {
      modeAuto.classList.remove('active');
      modeOnline.classList.remove('active');
      modeOffline.classList.remove('active');
      if (mode === 'auto') modeAuto.classList.add('active');
      else if (mode === 'online') modeOnline.classList.add('active');
      else if (mode === 'offline') modeOffline.classList.add('active');
      currentMode = mode;
    }
    modeAuto.addEventListener('click', () => setActiveMode('auto'));
    modeOnline.addEventListener('click', () => setActiveMode('online'));
    modeOffline.addEventListener('click', () => setActiveMode('offline'));

    function setStatus(msg, loading = false) {
      statusSpan.innerText = msg;
      if (loading) spinner.classList.remove('hidden');
      else spinner.classList.add('hidden');
    }

    // Correction handling (unchanged)
    function getAllCorrections() { return { ...globalCorrections, ...pendingCorrections }; }
    function addPendingCorrection(key, common, scientific, family, importance, ownerSure) {
      if (!key || !common) return false;
      const normalizedKey = key.toLowerCase().trim();
      pendingCorrections[normalizedKey] = {
        name: common.trim(),
        scientific: scientific.trim() || '',
        family: family.trim() || '',
        importance: importance.trim() || '',
        ownerSure: ownerSure || false
      };
      setStatus(`✅ Correction added (pending)`, false);
      updateCorrectionUI();
      return true;
    }
    function removePendingCorrection(key) {
      const normalizedKey = key.toLowerCase().trim();
      if (pendingCorrections[normalizedKey]) {
        delete pendingCorrections[normalizedKey];
        setStatus(`🗑️ Removed pending correction`, false);
        updateCorrectionUI();
        return true;
      }
      return false;
    }
    function applyBestCorrection(result, predictedKey) {
      if (!predictedKey) return result;
      const key = predictedKey.toLowerCase().trim();
      const all = getAllCorrections();
      if (all[key]) {
        const c = all[key];
        result.name = c.name || result.name;
        result.scientific = c.scientific || result.scientific;
        result.family = c.family || result.family;
        result.importance = c.importance || '';
        if (c.ownerSure === true) result.confidence = '100';
        result.correctionNote = `✨ Correction: "${key}" → "${c.name}"`;
        result.appliedCorrectionKey = key;
      }
      return result;
    }
    async function loadGlobalCorrections(showMessage = true) {
      setStatus("Fetching corrections...", true);
      try {
        const response = await fetch(CORRECTIONS_URL + '?t=' + Date.now());
        if (response.ok) {
          const data = await response.json();
          if (typeof data === 'object') {
            globalCorrections = data;
            pendingCorrections = {};
            if (showMessage) setStatus(`✅ Loaded ${Object.keys(globalCorrections).length} corrections.`, false);
            updateCorrectionUI();
            return true;
          }
        }
        throw new Error();
      } catch(e) {
        globalCorrections = {};
        if (showMessage) setStatus(`⚠️ No corrections file.`, false);
        updateCorrectionUI();
        return false;
      }
    }
    function downloadCorrectionsFile() {
      const merged = getAllCorrections();
      const dataStr = JSON.stringify(merged, null, 2);
      const blob = new Blob([dataStr], {type: 'application/json'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'corrections.json';
      a.click();
      URL.revokeObjectURL(blob);
      setStatus("Downloaded corrections.json", false);
    }
    function updateCorrectionUI() {
      const pendingCount = Object.keys(pendingCorrections).length;
      const globalCount = Object.keys(globalCorrections).length;
      correctionStatsSpan.innerHTML = `${globalCount + pendingCount} total`;
      renderCorrectionsList();
    }
    function renderCorrectionsList() {
      if (!correctionsListDiv) return;
      const all = getAllCorrections();
      const entries = Object.entries(all);
      if (entries.length === 0) {
        correctionsListDiv.innerHTML = '<i>No corrections yet.</i>';
        return;
      }
      correctionsListDiv.innerHTML = '';
      for (const [key, val] of entries) {
        const isPending = !!pendingCorrections[key];
        const div = document.createElement('div');
        div.className = 'correction-item';
        div.innerHTML = `
          <div><span class="correction-key">${escapeHtml(key)}</span> → <span class="correction-value">${escapeHtml(val.name)}</span> ${isPending ? '<span style="background:#f4a261; color:black; padding:2px 6px; border-radius:40px;">pending</span>' : ''}</div>
          ${ownerAuthenticated ? `<button class="delete-correction" data-key="${escapeHtml(key)}"><i class="fas fa-trash"></i> Delete</button>` : ''}
        `;
        if (ownerAuthenticated) {
          const delBtn = div.querySelector('.delete-correction');
          delBtn.addEventListener('click', () => {
            if (pendingCorrections[key]) removePendingCorrection(key);
            else setStatus(`Global correction can only be removed by editing corrections.json.`, false);
          });
        }
        correctionsListDiv.appendChild(div);
      }
    }

    // Helper
    function blobToImage(blob) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = URL.createObjectURL(blob);
      });
    }

    // ----- PLANT IDENTIFICATION (unchanged) -----
    async function identifyPlant() {
      if (!currentImageBlob) {
        alert("Please take or upload a picture first.");
        return;
      }
      setStatus("🌿 Identifying plant...", true);
      defaultMsg.classList.add('hidden');
      
      let result = null;
      if (currentMode === 'online') result = await identifyWithBackend(currentImageBlob);
      else if (currentMode === 'offline') {
        const img = await blobToImage(currentImageBlob);
        result = await classifyOffline(img);
      } else {
        result = await identifyWithBackend(currentImageBlob);
        if (!result && offlineReady) {
          const img = await blobToImage(currentImageBlob);
          result = await classifyOffline(img);
        }
      }
      
      if (result && result.originalPredictedLabel) {
        result = applyBestCorrection(result, result.originalPredictedLabel);
        lastPredictedKey = result.originalPredictedLabel;
        lastPlantResult = result;
        displayPlantResult(result, result.originalPredictedLabel);
        setStatus(`✅ Plant: ${result.name} (${result.confidence}%)`, false);
      } else if (result && result.name) {
        lastPlantResult = result;
        displayPlantResult(result, null);
        setStatus(`✅ Plant: ${result.name} (${result.confidence}%)`, false);
      } else {
        aiOutput.innerHTML = `<div class="error-msg">❌ No plant identified. Try a clearer image.</div>`;
        setStatus("No plant found", false);
      }
    }

    async function identifyWithBackend(imageBlob) {
      const formData = new FormData();
      formData.append('image', imageBlob);
      try {
        const response = await fetch(BACKEND_URL + '/identify', { method: 'POST', body: formData });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (data.results && data.results.length > 0) {
          const best = data.results[0];
          const commonName = best.species.commonNames?.[0] || '';
          const scientificName = best.species.scientificNameWithoutAuthor || '';
          const confidence = (best.score * 100).toFixed(1);
          const rawLabel = scientificName || commonName || best.species.id;
          return {
            name: commonName || scientificName,
            scientific: scientificName,
            confidence: confidence,
            family: '?',
            importance: '',
            originalPredictedLabel: rawLabel
          };
        }
        return null;
      } catch(e) { return null; }
    }

    const offlinePlantMap = [
      { patterns: ['mango', 'mangifera'], name: 'Mango', scientific: 'Mangifera indica', family: 'Anacardiaceae', importance: "Tropical fruit tree, rich in vitamins A and C." },
      { patterns: ['oak', 'quercus'], name: 'Oak', scientific: 'Quercus', family: 'Fagaceae', importance: "Hardwood timber, acorns feed wildlife." },
      { patterns: ['sunflower', 'helianthus'], name: 'Sunflower', scientific: 'Helianthus annuus', family: 'Asteraceae', importance: "Edible seeds and oil, rich in vitamin E." },
      { patterns: ['rose', 'rosa'], name: 'Rose', scientific: 'Rosa', family: 'Rosaceae', importance: "Fragrant flowers, used in perfumes and teas." }
    ];
    function matchOffline(label) {
      const lower = label.toLowerCase();
      for (let p of offlinePlantMap) if (p.patterns.some(pat => lower.includes(pat))) return p;
      let generic = label.split(',')[0].replace(/_/g,' ');
      generic = generic.replace(/(^\w|\s\w)/g, c=>c.toUpperCase());
      return { name: generic, scientific: '—', family: 'Unknown', importance: '' };
    }
    async function classifyOffline(imgElement) {
      if (!offlineModel) return null;
      try {
        const tensor = tf.browser.fromPixels(imgElement).resizeNearestNeighbor([224,224]).toFloat();
        const expanded = tensor.expandDims(0);
        const preds = await offlineModel.classify(expanded);
        tensor.dispose(); expanded.dispose();
        if (preds && preds[0]) {
          const plant = matchOffline(preds[0].className);
          return {
            name: plant.name,
            scientific: plant.scientific,
            confidence: (preds[0].probability*100).toFixed(1),
            family: plant.family,
            importance: plant.importance || '',
            originalPredictedLabel: preds[0].className
          };
        }
        return null;
      } catch(e) { return null; }
    }

    function displayPlantResult(result, predictedKey) {
      if ((!result.importance || result.importance === '') && result.name) {
        const dbMatch = plantDatabase[result.name.toLowerCase()];
        if (dbMatch) {
          result.family = dbMatch.family;
          result.importance = dbMatch.importance;
        }
      }
      let importanceHtml = result.importance ? `<div class="info-section"><i class="fas fa-info-circle"></i> <strong>Importance / Uses:</strong><br>${escapeHtml(result.importance)}</div>` : '';
      aiOutput.innerHTML = `
        <div class="plant-card">
          <div><strong>${escapeHtml(result.name)}</strong></div>
          <div class="scientific">${escapeHtml(result.scientific || '')}</div>
          <div class="confidence">🎯 Confidence: ${result.confidence}%</div>
          <div>🌿 Family: ${escapeHtml(result.family)}</div>
          ${importanceHtml}
          ${result.correctionNote ? `<div style="font-size:0.7rem; margin-top:8px; color:#2d6a4f;">${escapeHtml(result.correctionNote)}</div>` : ''}
        </div>
      `;
      if (ownerAuthenticated && predictedKey) {
        const btnDiv = document.createElement('div');
        btnDiv.style.marginTop = '8px';
        const editBtn = document.createElement('button');
        editBtn.className = 'primary';
        editBtn.style.background = '#2f6b47';
        editBtn.innerHTML = '<i class="fas fa-edit"></i> Owner: Correct this';
        editBtn.onclick = () => {
          correctionKeyInput.value = predictedKey;
          const dbEntry = plantDatabase[predictedKey.toLowerCase()];
          if (dbEntry) {
            commonNameInput.value = dbEntry.common;
            scientificNameInput.value = dbEntry.scientific;
            familyNameInput.value = dbEntry.family;
            importanceInput.value = dbEntry.importance;
          } else {
            commonNameInput.value = result.name;
            scientificNameInput.value = result.scientific || '';
            familyNameInput.value = result.family || '';
            importanceInput.value = result.importance || '';
          }
          ownerSureCheckbox.checked = false;
          ownerPanel.classList.add('visible');
          ownerPanel.scrollIntoView({ behavior: 'smooth' });
        };
        btnDiv.appendChild(editBtn);
        aiOutput.appendChild(btnDiv);
      }
    }

    // ----- ENHANCED DISEASE DETECTION (clear feedback) -----
    async function detectDisease() {
      if (!currentImageBlob) {
        alert("Please take or upload a picture first.");
        return;
      }
      setStatus("🦠 Analyzing disease...", true);
      defaultMsg.classList.add('hidden');
      const formData = new FormData();
      formData.append('image', currentImageBlob);
      try {
        const res = await fetch(DISEASE_URL, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        let diseaseResult = data.result || "Unknown result";
        let confidence = (data.confidence !== undefined && data.confidence !== null) ? 
                         (typeof data.confidence === 'number' ? (data.confidence * 100).toFixed(1) + '%' : data.confidence + '%') : "N/A";
        const isHealthy = (data.confidence === 0) || (diseaseResult.toLowerCase().includes("healthy"));
        let displayTitle = isHealthy ? "🌱 Health Status" : "🦠 Disease Diagnosed";
        let icon = isHealthy ? "fa-seedling" : "fa-biohazard";
        let advice = isHealthy ? "Your plant appears healthy. Keep monitoring for early signs." : "Consult an agronomist for proper treatment. Remove infected parts and apply recommended fungicides.";
        aiOutput.innerHTML = `
          <div class="disease-card">
            <div><strong><i class="fas ${icon}"></i> ${displayTitle}: ${escapeHtml(diseaseResult)}</strong></div>
            <div class="confidence">🎯 Confidence: ${confidence}</div>
            <div class="treatment-section"><i class="fas fa-flask"></i> <strong>Suggestion:</strong><br>${advice}</div>
          </div>
        `;
        setStatus(`Disease result: ${diseaseResult} (${confidence})`, false);
      } catch(e) {
        aiOutput.innerHTML = `<div class="error-msg">❌ Disease detection failed. Check network or try again.</div>`;
        setStatus("Disease API error", false);
      }
    }

    // ----- ENHANCED PEST DETECTION (with detailed feedback and debug) -----
    async function detectPest() {
      if (!currentImageBlob) {
        alert("Please take or upload a picture first.");
        return;
      }
      setStatus("🐛 Detecting pest...", true);
      defaultMsg.classList.add('hidden');
      const formData = new FormData();
      formData.append('image', currentImageBlob);
      try {
        const res = await fetch(PEST_URL, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        
        // Extract result and confidence (backend returns { result, confidence })
        let pestResult = data.result || "No pest detected";
        let confidenceRaw = data.confidence;
        let confidenceDisplay = "N/A";
        if (confidenceRaw !== undefined && confidenceRaw !== null) {
          if (typeof confidenceRaw === 'number') {
            confidenceDisplay = (confidenceRaw * 100).toFixed(1) + '%';
          } else {
            confidenceDisplay = confidenceRaw + (confidenceRaw.toString().includes('%') ? '' : '%');
          }
        }
        
        const isNoPest = (confidenceRaw === 0) || (pestResult.toLowerCase().includes("no pest") || pestResult.toLowerCase().includes("healthy"));
        let displayTitle = isNoPest ? "✅ Pest Check" : "🐛 Pest Identified";
        let icon = isNoPest ? "fa-check-circle" : "fa-bug";
        let advice = isNoPest ? "No pest detected. Maintain good field hygiene." : "Apply neem oil, introduce beneficial insects, or use appropriate pesticide. Remove heavily infested parts.";
        
        // Additional helpful message if confidence is low but not zero
        let lowConfidenceNote = "";
        if (!isNoPest && confidenceRaw && confidenceRaw < 0.5) {
          lowConfidenceNote = `<div class="info-section"><i class="fas fa-exclamation-triangle"></i> <strong>Low confidence</strong> – try a clearer, closer image of the pest.</div>`;
        }
        
        aiOutput.innerHTML = `
          <div class="pest-card">
            <div><strong><i class="fas ${icon}"></i> ${displayTitle}: ${escapeHtml(pestResult)}</strong></div>
            <div class="confidence">🎯 Confidence: ${confidenceDisplay}</div>
            <div class="treatment-section"><i class="fas fa-shield-alt"></i> <strong>Recommendation:</strong><br>${advice}</div>
            ${lowConfidenceNote}
            <div class="debug-info"><i class="fas fa-info-circle"></i> Tip: Ensure pest is clearly visible, well-lit, and centered. Multiple angles may help.</div>
          </div>
        `;
        setStatus(`Pest result: ${pestResult} (${confidenceDisplay})`, false);
      } catch(e) {
        console.error("Pest detection error:", e);
        aiOutput.innerHTML = `<div class="error-msg">❌ Pest detection failed: ${e.message}. Make sure you are online and the backend is reachable.</div>`;
        setStatus("Pest API error", false);
      }
    }

    // ----- Capture & Upload -----
    async function captureAndStore() {
      if (!cameraActive || !video.videoWidth) {
        setStatus("Start camera first", false);
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.9));
      const url = URL.createObjectURL(blob);
      previewImg.src = url;
      previewImg.style.display = 'block';
      previewImg.onload = () => URL.revokeObjectURL(url);
      currentImageBlob = blob;
      enableAnalysisButtons(true);
      setStatus("📸 Image captured. Choose analysis button (Plant, Disease, Pest).", false);
      aiOutput.innerHTML = '';
      defaultMsg.classList.remove('hidden');
    }

    function handleUpload(file) {
      if (!file) return;
      const url = URL.createObjectURL(file);
      previewImg.src = url;
      previewImg.style.display = 'block';
      previewImg.onload = () => URL.revokeObjectURL(url);
      currentImageBlob = file;
      enableAnalysisButtons(true);
      setStatus("📷 Image uploaded. Choose analysis button.", false);
      aiOutput.innerHTML = '';
      defaultMsg.classList.remove('hidden');
    }

    function enableAnalysisButtons(enabled) {
      plantBtn.disabled = !enabled;
      diseaseBtn.disabled = !enabled;
      pestBtn.disabled = !enabled;
    }

    // Camera logic
    async function startCamera() {
      if (currentStream) await stopCamera();
      setStatus("Requesting camera...", true);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        currentStream = stream;
        video.srcObject = stream;
        await video.play();
        await new Promise(r => video.videoWidth > 0 ? r() : (video.onloadedmetadata = r));
        cameraActive = true;
        updateUICamera();
        setStatus(`Camera ready. Use "Capture & Preview" then choose analysis.`, false);
      } catch(e) {
        cameraActive = false;
        updateUICamera();
        setStatus("Camera permission denied. Use upload.", false);
      }
    }
    async function stopCamera() {
      if (currentStream) {
        currentStream.getTracks().forEach(t => t.stop());
        currentStream = null;
      }
      video.srcObject = null;
      cameraActive = false;
      updateUICamera();
      setStatus("Camera stopped.", false);
    }
    function updateUICamera() {
      if (cameraActive && currentStream && video.srcObject) {
        video.classList.remove('hidden');
        document.getElementById('placeholder').classList.add('hidden');
        startCam.disabled = true;
        stopCam.disabled = false;
        captureBtn.disabled = false;
      } else {
        video.classList.add('hidden');
        document.getElementById('placeholder').classList.remove('hidden');
        startCam.disabled = false;
        stopCam.disabled = true;
        captureBtn.disabled = true;
      }
    }

    function escapeHtml(str) { if (!str) return ''; return str.replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m])); }
    
    // Owner authentication
    const modal = document.getElementById('passwordModal');
    const passwordInput = document.getElementById('ownerPassword');
    const submitPassword = document.getElementById('submitPassword');
    function showPasswordModal() { modal.style.display = 'flex'; }
    function hideModal() { modal.style.display = 'none'; }
    function setOwnerMode(active) {
      ownerAuthenticated = active;
      if (active) {
        ownerPanel.classList.add('visible');
        ownerLoginBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        setStatus("🔓 Owner mode", false);
      } else {
        ownerPanel.classList.remove('visible');
        ownerLoginBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
        setStatus("User mode", false);
      }
    }
    submitPassword.addEventListener('click', () => {
      if (passwordInput.value === OWNER_PASSWORD) {
        setOwnerMode(true);
        hideModal();
        passwordInput.value = '';
      } else alert("Wrong password");
    });
    ownerLoginBtn.addEventListener('click', showPasswordModal);
    logoutBtn.addEventListener('click', () => { setOwnerMode(false); });
    modal.addEventListener('click', (e) => { if (e.target === modal) hideModal(); });

    saveCorrectionBtn.addEventListener('click', () => {
      const key = correctionKeyInput.value.trim();
      const common = commonNameInput.value.trim();
      if (!key || !common) { alert("Enter predicted key and common name"); return; }
      addPendingCorrection(key, common, scientificNameInput.value.trim(), familyNameInput.value.trim(), importanceInput.value.trim(), ownerSureCheckbox.checked);
      commonNameInput.value = '';
      scientificNameInput.value = '';
      familyNameInput.value = '';
      importanceInput.value = '';
      ownerSureCheckbox.checked = false;
      correctionKeyInput.value = '';
      if (lastPlantResult && lastPredictedKey) {
        const newResult = { ...lastPlantResult };
        applyBestCorrection(newResult, lastPredictedKey);
        displayPlantResult(newResult, lastPredictedKey);
      }
    });
    downloadBtn.addEventListener('click', downloadCorrectionsFile);

    // Event listeners
    startCam.addEventListener('click', startCamera);
    stopCam.addEventListener('click', stopCamera);
    captureBtn.addEventListener('click', captureAndStore);
    plantBtn.addEventListener('click', identifyPlant);
    diseaseBtn.addEventListener('click', detectDisease);
    pestBtn.addEventListener('click', detectPest);
    uploadLabel.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => { if (e.target.files[0]) handleUpload(e.target.files[0]); fileInput.value = ''; });
    refreshBtn.addEventListener('click', () => loadGlobalCorrections(true).then(() => { if (currentImageBlob) identifyPlant(); }));

    // Initialize
    loadGlobalCorrections(true).then(() => {
      loadOfflineModel();
      setStatus("✅ Ready. Capture or upload an image, then select Plant / Disease / Pest.", false);
    });
    async function loadOfflineModel() {
      try {
        offlineModel = await mobilenet.load({ version: 2, alpha: 1.0 });
        offlineReady = true;
      } catch(e) { offlineReady = false; }
    }
  })();
</script>
</body>
</html>
