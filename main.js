import html2canvas from 'html2canvas';

// === Sections ===
const landingSection = document.getElementById('landingSection');
const promptSection = document.getElementById('promptSection');
const writeSection = document.getElementById('writeSection');
const loadingSection = document.getElementById('loadingSection');
const feedbackSection = document.getElementById('feedbackSection');
const errorSection = document.getElementById('errorSection');
const allSections = [landingSection, promptSection, writeSection, loadingSection, feedbackSection, errorSection];

// === State ===
let promptsData = null;
let selectedPrompt = null;
let selectedVocab = [];
let writeTimerInterval = null;
let writeSeconds = 0;
let lastFeedbackData = null;
let lastCanvas = null;

// === Navigation ===
function showStep(section) {
  allSections.forEach(s => { s.hidden = true; });
  section.hidden = false;
  window.scrollTo(0, 0);
}

// === Landing ===
document.getElementById('startBtn').addEventListener('click', () => {
  showStep(promptSection);
  loadPrompts();
});

// === Prompt Selection ===
document.getElementById('backToLanding').addEventListener('click', () => showStep(landingSection));

const promptTabs = document.querySelectorAll('.prompt-tab');
const promptList = document.getElementById('promptList');
const promptLoading = document.getElementById('promptLoading');
let currentCategory = 'reflect';

promptTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    promptTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentCategory = tab.dataset.category;
    renderPrompts();
  });
});

async function loadPrompts() {
  if (promptsData) {
    promptLoading.hidden = true;
    promptList.hidden = false;
    renderPrompts();
    return;
  }

  promptLoading.hidden = false;
  promptList.hidden = true;

  try {
    const res = await fetch('/api/prompt');
    if (!res.ok) throw new Error('Failed to load prompts');
    promptsData = await res.json();
  } catch {
    // Use inline fallback
    promptsData = {
      reflect: [
        { prompt: 'What is something new you learned this week? How did it make you feel?', vocab: ['fascinating', 'discover', 'perspective', 'realize'] },
        { prompt: 'Describe a person who has influenced your life. What did they teach you?', vocab: ['inspire', 'grateful', 'wisdom', 'role model'] },
      ],
      world: [
        { prompt: 'Technology is changing how people communicate around the world. Do you think this is mostly positive or negative? Why?', vocab: ['connection', 'interact', 'social media', 'meaningful'], source: 'General' },
        { prompt: 'Think about a news story you heard recently. What happened and what is your opinion?', vocab: ['headline', 'significant', 'impact', 'debate'], source: 'General' },
      ],
      random: [
        { prompt: 'If you could wake up tomorrow with one new skill, what would it be and why?', vocab: ['master', 'ambitious', 'transform', 'passion'] },
      ],
    };
  } finally {
    promptLoading.hidden = true;
    promptList.hidden = false;
    renderPrompts();
  }
}

function renderPrompts() {
  if (!promptsData) return;
  const items = promptsData[currentCategory] || [];
  promptList.innerHTML = items.map((item, i) => `
    <div class="prompt-card" data-index="${i}">
      <p class="prompt-card-text">${item.prompt}</p>
      ${item.source ? `<span class="prompt-source">${item.source}</span>` : ''}
      <div class="prompt-vocab-preview">
        ${item.vocab.map(v => `<span class="vocab-chip">${v}</span>`).join('')}
      </div>
    </div>
  `).join('');

  // Attach click handlers
  promptList.querySelectorAll('.prompt-card').forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.index);
      const item = items[idx];
      selectedPrompt = item.prompt;
      selectedVocab = item.vocab || [];
      goToWrite();
    });
  });
}

// Free write
document.getElementById('freeWriteBtn').addEventListener('click', () => {
  selectedPrompt = null;
  selectedVocab = [];
  goToWrite();
});

