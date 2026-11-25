const $ = (id) => document.getElementById(id);
const video = $('video');
const panel = $('panel');
const toast = $('toast');

let stream = null;
let audioCtx = null;
let gainNode = null;
let audioSrc = null;
let recorder = null;
let recChunks = [];
let muted = false;
let settings = {};
let idleTimer = null;
let statsTimer = null;

function say(msg, ms = 2200) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(say._t);
  say._t = setTimeout(() => toast.classList.remove('show'), ms);
}

function persist() {
  settings = {
    videoId: $('videoSel').value,
    audioId: $('audioSel').value,
    outId: $('outSel').value,
    res: $('resSel').value,
    fit: $('fitSel').value,
    vol: Number($('vol').value),
    muted
  };
  window.api.saveSettings(settings);
}

async function listDevices() {
  // Need a permission grant before labels show up.
  try {
    const tmp = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    tmp.getTracks().forEach((t) => t.stop());
  } catch {
    try {
      const tmp = await navigator.mediaDevices.getUserMedia({ video: true });
      tmp.getTracks().forEach((t) => t.stop());
    } catch (e) { /* no devices at all */ }
  }
  const devs = await navigator.mediaDevices.enumerateDevices();
  const vids = devs.filter((d) => d.kind === 'videoinput');
  const auds = devs.filter((d) => d.kind === 'audioinput');

  const fill = (sel, list, prefer, none) => {
    sel.innerHTML = '';
    if (none) sel.add(new Option(none, ''));
    list.forEach((d, i) => sel.add(new Option(d.label || `Device ${i + 1}`, d.deviceId)));
    if (prefer && [...sel.options].some((o) => o.value === prefer)) sel.value = prefer;
  };

  fill($('videoSel'), vids, settings.videoId);
  fill($('audioSel'), auds, settings.audioId, '(No audio)');
  const outs = devs.filter((d) => d.kind === 'audiooutput');
  fill($('outSel'), outs, settings.outId);

  // Auto-pick a likely capture card if nothing saved.
  const looksLikeCard = (l) => /capture|cam link|elgato|avermedia|hdmi|usb3?\.?0? video|digital audio|usb audio|usb video|usb3|game|magewell|razer ripsaw|live gamer|genki|uvc/i.test(l);
  if (!settings.videoId) {
    const hit = vids.find((d) => looksLikeCard(d.label));
    if (hit) $('videoSel').value = hit.deviceId;
  }
  if (!settings.audioId) {
    const words = (l) => l.toLowerCase().replace(/\(.*?\)/g, '').split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !['usb','video','audio','digital','capture','microphone','hdmi'].includes(w));
    const vw = words($('videoSel').selectedOptions[0]?.text || '');
    const pair = auds.find((a) => words(a.label).some((w) => vw.includes(w)));
    if (pair) $('audioSel').value = pair.deviceId;
  }
  if (!settings.audioId && !$('audioSel').value) {
    const vlabel = $('videoSel').selectedOptions[0]?.text || '';
    const hit = auds.find((d) => looksLikeCard(d.label) || (vlabel && d.label.split(' ')[0] && vlabel.includes(d.label.split(' ')[0])));
    if (hit) $('audioSel').value = hit.deviceId;
  }

  if (!vids.length) {
    $('emptyMsg').innerHTML = 'No capture device found. Plug in your capture card, then press <b>Refresh</b>.';
  }
}


const CANDIDATES = [
  [3840, 2160], [2560, 1440], [1920, 1080], [1600, 900], [1280, 720],
  [1024, 768], [800, 600], [720, 576], [720, 480], [640, 480]
];
const FPS_LIST = [120, 60, 50, 30, 25, 24, 15];
let probing = false;

