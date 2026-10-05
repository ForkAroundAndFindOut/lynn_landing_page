import { DEFAULT_TUNING, TUNING_FIELDS, sanitizeTuning, applyMotionPreset } from './tuning-config.js';

export const REVIEW_COOKIE_NAME = 'lynn_review_settings';
export const REVIEW_COOKIE_VERSION = 2;
export const DEFAULT_REVIEW_SETTINGS = Object.freeze({ preset: 'balanced', desktop: 'staggered', view: 'auto', reduce: false, debug: false, panelOpen: false, tuning: DEFAULT_TUNING });
const reviewParams = ['preset', 'desktop', 'motion', 'debug', 'view'];
const presets = ['balanced', 'crisp', 'gentle'];
const desktops = ['staggered', 'conventional'];
const views = ['auto', 'deck', 'page'];

export function validateReviewSettings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![1, REVIEW_COOKIE_VERSION].includes(value.version)
    || !presets.includes(value.preset) || !desktops.includes(value.desktop)
    || typeof value.reduce !== 'boolean' || typeof value.debug !== 'boolean' || typeof value.panelOpen !== 'boolean'
    || (value.version === 2 && !views.includes(value.view))) return null;
  return {
    preset: value.preset, desktop: value.desktop, reduce: value.reduce, debug: value.debug, panelOpen: value.panelOpen,
    view: value.version === 1 ? 'auto' : value.view,
    tuning: value.version === 1 ? applyMotionPreset(DEFAULT_TUNING, value.preset) : sanitizeTuning(value.tuning),
  };
}
export function parseReviewCookie(value) {
  try { return validateReviewSettings(JSON.parse(decodeURIComponent(value))); }
  catch { return null; }
}
export function applyReviewQuery(saved = DEFAULT_REVIEW_SETTINGS, search = '') {
  const state = { ...DEFAULT_REVIEW_SETTINGS, ...saved, tuning: sanitizeTuning(saved.tuning) };
  const params = new URLSearchParams(search);
  if (presets.includes(params.get('preset'))) {
    state.preset = params.get('preset');
    state.tuning = applyMotionPreset(state.tuning, state.preset);
  }
  if (desktops.includes(params.get('desktop'))) state.desktop = params.get('desktop');
  if (views.includes(params.get('view'))) state.view = params.get('view');
  if (['reduce', 'normal'].includes(params.get('motion'))) state.reduce = params.get('motion') === 'reduce';
  if (['0', '1'].includes(params.get('debug'))) state.debug = params.get('debug') === '1';
  return state;
}
function cookieValue(cookieText) {
  const entry = cookieText.split(';').map(value => value.trim()).find(value => value.startsWith(`${REVIEW_COOKIE_NAME}=`));
  return entry ? entry.slice(REVIEW_COOKIE_NAME.length + 1) : null;
}
function makeTuningControls(container) {
  const controls = new Map();
  const groups = new Map();
  for (const item of TUNING_FIELDS) {
    if (!groups.has(item.group)) {
      const group = document.createElement('fieldset');
      group.className = 'tuning-group';
      const legend = document.createElement('legend');
      legend.textContent = item.group;
      group.append(legend);
      container.append(group);
      groups.set(item.group, group);
    }
    const row = document.createElement('div');
    row.className = 'tuning-field';
    const label = document.createElement('label');
    label.textContent = item.label;
    const input = document.createElement('input');
    if (item.type === 'boolean') {
      input.id = `tuning-${item.key}`;
      input.type = 'checkbox';
      label.htmlFor = input.id;
      label.className = 'checkbox-label';
      label.prepend(input);
      row.append(label);
      controls.set(item.key, { input });
    } else {
      input.id = `tuning-${item.key}-range`;
      input.type = 'range';
      label.htmlFor = input.id;
      const number = document.createElement('input');
      number.id = `tuning-${item.key}`;
      number.type = 'number';
      number.inputMode = 'decimal';
      for (const control of [input, number]) {
        control.min = item.min;
        control.max = item.max;
        control.step = item.step;
        control.setAttribute('aria-label', `${item.label} (${item.unit})`);
      }
      const pair = document.createElement('div');
      pair.className = 'tuning-inputs';
      const unit = document.createElement('span');
      unit.className = 'tuning-unit';
      unit.textContent = item.unit;
      pair.append(input, number, unit);
      row.append(label, pair);
      controls.set(item.key, { input, number });
    }
    groups.get(item.group).append(row);
  }
  return controls;
}

