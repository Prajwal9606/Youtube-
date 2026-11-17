import './style.css';
import { VideoRenderer } from './services/videoRenderer.js';
import { extractAudioFromVideoBlob } from './services/audioExtractor.js';
import { shareVideoFile } from './services/nativeShare.js';
import { YouTubeUploader } from './services/youtubeUploader.js';
import { renderOAuthGuideModal } from './components/OAuthGuideModal.js';

// Application State
const state = {
  videoBlob: null,
  videoUrl: null,
  videoElement: document.getElementById('hidden-video'),
  previewCanvas: document.getElementById('preview-canvas'),
  renderer: new VideoRenderer(),
  youtubeUploader: new YouTubeUploader(),
  whisperWorker: null,
  layoutMode: 'crop',
  subtitleStyle: 'mrbeast',
  words: [],
  segments: [],
  renderedBlob: null,
  settings: {
    aiEngine: localStorage.getItem('yt_ai_engine') || 'webgpu',
    pythonUrl: localStorage.getItem('yt_python_url') || 'http://127.0.0.1:8000',
    whisperModel: localStorage.getItem('yt_whisper_model') || 'onnx-community/whisper-tiny',
    googleClientId: localStorage.getItem('yt_google_client_id') || ''
  }
};

// UI Elements
const el = {
  fileInput: document.getElementById('video-file-input'),
  dropzone: document.getElementById('file-dropzone'),
  ytUrlInput: document.getElementById('yt-url-input'),
  btnFetchYt: document.getElementById('btn-fetch-yt'),
  tabBtns: document.querySelectorAll('.tab-btn'),
  editorSection: document.getElementById('editor-section'),
  btnPlayPause: document.getElementById('btn-play-pause'),
  timelineScrubber: document.getElementById('timeline-scrubber'),
  timeDisplay: document.getElementById('time-display'),
  layoutPills: document.querySelectorAll('#layout-pill-group .pill-btn'),
  stylePills: document.querySelectorAll('#style-pill-group .pill-btn'),
  btnTranscribe: document.getElementById('btn-transcribe'),
  aiEngineBadge: document.getElementById('ai-engine-badge'),
  engineStatusPill: document.getElementById('engine-status-pill'),
  engineStatusText: document.getElementById('engine-status-text'),
  wordsCount: document.getElementById('words-count'),
  captionsList: document.getElementById('captions-list'),
  btnClearCaptions: document.getElementById('btn-clear-captions'),
  btnRenderGpu: document.getElementById('btn-render-gpu'),
  btnShareNative: document.getElementById('btn-share-native'),
  btnUploadYt: document.getElementById('btn-upload-yt'),
  renderOverlay: document.getElementById('render-overlay'),
  renderStatusTitle: document.getElementById('render-status-title'),
  renderProgressBar: document.getElementById('render-progress-bar'),
  renderProgressText: document.getElementById('render-progress-text'),
  // Modals
  settingsModal: document.getElementById('settings-modal'),
  btnOpenSettings: document.getElementById('btn-open-settings'),
  settingsCloseBtn: document.getElementById('settings-close-btn'),
  settingsCancelBtn: document.getElementById('settings-cancel-btn'),
  settingsSaveBtn: document.getElementById('settings-save-btn'),
  settingAiEngine: document.getElementById('setting-ai-engine'),
  settingPythonUrl: document.getElementById('setting-python-url'),
  settingWhisperModel: document.getElementById('setting-whisper-model'),
  settingGoogleClientId: document.getElementById('setting-google-client-id'),
  pythonUrlGroup: document.getElementById('python-url-group'),
  btnOpenGuideLink: document.getElementById('btn-open-guide-link'),
  guideContainer: document.getElementById('guide-modal-container'),
  // YouTube Modal
  ytModal: document.getElementById('youtube-upload-modal'),
  ytModalCloseBtn: document.getElementById('yt-modal-close-btn'),
  ytCancelBtn: document.getElementById('yt-cancel-btn'),
  ytConfirmUploadBtn: document.getElementById('yt-confirm-upload-btn'),
  ytTitleInput: document.getElementById('yt-title-input'),
  ytDescInput: document.getElementById('yt-desc-input'),
  ytTagsInput: document.getElementById('yt-tags-input'),
  ytPrivacySelect: document.getElementById('yt-privacy-select'),
  ytUploadProgressCard: document.getElementById('yt-upload-progress-card'),
  ytProgressFill: document.getElementById('yt-progress-fill'),
  ytProgressText: document.getElementById('yt-progress-text'),
  ytUploadResultCard: document.getElementById('yt-upload-result-card'),
  ytVideoLink: document.getElementById('yt-video-link')
};