// Ask the card which modes it really supports by trying each one on a live track.
async function probeModes() {
  const vid = $('videoSel').value;
  if (!vid || stream || probing) return;
  probing = true;
  const sel = $('resSel');
  const saved = settings.res || sel.value;
  sel.innerHTML = '';
  sel.add(new Option('Scanning card…', 'auto'));
  let s;
  const found = [];
  try {
    s = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: vid } } });
    const t = s.getVideoTracks()[0];
    for (const [w, h] of CANDIDATES) {
      for (const f of FPS_LIST) {
        try {
          await t.applyConstraints({ width: { exact: w }, height: { exact: h }, frameRate: { exact: f } });
          const g = t.getSettings();
          if (g.width === w && g.height === h && Math.abs((g.frameRate || f) - f) <= 1) found.push([w, h, f]);
        } catch { /* mode not supported */ }
      }
    }
  } catch { /* card busy or missing */ }
  if (s) s.getTracks().forEach((t) => t.stop());
  sel.innerHTML = '';
  sel.add(new Option('Auto (card default)', 'auto'));
  found.forEach(([w, h, f]) => sel.add(new Option(`${h}p ${f}${w === 1920 || w === 1280 || w === 3840 ? '' : ` (${w}×${h})`}`, `${w}x${h}@${f}`)));
  const has = (v) => [...sel.options].some((o) => o.value === v);
  const pref = ['1920x1080@30', '1280x720@30'];
  sel.value = has(saved) ? saved : (pref.find(has) || 'auto');
  probing = false;
  persist();
}

function parseRes(v) {
  if (v === 'auto') return {};
  const [wh, fps] = v.split('@');
  const [w, h] = wh.split('x').map(Number);
  return { width: { ideal: w }, height: { ideal: h }, frameRate: { ideal: Number(fps) } };
}

async function start() {
  await stop(true);
  const vid = $('videoSel').value;
  if (!vid) { say('Pick a video device first'); return; }
  const aud = $('audioSel').value;

  const constraints = {
    video: { deviceId: { exact: vid }, ...parseRes($('resSel').value) },
    audio: aud
      ? {
          deviceId: { exact: aud },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 2,
          latency: 0
        }
      : false
  };

  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (e) {
    // Retry with relaxed settings (some cards reject exact res/fps).
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: vid } },
        audio: constraints.audio
      });
      say('Card rejected that quality, using its default');
    } catch (e2) {
      say(`Couldn't open the capture card: ${e2.name}. Is another app using it?`, 5000);
      return;
    }
  }

  video.srcObject = stream; // video element stays muted; audio goes via Web Audio for lower latency
  await video.play().catch(() => {});
  $('empty').style.display = 'none';

  if (stream.getAudioTracks().length) setupAudio();

  const vt = stream.getVideoTracks()[0];
  vt.addEventListener('ended', () => { say('Capture device disconnected', 4000); stop(); });

  $('startBtn').textContent = 'Stop';
  $('startBtn').classList.add('stop');
  startStats();
  persist();
  bumpPanel();
}

function applySink() {
  const id = $('outSel').value;
  if (audioCtx && id && audioCtx.setSinkId) audioCtx.setSinkId(id).catch(() => {});
}

function setupAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
  audioSrc = audioCtx.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
  gainNode = audioCtx.createGain();
  gainNode.gain.value = muted ? 0 : Number($('vol').value);
  audioSrc.connect(gainNode).connect(audioCtx.destination);
  applySink();
  audioCtx.resume();
}

async function stop(quiet) {
  if (recorder && recorder.state !== 'inactive') recorder.stop();
  clearInterval(statsTimer);
  $('stats').textContent = '';
  if (audioCtx) { try { await audioCtx.close(); } catch {} audioCtx = null; gainNode = null; audioSrc = null; }
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
  video.srcObject = null;
  $('startBtn').textContent = 'Start';
  $('startBtn').classList.remove('stop');
  if (!quiet) $('empty').style.display = '';
}

function startStats() {
  clearInterval(statsTimer);
  statsTimer = setInterval(() => {
    const vt = stream && stream.getVideoTracks()[0];
    if (!vt) return;
    const s = vt.getSettings();
    $('stats').textContent = `${s.width}×${s.height} @ ${Math.round(s.frameRate || 0)}fps`;
  }, 1000);
}

function applyMute() {
  $('muteBtn').textContent = muted || Number($('vol').value) === 0 ? '🔇' : '🔊';
  if (gainNode) gainNode.gain.value = muted ? 0 : Number($('vol').value);
}

