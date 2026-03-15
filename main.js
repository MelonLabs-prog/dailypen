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

async function loadPrompts(refresh = false) {
  if (!refresh && promptsData) {
    promptLoading.hidden = true;
    promptList.hidden = false;
    renderPrompts();
    return;
  }

  promptLoading.hidden = false;
  promptList.hidden = true;

  try {
    const url = refresh ? '/api/prompt?refresh=1' : '/api/prompt';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load prompts');
    promptsData = await res.json();
  } catch {
    // Use inline fallback
    promptsData = {
      reflect: [
        { prompt: 'What is something new you learned this week? How did it make you feel?', vocab: ['fascinating', 'discover', 'perspective', 'realize'] },
        { prompt: 'Describe a person who has influenced your life. What did they teach you?', vocab: ['inspire', 'grateful', 'wisdom', 'role model'] },
        { prompt: 'What is one thing you would tell your younger self? Write about the advice and why it matters.', vocab: ['regret', 'hindsight', 'growth', 'appreciate'] },
        { prompt: 'Think about a time you stepped out of your comfort zone. What happened and how did you feel?', vocab: ['courage', 'nervous', 'overcome', 'rewarding'] },
        { prompt: 'What does a perfect weekend look like for you? Describe it in detail.', vocab: ['unwind', 'leisurely', 'recharge', 'indulge'] },
      ],
      world: [
        { prompt: 'Technology is changing how people communicate around the world. Do you think this is mostly positive or negative? Why?', vocab: ['connection', 'interact', 'social media', 'meaningful'], source: 'General' },
        { prompt: 'Think about a news story you heard recently. What happened and what is your opinion?', vocab: ['headline', 'significant', 'impact', 'debate'], source: 'General' },
        { prompt: 'More people are working from home than ever before. Do you think this trend will continue? What are the pros and cons?', vocab: ['remote', 'flexibility', 'isolation', 'productivity'], source: 'General' },
      ],
      random: [
        { prompt: 'If you could wake up tomorrow with one new skill, what would it be and why?', vocab: ['master', 'ambitious', 'transform', 'passion'] },
        { prompt: 'You find a mysterious door in your house that you have never noticed before. What happens when you open it?', vocab: ['curiosity', 'bizarre', 'stumble upon', 'astonishing'] },
        { prompt: 'If you could have dinner with any person, living or dead, who would it be and what would you talk about?', vocab: ['admire', 'insightful', 'fascinating', 'memorable'] },
        { prompt: 'Describe your favourite meal as if you are a food critic writing for a magazine.', vocab: ['savoury', 'delectable', 'texture', 'aroma', 'culinary'] },
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
      <button class="prompt-translate-btn" data-index="${i}" title="Translate this prompt">🌐 Translate</button>
      <div class="prompt-translation" data-translate-index="${i}" hidden></div>
    </div>
  `).join('');

  // Attach click handlers for selecting prompts (ignore clicks on translate btn)
  promptList.querySelectorAll('.prompt-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.prompt-translate-btn')) return;
      const idx = parseInt(card.dataset.index);
      const item = items[idx];
      selectedPrompt = item.prompt;
      selectedVocab = item.vocab || [];
      goToWrite();
    });
  });

  // Attach translate handlers
  promptList.querySelectorAll('.prompt-translate-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const idx = btn.dataset.index;
      const item = items[parseInt(idx)];
      const translationEl = promptList.querySelector(`[data-translate-index="${idx}"]`);
      if (!translationEl.hidden) { translationEl.hidden = true; return; }
      btn.disabled = true;
      btn.textContent = '⏳';
      try {
        const targetLang = document.getElementById('promptLang')?.value || 'Chinese';
        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: item.prompt, targetLang }),
        });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        translationEl.innerHTML = `<p class="prompt-translation-text">${data.translation}</p>`;
        translationEl.hidden = false;
      } catch {
        translationEl.innerHTML = '<p class="prompt-translation-text">Could not translate.</p>';
        translationEl.hidden = false;
      } finally {
        btn.disabled = false;
        btn.textContent = '🌐 Translate';
      }
    });
  });
}

// Refresh prompts (category-specific: only replaces current category)
document.getElementById('refreshPromptsBtn').addEventListener('click', async () => {
  const btn = document.getElementById('refreshPromptsBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Loading...';
  try {
    const res = await fetch('/api/prompt?refresh=1');
    if (!res.ok) throw new Error('Failed');
    const newPrompts = await res.json();
    // Only replace the current category, keep others
    if (newPrompts[currentCategory]) {
      promptsData[currentCategory] = newPrompts[currentCategory];
    }
    renderPrompts();
  } catch {
    // Silently fail, keep existing prompts
  } finally {
    btn.disabled = false;
    btn.textContent = '🔄 More prompts';
  }
});

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

// === Inline Diff Highlighting ===
function escapeHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightDiff(original, fixed) {
  const origWords = original.split(/\s+/);
  const fixWords = fixed.split(/\s+/);
  const m = origWords.length, n = fixWords.length;

  // LCS dp
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (origWords[i - 1].toLowerCase() === fixWords[j - 1].toLowerCase()) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack
  const origInLCS = new Set();
  const fixInLCS = new Set();
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (origWords[i - 1].toLowerCase() === fixWords[j - 1].toLowerCase()) {
      origInLCS.add(i - 1);
      fixInLCS.add(j - 1);
      i--; j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  const origHTML = origWords.map((w, idx) =>
    origInLCS.has(idx) ? escapeHTML(w) : `<span class="fix-hl">${escapeHTML(w)}</span>`
  ).join(' ');

  const fixHTML = fixWords.map((w, idx) =>
    fixInLCS.has(idx) ? escapeHTML(w) : `<span class="fix-hl">${escapeHTML(w)}</span>`
  ).join(' ');

  return { origHTML, fixHTML };
}

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
    const diff1 = highlightDiff(fix1.original || '', fix1.fix);
    document.getElementById('fix1Original').innerHTML = diff1.origHTML;
    document.getElementById('fix1Fix').innerHTML = diff1.fixHTML;
    document.getElementById('fix1Note').textContent = fix1.note;
  }

  const fix2 = data.fixes?.[1];
  if (fix2) {
    document.getElementById('fix2Title').textContent = fix2.title;
    const diff2 = highlightDiff(fix2.original || '', fix2.fix);
    document.getElementById('fix2Original').innerHTML = diff2.origHTML;
    document.getElementById('fix2Fix').innerHTML = diff2.fixHTML;
    document.getElementById('fix2Note').textContent = fix2.note;
    document.getElementById('fix2Card').hidden = false;
  } else {
    document.getElementById('fix2Card').hidden = true;
  }

  // Upgrade
  const upgrade = data.upgrade;
  if (upgrade) {
    document.getElementById('upgradeTitle').textContent = upgrade.title;
    const diffUp = highlightDiff(upgrade.original || '', upgrade.fix);
    document.getElementById('upgradeOriginal').innerHTML = diffUp.origHTML;
    document.getElementById('upgradeFix').innerHTML = diffUp.fixHTML;
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

  // Full corrected versions
  const fc = data.fullCorrected;
  if (fc) {
    window._fcData = fc;
    window._fcActive = 'clean';
    document.getElementById('fcContent').textContent = fc.clean || '';
    document.getElementById('fcDesc').textContent = 'Only grammar & spelling fixed — your words, your voice.';
    document.querySelectorAll('.fc-tab').forEach(t => t.classList.toggle('active', t.dataset.fc === 'clean'));
    document.getElementById('fullCorrectedCard').hidden = false;
  } else {
    document.getElementById('fullCorrectedCard').hidden = true;
  }

  // Hide rewrite card initially — user must click "Try Rewrite Challenge"
  document.getElementById('rewriteCard').hidden = true;

  showStep(feedbackSection);
}

// Full corrected version tabs
const fcDescs = {
  clean: 'Only grammar & spelling fixed — your words, your voice.',
  polished: 'Smoother flow with minimal tweaks — still your style.',
  native: 'How a native speaker might write the same ideas.',
};
document.querySelectorAll('.fc-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const key = tab.dataset.fc;
    if (!window._fcData) return;
    document.querySelectorAll('.fc-tab').forEach(t => t.classList.toggle('active', t === tab));
    document.getElementById('fcContent').textContent = window._fcData[key] || '';
    document.getElementById('fcDesc').textContent = fcDescs[key] || '';
    window._fcActive = key;
  });
});

document.getElementById('fcCopyBtn').addEventListener('click', async () => {
  const text = document.getElementById('fcContent').textContent;
  try {
    await navigator.clipboard.writeText(text);
    const btn = document.getElementById('fcCopyBtn');
    btn.textContent = '✅ Copied!';
    setTimeout(() => { btn.textContent = '📋 Copy'; }, 2000);
  } catch { /* ignore */ }
});

// Rewrite challenge flow: hide feedback, show only rewrite
const feedbackCards = () => feedbackSection.querySelectorAll('.welldone-card, .score-card, .fix-card, .upgrade-card, .fullcorrected-card');

document.getElementById('tryRewriteBtn').addEventListener('click', () => {
  feedbackCards().forEach(c => c.hidden = true);
  document.getElementById('rewriteCard').hidden = false;
  document.getElementById('feedbackActions').hidden = true;
  // Add a back button if not already there
  let backBtn = document.getElementById('backToFeedbackBtn');
  if (!backBtn) {
    backBtn = document.createElement('button');
    backBtn.id = 'backToFeedbackBtn';
    backBtn.className = 'btn btn-secondary';
    backBtn.textContent = '← Back to Feedback';
    backBtn.style.marginTop = '12px';
    document.getElementById('rewriteCard').after(backBtn);
    backBtn.addEventListener('click', () => {
      feedbackCards().forEach(c => c.hidden = false);
      document.getElementById('rewriteCard').hidden = true;
      document.getElementById('feedbackActions').hidden = false;
      backBtn.hidden = true;
      window.scrollTo(0, 0);
    });
  }
  backBtn.hidden = false;
  window.scrollTo(0, 0);
});

// Rewrite check
document.getElementById('checkRewriteBtn').addEventListener('click', async () => {
  const rewriteInput = document.getElementById('rewriteInput');
  const text = rewriteInput.value.trim();
  if (!text) return;

  const btn = document.getElementById('checkRewriteBtn');
  const feedbackEl = document.getElementById('rewriteFeedback');
  btn.disabled = true;
  btn.textContent = '⏳ Checking...';

  try {
    const rc = lastFeedbackData?.rewriteChallenge;
    const res = await fetch('/api/rewrite-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        original: rc?.original || '',
        improved: rc?.improved || '',
        rewrite: text,
      }),
    });
    if (!res.ok) throw new Error('Failed');
    const data = await res.json();

    const emoji = data.rating === 'great' ? '🌟' : data.rating === 'good' ? '👍' : '💪';
    feedbackEl.innerHTML = `
      <p class="rewrite-fb-rating">${emoji} ${data.feedback}</p>
      ${data.tip ? `<p class="rewrite-fb-tip">💡 ${data.tip}</p>` : ''}
    `;
    feedbackEl.className = `rewrite-feedback rewrite-fb-${data.rating}`;
    feedbackEl.hidden = false;
  } catch {
    feedbackEl.innerHTML = '<p>Could not check rewrite. Try again.</p>';
    feedbackEl.className = 'rewrite-feedback';
    feedbackEl.hidden = false;
  } finally {
    btn.disabled = false;
    btn.textContent = '✅ Check my rewrite';
  }
});

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
let shareMode = 'score'; // 'score' | 'feedback'

async function generateCurrentSharePreview() {
  sharePreviewImg.hidden = true;
  sharePreviewSpinner.hidden = false;
  sharePreviewSpinner.textContent = '⏳ Generating preview...';
  try {
    populateShareCard(lastFeedbackData);
    if (shareMode === 'feedback') {
      populateShareCardFeedback(lastFeedbackData);
    }
    const cardId = shareMode === 'feedback' ? 'shareCardFeedback' : 'shareCard';
    lastCanvas = await generateShareImage(cardId);
    sharePreviewImg.src = lastCanvas.toDataURL('image/png');
    sharePreviewImg.hidden = false;
    sharePreviewSpinner.hidden = true;
  } catch {
    sharePreviewSpinner.textContent = '❌ Could not generate preview.';
  }
}

document.getElementById('shareScoreOnly').addEventListener('click', () => {
  shareMode = 'score';
  document.getElementById('shareScoreOnly').classList.add('active');
  document.getElementById('shareWithFeedback').classList.remove('active');
  generateCurrentSharePreview();
});

document.getElementById('shareWithFeedback').addEventListener('click', () => {
  shareMode = 'feedback';
  document.getElementById('shareWithFeedback').classList.add('active');
  document.getElementById('shareScoreOnly').classList.remove('active');
  generateCurrentSharePreview();
});

document.getElementById('shareBtn').addEventListener('click', async () => {
  if (!lastFeedbackData) return;
  shareConfirm.hidden = true;
  shareMode = 'score';
  document.getElementById('shareScoreOnly').classList.add('active');
  document.getElementById('shareWithFeedback').classList.remove('active');
  shareModal.hidden = false;
  await generateCurrentSharePreview();
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

function populateShareCardFeedback(data) {
  const scores = data.scores || {};
  const overall = typeof scores.overall === 'number' ? scores.overall : 0;

  document.getElementById('scfScoreNumber').textContent = overall;
  document.getElementById('scfScoreLabel').textContent = data.scoreLabel || '';
  document.getElementById('scfScoreCircle').className = 'sc-score-circle ' + getScoreTier(overall);

  // Fixes
  const fix1 = data.fixes?.[0];
  if (fix1) {
    document.getElementById('scfFix1Title').textContent = fix1.title;
    document.getElementById('scfFix1Before').textContent = fix1.original || '';
    document.getElementById('scfFix1After').textContent = fix1.fix;
  }
  const fix2 = data.fixes?.[1];
  if (fix2) {
    document.getElementById('scfFix2Title').textContent = fix2.title;
    document.getElementById('scfFix2Before').textContent = fix2.original || '';
    document.getElementById('scfFix2After').textContent = fix2.fix;
    document.getElementById('scfFix2').style.display = '';
  } else {
    document.getElementById('scfFix2').style.display = 'none';
  }
  const upgrade = data.upgrade;
  if (upgrade) {
    document.getElementById('scfUpgradeTitle').textContent = upgrade.title;
    document.getElementById('scfUpgradeBefore').textContent = upgrade.original || '';
    document.getElementById('scfUpgradeAfter').textContent = upgrade.fix;
  }

  document.getElementById('scfWordCount').textContent = `📝 ${data.wordCount || 0} words`;
  document.getElementById('scfPromptTopic').textContent = selectedPrompt
    ? selectedPrompt.substring(0, 60) + (selectedPrompt.length > 60 ? '...' : '')
    : 'Free writing';
}

async function generateShareImage(cardId = 'shareCard') {
  const shareCard = document.getElementById(cardId);
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