// Initialize Application
function init() {
  setupTabs();
  setupSettingsUI();
  setupWhisperWorker();
  setupEventListeners();
  updateEngineStatusBadge();
}

// Setup In-Browser Web Worker for Transformers.js Whisper
function setupWhisperWorker() {
  try {
    state.whisperWorker = new Worker(
      new URL('./workers/whisper.worker.js', import.meta.url),
      { type: 'module' }
    );

    state.whisperWorker.onmessage = (e) => {
      const { status, message, progress, result, device, error } = e.data;

      if (status === 'init') {
        updateRenderOverlay(true, message || 'Loading Whisper AI...', 15);
      } else if (status === 'downloading' && progress) {
        if (progress.status === 'progress' && progress.total) {
          const pct = Math.round((progress.loaded / progress.total) * 100);
          updateRenderOverlay(true, `Downloading AI Model (${pct}%)`, pct);
        }
      } else if (status === 'ready' || status === 'loaded') {
        updateRenderOverlay(true, message || 'Whisper AI Ready!', 100);
        setTimeout(() => updateRenderOverlay(false), 800);
      } else if (status === 'transcribing') {
        updateRenderOverlay(true, message || 'Analyzing Speech...', 60);
      } else if (status === 'complete') {
        updateRenderOverlay(false);
        handleTranscriptionResult(result);
      } else if (status === 'error') {
        updateRenderOverlay(false);
        alert(`Transcription error: ${error || 'Unknown error'}`);
      }
    };
  } catch (err) {
    console.warn('[Main] Web Worker initialization error:', err);
  }
}