async function screenshot() {
  if (!stream || !video.videoWidth) { say('Nothing to capture yet'); return; }
  const c = document.createElement('canvas');
  c.width = video.videoWidth; c.height = video.videoHeight;
  c.getContext('2d').drawImage(video, 0, 0);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const data = await blob.arrayBuffer();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const p = await window.api.saveFile({ suggestedName: `capture-${stamp}.png`, filters: [{ name: 'PNG image', extensions: ['png'] }], data });
  if (p) say('Saved screenshot');
}

function toggleRecord() {
  if (recorder && recorder.state !== 'inactive') { recorder.stop(); return; }
  if (!stream) { say('Start the capture first'); return; }
  const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
  recChunks = [];
  recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 });
  recorder.ondataavailable = (e) => { if (e.data.size) recChunks.push(e.data); };
  recorder.onstop = async () => {
    $('recBtn').classList.remove('rec');
    $('recBtn').textContent = '⏺ Rec';
    const blob = new Blob(recChunks, { type: 'video/webm' });
    recChunks = [];
    if (!blob.size) return;
    const data = await blob.arrayBuffer();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const p = await window.api.saveFile({ suggestedName: `recording-${stamp}.webm`, filters: [{ name: 'WebM video', extensions: ['webm'] }], data });
    if (p) say('Saved recording');
  };
  recorder.start(1000);
  $('recBtn').classList.add('rec');
  $('recBtn').textContent = '⏹ Stop rec';
}

function bumpPanel() {
  panel.classList.remove('hidden');
  document.body.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (stream) { panel.classList.add('hidden'); document.body.classList.add('idle'); }
  }, 3000);
}

function setFit() { video.style.objectFit = $('fitSel').value; }

async function init() {
  settings = (await window.api.loadSettings()) || {};
  if (settings.res) $('resSel').value = settings.res;
  if (settings.fit) $('fitSel').value = settings.fit;
  if (typeof settings.vol === 'number') $('vol').value = settings.vol;
  muted = !!settings.muted;
  setFit(); applyMute();

  await listDevices();
  await probeModes();

  $('startBtn').onclick = () => (stream ? stop() : start());
  $('refreshBtn').onclick = async () => { await listDevices(); await probeModes(); say('Devices refreshed'); };
  $('videoSel').onchange = async () => { if (stream) await stop(true); await probeModes(); persist(); start(); };
  $('audioSel').onchange = () => { persist(); if (stream) start(); };
  $('resSel').onchange = () => { persist(); if (stream) start(); };
  $('outSel').onchange = () => { applySink(); persist(); };
  $('fitSel').onchange = () => { setFit(); persist(); };
  $('vol').oninput = () => { if (muted && Number($('vol').value) > 0) muted = false; applyMute(); persist(); };
  $('muteBtn').onclick = () => { muted = !muted; applyMute(); persist(); };
  $('shotBtn').onclick = screenshot;
  $('recBtn').onclick = toggleRecord;
  $('topBtn').onclick = () => window.api.toggleOnTop();
  $('fsBtn').onclick = () => window.api.toggleFullscreen();
  video.ondblclick = () => window.api.toggleFullscreen();

  const info = await window.api.appVersion();
  $('updBtn').title = `Check for updates (v${info.version})`;
  $('updBtn').onclick = () => window.api.checkUpdates();
  window.api.onUpdate(({ state, text }) => {
    say(text, state === 'ready' || state === 'error' ? 6000 : 3000);
    if (state === 'ready') { $('updBtn').textContent = 'Restart to update'; $('updBtn').classList.add('primary'); }
  });

  navigator.mediaDevices.addEventListener('devicechange', async () => {
    await listDevices();
    await probeModes();
    if (!stream && $('videoSel').value) say('Device list changed');
  });

  document.addEventListener('mousemove', bumpPanel);
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k === 'f' || e.key === 'F11') { e.preventDefault(); window.api.toggleFullscreen(); }
    else if (k === 'escape') window.api.setFullscreen(false);
    else if (k === 'm') { muted = !muted; applyMute(); persist(); }
    else if (k === 's') screenshot();
    else if (k === 'r') toggleRecord();
    else if (k === 't') window.api.toggleOnTop();
    else if (k === 'h') panel.classList.toggle('hidden');
    bumpPanel();
  });

  // Auto-start if a saved device is still present.
  if (settings.videoId && $('videoSel').value === settings.videoId) start();
}

init();