function goToWrite() {
  showStep(writeSection);

  // Show selected prompt
  const sp = document.getElementById('selectedPrompt');
  if (selectedPrompt) {
    document.getElementById('selectedPromptText').textContent = selectedPrompt;
    sp.hidden = false;
  } else {
    sp.hidden = true;
  }

  // Show vocab panel
  const vp = document.getElementById('vocabPanel');
  const vl = document.getElementById('vocabList');
  if (selectedVocab.length > 0) {
    vl.innerHTML = selectedVocab.map(v => `<span class="vocab-chip vocab-chip-write">${v}</span>`).join('');
    vp.hidden = false;
  } else {
    vp.hidden = true;
  }

  // Start write timer
  writeSeconds = 0;
  updateWriteTimer();
  clearInterval(writeTimerInterval);
  writeTimerInterval = setInterval(() => {
    writeSeconds++;
    updateWriteTimer();
  }, 1000);

  document.getElementById('journalInput').focus();
}

// === Writing Section ===
document.getElementById('backToPrompts').addEventListener('click', () => {
  clearInterval(writeTimerInterval);
  showStep(promptSection);
});

const journalInput = document.getElementById('journalInput');
const wordCountEl = document.getElementById('wordCount');

journalInput.addEventListener('input', () => {
  const words = journalInput.value.trim().split(/\s+/).filter(Boolean).length;
  wordCountEl.textContent = `${words} word${words !== 1 ? 's' : ''}`;
});

function updateWriteTimer() {
  const m = Math.floor(writeSeconds / 60);
  const s = writeSeconds % 60;
  document.getElementById('writeTimer').textContent = `${m}:${s.toString().padStart(2, '0')}`;
}

// Vocab toggle
document.getElementById('vocabToggle').addEventListener('click', () => {
  const vl = document.getElementById('vocabList');
  const btn = document.getElementById('vocabToggle');
  vl.hidden = !vl.hidden;
  btn.textContent = vl.hidden ? '▶' : '▼';
});

// === Native Language Lifeline ===
document.getElementById('lifelineToggle').addEventListener('click', () => {
  const panel = document.getElementById('lifelinePanel');
  panel.hidden = !panel.hidden;
});

document.getElementById('lifelineHelpBtn').addEventListener('click', async () => {
  const nativeInput = document.getElementById('nativeInput');
  const nativeLang = document.getElementById('nativeLang').value;
  const text = nativeInput.value.trim();
  if (!text) return;

  const btn = document.getElementById('lifelineHelpBtn');
  btn.disabled = true;
  btn.textContent = '...';

  try {
    const res = await fetch('/api/assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nativeText: text, nativeLang }),
    });

    if (!res.ok) throw new Error('Failed');
    const data = await res.json();

    // Render result card
    const resultsEl = document.getElementById('lifelineResults');
    const card = document.createElement('div');
    card.className = 'lifeline-card';
    card.innerHTML = `
      <button class="lifeline-card-close" aria-label="Dismiss">×</button>
      <p class="lifeline-native">"${text}"</p>
      <p class="lifeline-english">${data.english}</p>
      <p class="lifeline-explanation">${data.explanation}</p>
      ${data.keyWords ? `<div class="lifeline-keywords">
        ${data.keyWords.map(k => `<span class="vocab-chip" title="${k.meaning}">${k.word}</span>`).join('')}
      </div>` : ''}
      <p class="lifeline-reminder">👆 Now type this sentence in your journal!</p>
    `;
    card.querySelector('.lifeline-card-close').addEventListener('click', () => card.remove());
    resultsEl.prepend(card);
    nativeInput.value = '';
  } catch {
    alert('Could not translate. Please try again.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Help me';
  }
});