export function setupSettings(onChange) {
  const osMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const preset = document.querySelector('#motion-preset');
  const desktop = document.querySelector('#desktop-layout');
  const view = document.querySelector('#preview-view');
  const reduce = document.querySelector('#reduce-motion');
  const debug = document.querySelector('#show-debug');
  const panel = document.querySelector('#review-settings');
  const status = document.querySelector('#review-persistence-status');
  const tuningControls = makeTuningControls(document.querySelector('#tuning-controls'));
  const notice = message => { if (status) { status.textContent = message; status.hidden = !message; } };
  const unavailable = () => notice('Review settings cannot be saved in this browser.');
  let saved = DEFAULT_REVIEW_SETTINGS;
  try {
    const value = cookieValue(document.cookie);
    if (value !== null) {
      const parsed = parseReviewCookie(value);
      if (parsed) saved = parsed;
      else notice('Saved review settings could not be read. Defaults were restored.');
    }
    if (globalThis.navigator?.cookieEnabled === false) unavailable();
  } catch { unavailable(); }
  let state = applyReviewQuery(saved, location.search);
  let saveTimer;
  function applyTuningControls(editingNumber) {
    for (const item of TUNING_FIELDS) {
      const { input, number } = tuningControls.get(item.key);
      if (item.type === 'boolean') input.checked = state.tuning[item.key];
      else {
        input.value = String(state.tuning[item.key]);
        if (number !== editingNumber) number.value = input.value;
        input.setAttribute('aria-valuetext', `${state.tuning[item.key]} ${item.unit}`);
      }
    }
  }
  function applyControls() {
    preset.value = state.preset;
    desktop.value = state.desktop;
    view.value = state.view;
    reduce.checked = state.reduce;
    debug.checked = state.debug;
    panel.open = state.panelOpen;
    applyTuningControls();
  }
  applyControls();
  function attributes(maxAge) {
    return `; Max-Age=${maxAge}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  }
  function save() {
    clearTimeout(saveTimer);
    try {
      const encoded = encodeURIComponent(JSON.stringify({ version: REVIEW_COOKIE_VERSION, ...state }));
      document.cookie = `${REVIEW_COOKIE_NAME}=${encoded}${attributes(30 * 24 * 60 * 60)}`;
      if (cookieValue(document.cookie) !== encoded) { unavailable(); return; }
      notice('');
    } catch { unavailable(); }
  }
  function clearReviewQuery() {
    const url = new URL(location.href);
    reviewParams.forEach(key => url.searchParams.delete(key));
    history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }
  function notify(kind) { onChange({ kind }); }
  function setView(value) {
    if (!views.includes(value)) return;
    state = { ...state, view: value };
    view.value = value;
    clearReviewQuery();
    save();
    notify('layout');
  }
  view.addEventListener('change', () => setView(view.value));
  for (const [control, key, kind] of [[preset, 'preset', 'tuning'], [desktop, 'desktop', 'layout'], [reduce, 'reduce', 'motion'], [debug, 'debug', 'debug']]) {
    control.addEventListener('change', () => {
      state = { ...state, [key]: key === 'reduce' || key === 'debug' ? control.checked : control.value };
      if (key === 'preset') {
        state.tuning = applyMotionPreset(state.tuning, state.preset);
        applyTuningControls();
      }
      clearReviewQuery();
      save();
      notify(kind);
    });
  }
  for (const item of TUNING_FIELDS) {
    const { input, number } = tuningControls.get(item.key);
    for (const control of [input, number].filter(Boolean)) {
      const update = immediate => {
        // Leave an empty number editable until the value is committed.
        if (number === control && control.value === '' && !immediate) return;
        const value = item.type === 'boolean' ? control.checked : control.value === '' ? NaN : Number(control.value);
        state = { ...state, tuning: sanitizeTuning({ ...state.tuning, [item.key]: value }) };
        applyTuningControls(!immediate && control === number ? number : undefined);
        clearReviewQuery();
        clearTimeout(saveTimer);
        if (immediate) save();
        else saveTimer = setTimeout(save, 200);
        notify('tuning');
      };
      control.addEventListener('input', () => update(false));
      control.addEventListener('change', () => update(true));
    }
  }
  panel.addEventListener('toggle', () => {
    if (panel.open === state.panelOpen) return;
    state = { ...state, panelOpen: panel.open };
    clearReviewQuery();
    save();
  });
  document.querySelector('#reset-tuning').addEventListener('click', () => {
    state = { ...state, tuning: DEFAULT_TUNING };
    applyTuningControls();
    clearReviewQuery();
    save();
    notify('tuning');
  });
  document.querySelector('#reset-review-settings').addEventListener('click', () => {
    clearTimeout(saveTimer);
    state = { ...DEFAULT_REVIEW_SETTINGS, panelOpen: true };
    applyControls();
    clearReviewQuery();
    try {
      document.cookie = `${REVIEW_COOKIE_NAME}=${attributes(0)}`;
      if (cookieValue(document.cookie) !== null || globalThis.navigator?.cookieEnabled === false) unavailable();
      else notice('');
    } catch { unavailable(); }
    notify('layout');
  });
  osMotion.addEventListener('change', () => notify('motion'));
  panel.hidden = false;
  return {
    setView,
    get preset() { return state.preset; },
    get desktop() { return state.desktop; },
    get view() { return state.view; },
    get tuning() { return Object.freeze({ ...state.tuning }); },
    get reduced() { return osMotion.matches || state.reduce; },
    get debug() { return state.debug; },
  };
}