function updateEngineStatusBadge() {
  if (state.settings.aiEngine === 'webgpu') {
    el.engineStatusText.textContent = 'WebGPU Whisper';
    el.aiEngineBadge.textContent = 'WebGPU / IndexedDB';
  } else {
    el.engineStatusText.textContent = 'Python Server';
    el.aiEngineBadge.textContent = state.settings.pythonUrl.replace(/^https?:\/\//, '');
  }
}

// Media Selection & Loading
function loadVideoBlob(blob) {
  state.videoBlob = blob;
  if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
  state.videoUrl = URL.createObjectURL(blob);
  state.videoElement.src = state.videoUrl;
  state.renderedBlob = null;
  el.btnShareNative.disabled = true;
  el.btnUploadYt.disabled = true;

  state.videoElement.onloadedmetadata = () => {
    el.editorSection.style.display = 'block';
    el.editorSection.scrollIntoView({ behavior: 'smooth' });
    renderCurrentFrame();
  };
}

// Real-Time Frame Render
function renderCurrentFrame() {
  const curTime = state.videoElement.currentTime || 0;
  state.renderer.drawFrame(
    state.videoElement,
    curTime,
    state.layoutMode,
    state.subtitleStyle,
    state.words
  );

  // Copy to visible canvas
  const visibleCtx = el.previewCanvas.getContext('2d');
  visibleCtx.drawImage(state.renderer.canvas, 0, 0);

  // Update Scrubber
  const dur = state.videoElement.duration || 1;
  el.timelineScrubber.value = (curTime / dur) * 100;
  el.timeDisplay.textContent = `${formatTime(curTime)} / ${formatTime(dur)}`;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Playback Animation Loop
let isPlaying = false;
function togglePlayPause() {
  if (isPlaying) {
    state.videoElement.pause();
    isPlaying = false;
    el.btnPlayPause.textContent = '▶';
  } else {
    state.videoElement.play();
    isPlaying = true;
    el.btnPlayPause.textContent = '⏸';
    requestAnimationFrame(renderLoop);
  }
}

function renderLoop() {
  if (!isPlaying) return;
  renderCurrentFrame();
  if (state.videoElement.ended) {
    isPlaying = false;
    el.btnPlayPause.textContent = '▶';
  } else {
    requestAnimationFrame(renderLoop);
  }
}

// Transcribe Audio
async function runTranscription() {
  if (!state.videoBlob) {
    alert('Please load a video first!');
    return;
  }

  updateRenderOverlay(true, 'Extracting Audio on Device...', 10);

  if (state.settings.aiEngine === 'webgpu') {
    // Engine 1: Pure On-Device Web Worker Whisper
    try {
      const audioData = await extractAudioFromVideoBlob(state.videoBlob, (p) => {
        updateRenderOverlay(true, p.message, Math.round(p.progress * 0.4));
      });

      updateRenderOverlay(true, 'Running On-Device Whisper AI...', 45);

      state.whisperWorker.postMessage({
        type: 'transcribe',
        data: {
          audio: audioData,
          modelName: state.settings.whisperModel,
          language: 'auto'
        }
      });
    } catch (err) {
      updateRenderOverlay(false);
      alert(`Audio extraction failed: ${err.message}`);
    }
  } else {
    // Engine 2: Companion Python Server
    try {
      updateRenderOverlay(true, `Uploading to Python Server (${state.settings.pythonUrl})...`, 25);
      const formData = new FormData();
      formData.append('file', state.videoBlob, 'input_video.mp4');
      formData.append('model', 'tiny');

      const response = await fetch(`${state.settings.pythonUrl}/api/transcribe`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();
      updateRenderOverlay(false);
      handleTranscriptionResult(result);
    } catch (err) {
      updateRenderOverlay(false);
      alert(`Python Server connection error: ${err.message}\nMake sure Termux / Colab is running with CORS enabled.`);
    }
  }
}

function handleTranscriptionResult(result) {
  state.words = result.words || [];
  state.segments = result.segments || [];
  el.wordsCount.textContent = state.words.length;

  // Populate Captions list in UI
  el.captionsList.innerHTML = '';
  if (state.words.length === 0 && result.text) {
    // Fallback if words not chunked
    el.captionsList.innerHTML = `<div class="caption-row"><span>${result.text}</span></div>`;
  } else {
    state.words.forEach((w) => {
      const row = document.createElement('div');
      row.className = 'caption-row';
      row.innerHTML = `
        <strong>${w.word}</strong>
        <span class="caption-time">${w.start}s - ${w.end}s</span>
      `;
      el.captionsList.appendChild(row);
    });
  }

  renderCurrentFrame();
}

// ⚡ GPU 9:16 MP4 Rendering
async function renderWithDeviceGPU() {
  if (!state.videoBlob) return;

  updateRenderOverlay(true, 'Rendering 9:16 Video with Device GPU...', 0);

  try {
    const renderedBlob = await state.renderer.exportMP4(
      state.videoElement,
      {
        layoutMode: state.layoutMode,
        subtitleStyle: state.subtitleStyle,
        words: state.words,
        duration: Math.min(60, state.videoElement.duration || 10),
        startTime: 0,
        fps: 30
      },
      (p) => {
        updateRenderOverlay(true, `Encoding GPU Frames (${p.percent}%)...`, p.percent);
      }
    );

    state.renderedBlob = renderedBlob;
    updateRenderOverlay(false);

    el.btnShareNative.disabled = false;
    el.btnUploadYt.disabled = false;

    alert(`🎉 9:16 Video Render Complete!\nSize: ${(renderedBlob.size / (1024 * 1024)).toFixed(1)}MB\nYou can now Save/Share or Upload directly to YouTube.`);
  } catch (err) {
    updateRenderOverlay(false);
    console.error('[Render Error]', err);
    alert(`Render failed: ${err.message}`);
  }
}

// Progress Overlay Helper
function updateRenderOverlay(show, title = '', percent = 0) {
  if (show) {
    el.renderOverlay.style.display = 'flex';
    el.renderStatusTitle.textContent = title;
    el.renderProgressBar.style.width = `${percent}%`;
    el.renderProgressText.textContent = `${percent}%`;
  } else {
    el.renderOverlay.style.display = 'none';
  }
}

// YouTube Upload Flow
function openYouTubeUploadModal() {
  if (!state.renderedBlob) {
    alert('Please render the video first using "⚡ Render with Device GPU"');
    return;
  }

  if (!state.settings.googleClientId) {
    const proceed = confirm('Google OAuth Client ID is not configured yet. Would you like to view the setup guide?');
    if (proceed) {
      renderOAuthGuideModal(el.guideContainer, () => openSettingsModal());
    }
    return;
  }

  el.ytModal.style.display = 'flex';
  el.ytUploadProgressCard.style.display = 'none';
  el.ytUploadResultCard.style.display = 'none';
  el.ytConfirmUploadBtn.disabled = false;
}

async function startYouTubeUpload() {
  const title = el.ytTitleInput.value.trim() || 'My YouTube Short #Shorts';
  const description = el.ytDescInput.value.trim();
  const tags = el.ytTagsInput.value.split(',').map((t) => t.trim()).filter(Boolean);
  const privacyStatus = el.ytPrivacySelect.value;

  el.ytConfirmUploadBtn.disabled = true;
  el.ytUploadProgressCard.style.display = 'flex';
  el.ytProgressFill.style.width = '5%';
  el.ytProgressText.textContent = 'Requesting Google authorization...';

  try {
    const uploadResult = await state.youtubeUploader.uploadVideo(
      state.renderedBlob,
      {
        title,
        description,
        tags,
        privacyStatus
      },
      state.settings.googleClientId,
      (p) => {
        el.ytProgressFill.style.width = `${p.percent}%`;
        el.ytProgressText.textContent = p.message || `${p.percent}%`;
      }
    );

    el.ytUploadProgressCard.style.display = 'none';
    el.ytUploadResultCard.style.display = 'flex';
    el.ytVideoLink.href = uploadResult.url;
    el.ytVideoLink.textContent = `Watch Short: ${uploadResult.url}`;
  } catch (err) {
    el.ytConfirmUploadBtn.disabled = false;
    el.ytProgressText.textContent = `Error: ${err.message}`;
    alert(`YouTube Upload Failed: ${err.message}`);
  }
}

// Settings Modal Management
function openSettingsModal() {
  el.settingAiEngine.value = state.settings.aiEngine;
  el.settingPythonUrl.value = state.settings.pythonUrl;
  el.settingWhisperModel.value = state.settings.whisperModel;
  el.settingGoogleClientId.value = state.settings.googleClientId;
  el.pythonUrlGroup.style.display = state.settings.aiEngine === 'python' ? 'flex' : 'none';
  el.settingsModal.style.display = 'flex';
}

function saveSettings() {
  state.settings.aiEngine = el.settingAiEngine.value;
  state.settings.pythonUrl = el.settingPythonUrl.value.trim();
  state.settings.whisperModel = el.settingWhisperModel.value;
  state.settings.googleClientId = el.settingGoogleClientId.value.trim();

  localStorage.setItem('yt_ai_engine', state.settings.aiEngine);
  localStorage.setItem('yt_python_url', state.settings.pythonUrl);
  localStorage.setItem('yt_whisper_model', state.settings.whisperModel);
  localStorage.setItem('yt_google_client_id', state.settings.googleClientId);

  updateEngineStatusBadge();
  el.settingsModal.style.display = 'none';
}

// UI Event Listeners
function setupEventListeners() {
  // File Drop / Selection
  el.fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      loadVideoBlob(e.target.files[0]);
    }
  });

  el.dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.dropzone.style.borderColor = 'var(--accent)';
  });

  el.dropzone.addEventListener('dragleave', () => {
    el.dropzone.style.borderColor = '#475569';
  });

  el.dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    el.dropzone.style.borderColor = '#475569';
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      loadVideoBlob(e.dataTransfer.files[0]);
    }
  });

  // Fetch YouTube via Python Server
  el.btnFetchYt.addEventListener('click', async () => {
    const url = el.ytUrlInput.value.trim();
    if (!url) {
      alert('Please enter a YouTube link');
      return;
    }

    updateRenderOverlay(true, 'Fetching YouTube video via Companion Server...', 30);
    try {
      const resp = await fetch(`${state.settings.pythonUrl}/api/download-yt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (!resp.ok) throw new Error(`Server returned ${resp.status}`);

      const blob = await resp.blob();
      updateRenderOverlay(false);
      loadVideoBlob(blob);
    } catch (err) {
      updateRenderOverlay(false);
      alert(`Could not fetch YouTube video from Companion Server: ${err.message}\nMake sure your Python server (Termux / Colab) is running.`);
    }
  });

  // Video Controls
  el.btnPlayPause.addEventListener('click', togglePlayPause);

  el.timelineScrubber.addEventListener('input', (e) => {
    const dur = state.videoElement.duration || 1;
    const seekTime = (e.target.value / 100) * dur;
    state.videoElement.currentTime = seekTime;
    renderCurrentFrame();
  });

  // Layout Pills
  el.layoutPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      el.layoutPills.forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      state.layoutMode = pill.getAttribute('data-layout');
      renderCurrentFrame();
    });
  });

  // Style Pills
  el.stylePills.forEach((pill) => {
    pill.addEventListener('click', () => {
      el.stylePills.forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      state.subtitleStyle = pill.getAttribute('data-style');
      renderCurrentFrame();
    });
  });

  // AI Transcribe
  el.btnTranscribe.addEventListener('click', runTranscription);

  // Clear Captions
  el.btnClearCaptions.addEventListener('click', () => {
    state.words = [];
    state.segments = [];
    el.wordsCount.textContent = '0';
    el.captionsList.innerHTML = '<div class="empty-captions-placeholder">Captions cleared.</div>';
    renderCurrentFrame();
  });

  // Render GPU
  el.btnRenderGpu.addEventListener('click', renderWithDeviceGPU);

  // Save / Share
  el.btnShareNative.addEventListener('click', async () => {
    if (!state.renderedBlob) return;
    await shareVideoFile(state.renderedBlob, 'youtube_short.mp4');
  });

  // YouTube Upload Modal
  el.btnUploadYt.addEventListener('click', openYouTubeUploadModal);
  el.ytModalCloseBtn.addEventListener('click', () => (el.ytModal.style.display = 'none'));
  el.ytCancelBtn.addEventListener('click', () => (el.ytModal.style.display = 'none'));
  el.ytConfirmUploadBtn.addEventListener('click', startYouTubeUpload);

  // Settings
  el.btnOpenSettings.addEventListener('click', openSettingsModal);
  el.settingsCloseBtn.addEventListener('click', () => (el.settingsModal.style.display = 'none'));
  el.settingsCancelBtn.addEventListener('click', () => (el.settingsModal.style.display = 'none'));
  el.settingsSaveBtn.addEventListener('click', saveSettings);
  el.settingAiEngine.addEventListener('change', (e) => {
    el.pythonUrlGroup.style.display = e.target.value === 'python' ? 'flex' : 'none';
  });

  // Guide Link
  el.btnOpenGuideLink.addEventListener('click', () => {
    el.settingsModal.style.display = 'none';
    renderOAuthGuideModal(el.guideContainer, () => openSettingsModal());
  });
}

// Tabs setup
function setupTabs() {
  el.tabBtns.forEach((tab) => {
    tab.addEventListener('click', () => {
      el.tabBtns.forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));

      tab.classList.add('active');
      const targetId = tab.getAttribute('data-tab');
      document.getElementById(`tab-${targetId}`).classList.add('active');
    });
  });
}

function setupSettingsUI() {
  updateEngineStatusBadge();
}

// Start App
window.addEventListener('DOMContentLoaded', init);