// === Submit Journal ===
document.getElementById('submitJournalBtn').addEventListener('click', async () => {
  const text = journalInput.value.trim();
  if (!text) return;
  if (text.length < 10) {
    showError('Please write at least a few words to get feedback.');
    return;
  }

  clearInterval(writeTimerInterval);
  showStep(loadingSection);

  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, prompt: selectedPrompt || '' }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Server error (${res.status})`);
    }

    const data = await res.json();
    lastFeedbackData = data;
    renderFeedback(data);
  } catch (err) {
    showError(err.message || 'Something went wrong. Please try again.');
  }
});

// === Render Feedback ===
function getScoreTier(score) {
  if (score >= 85) return 'score-great';
  if (score >= 70) return 'score-high';
  if (score >= 50) return 'score-mid';
  return 'score-low';
}

function renderFeedback(data) {
  const scores = data.scores || {};
  const overall = typeof scores.overall === 'number' ? scores.overall : 0;

  // Well done
  document.getElementById('wellDoneText').textContent = data.wellDone || 'Great job writing today!';

  // Score circle
  document.getElementById('scoreNumber').textContent = overall;
  document.getElementById('scoreLabel').textContent = data.scoreLabel || '';
  document.getElementById('scoreCircle').className = 'score-circle ' + getScoreTier(overall);

  // Sub-scores
  const dims = [
    { key: 'grammar', bar: 'grammarBar', val: 'grammarValue' },
    { key: 'vocabulary', bar: 'vocabBar', val: 'vocabValue' },
    { key: 'coherence', bar: 'coherenceBar', val: 'coherenceValue' },
    { key: 'expression', bar: 'expressionBar', val: 'expressionValue' },
  ];
  dims.forEach(d => {
    const v = typeof scores[d.key] === 'number' ? scores[d.key] : 0;
    document.getElementById(d.bar).style.width = `${v}%`;
    document.getElementById(d.bar).className = `sub-score-bar ${getScoreTier(v)}`;
    document.getElementById(d.val).textContent = v;
  });

  // Word count
  document.getElementById('feedbackWordCount').textContent = data.wordCount || 0;

  // Fixes
  const fix1 = data.fixes?.[0];
  if (fix1) {
    document.getElementById('fix1Title').textContent = fix1.title;
    document.getElementById('fix1Original').textContent = fix1.original || '';
    document.getElementById('fix1Fix').textContent = fix1.fix;
    document.getElementById('fix1Note').textContent = fix1.note;
  }

  const fix2 = data.fixes?.[1];
  if (fix2) {
    document.getElementById('fix2Title').textContent = fix2.title;
    document.getElementById('fix2Original').textContent = fix2.original || '';
    document.getElementById('fix2Fix').textContent = fix2.fix;
    document.getElementById('fix2Note').textContent = fix2.note;
    document.getElementById('fix2Card').hidden = false;
  } else {
    document.getElementById('fix2Card').hidden = true;
  }

  // Upgrade
  const upgrade = data.upgrade;
  if (upgrade) {
    document.getElementById('upgradeTitle').textContent = upgrade.title;
    document.getElementById('upgradeOriginal').textContent = upgrade.original || '';
    document.getElementById('upgradeFix').textContent = upgrade.fix;
    document.getElementById('upgradeNote').textContent = upgrade.note;
  }

  // Rewrite challenge
  const rc = data.rewriteChallenge;
  if (rc) {
    document.getElementById('rewriteOriginal').textContent = rc.original;
    document.getElementById('rewriteHintText').textContent = rc.hint || '';
    document.getElementById('rewriteAnswer').textContent = rc.improved || '';
    document.getElementById('rewriteInput').value = '';
    document.getElementById('rewriteHint').hidden = true;
    document.getElementById('rewriteCard').hidden = false;
  } else {
    document.getElementById('rewriteCard').hidden = true;
  }

  showStep(feedbackSection);
}

// Rewrite hint
document.getElementById('showHintBtn').addEventListener('click', () => {
  document.getElementById('rewriteHint').hidden = false;
});

// === Error ===
function showError(message) {
  document.getElementById('errorText').textContent = message;
  showStep(errorSection);
}

document.getElementById('errorResetBtn').addEventListener('click', () => {
  showStep(writeSection);
  writeTimerInterval = setInterval(() => {
    writeSeconds++;
    updateWriteTimer();
  }, 1000);
});

// === Write Again ===
document.getElementById('writeAgainBtn').addEventListener('click', () => {
  journalInput.value = '';
  wordCountEl.textContent = '0 words';
  selectedPrompt = null;
  selectedVocab = [];
  document.getElementById('lifelineResults').innerHTML = '';
  document.getElementById('lifelinePanel').hidden = true;
  lastFeedbackData = null;
  showStep(promptSection);
});

// === Share ===
const shareModal = document.getElementById('shareModal');
const sharePreviewImg = document.getElementById('sharePreviewImg');
const sharePreviewSpinner = document.getElementById('sharePreviewSpinner');
const shareConfirm = document.getElementById('shareConfirm');

document.getElementById('shareBtn').addEventListener('click', async () => {
  if (!lastFeedbackData) return;
  shareConfirm.hidden = true;
  sharePreviewImg.hidden = true;
  sharePreviewSpinner.hidden = false;
  sharePreviewSpinner.textContent = '⏳ Generating preview...';
  shareModal.hidden = false;

  try {
    populateShareCard(lastFeedbackData);
    lastCanvas = await generateShareImage();
    sharePreviewImg.src = lastCanvas.toDataURL('image/png');
    sharePreviewImg.hidden = false;
    sharePreviewSpinner.hidden = true;
  } catch {
    sharePreviewSpinner.textContent = '❌ Could not generate preview.';
  }
});

document.getElementById('modalCloseBtn').addEventListener('click', () => { shareModal.hidden = true; });
shareModal.addEventListener('click', (e) => {
  if (e.target === shareModal) shareModal.hidden = true;
});

// Copy image
document.getElementById('copyImgBtn').addEventListener('click', async () => {
  if (!lastCanvas) return;
  try {
    await new Promise((resolve, reject) => {
      lastCanvas.toBlob(async (blob) => {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          resolve();
        } catch (e) { reject(e); }
      }, 'image/png');
    });
    showShareConfirm('✅ Image copied! Paste it in the community 🎉');
  } catch {
    showShareConfirm('❌ Copy not supported. Use Download instead.');
  }
});

// Download image
document.getElementById('downloadImgBtn').addEventListener('click', () => {
  if (!lastCanvas) return;
  const url = lastCanvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dailypen-progress.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showShareConfirm('📥 Image saved!');
});

// Copy journal text
document.getElementById('copyJournalBtn').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(journalInput.value);
    showShareConfirm('📝 Journal text copied!');
  } catch {
    showShareConfirm('❌ Could not copy text.');
  }
});

function showShareConfirm(msg) {
  shareConfirm.textContent = msg;
  shareConfirm.hidden = false;
  setTimeout(() => { shareConfirm.hidden = true; }, 4000);
}

// === Share Card ===
function populateShareCard(data) {
  const scores = data.scores || {};
  const overall = typeof scores.overall === 'number' ? scores.overall : 0;

  document.getElementById('scScoreNumber').textContent = overall;
  document.getElementById('scScoreLabel').textContent = data.scoreLabel || '';
  document.getElementById('scScoreCircle').className = 'sc-score-circle ' + getScoreTier(overall);

  const dims = [
    { key: 'grammar', bar: 'scGrammarBar', val: 'scGrammarValue' },
    { key: 'vocabulary', bar: 'scVocabBar', val: 'scVocabValue' },
    { key: 'coherence', bar: 'scCoherenceBar', val: 'scCoherenceValue' },
    { key: 'expression', bar: 'scExpressionBar', val: 'scExpressionValue' },
  ];
  dims.forEach(d => {
    const v = typeof scores[d.key] === 'number' ? scores[d.key] : 0;
    document.getElementById(d.bar).style.width = `${v}%`;
    document.getElementById(d.bar).className = `sc-sub-bar ${getScoreTier(v)}`;
    document.getElementById(d.val).textContent = v;
  });

  document.getElementById('scWordCount').textContent = `📝 ${data.wordCount || 0} words`;
  document.getElementById('scPromptTopic').textContent = selectedPrompt
    ? selectedPrompt.substring(0, 60) + (selectedPrompt.length > 60 ? '...' : '')
    : 'Free writing';
}

async function generateShareImage() {
  const shareCard = document.getElementById('shareCard');
  shareCard.style.position = 'fixed';
  shareCard.style.left = '-9999px';
  shareCard.style.top = '0';
  shareCard.style.display = 'block';

  try {
    return await html2canvas(shareCard, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
    });
  } finally {
    shareCard.style.display = 'none';
    shareCard.style.position = '';
    shareCard.style.left = '';
    shareCard.style.top = '';
  }
}
