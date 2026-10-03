export const REVIEW_COOKIE_NAME = 'lynn_review_settings';
export const REVIEW_COOKIE_VERSION = 1;
export const DEFAULT_REVIEW_SETTINGS = Object.freeze({ preset: 'balanced', desktop: 'staggered', reduce: false, debug: false, panelOpen: false });
const reviewParams = ['preset', 'desktop', 'motion', 'debug'];
const presets = ['balanced', 'crisp', 'gentle'];
const desktops = ['staggered', 'conventional'];

export function validateReviewSettings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== REVIEW_COOKIE_VERSION
    || !presets.includes(value.preset) || !desktops.includes(value.desktop)
    || typeof value.reduce !== 'boolean' || typeof value.debug !== 'boolean' || typeof value.panelOpen !== 'boolean') return null;
  return { preset: value.preset, desktop: value.desktop, reduce: value.reduce, debug: value.debug, panelOpen: value.panelOpen };
}

// null covers both a missing cookie and an invalid payload. The caller can report an invalid saved value separately.
export function parseReviewCookie(value) {
  try { return validateReviewSettings(JSON.parse(decodeURIComponent(value))); }
  catch { return null; }
}

export function applyReviewQuery(saved = DEFAULT_REVIEW_SETTINGS, search = '') {
  const state = { ...saved };
  const params = new URLSearchParams(search);
  if (presets.includes(params.get('preset'))) state.preset = params.get('preset');
  if (desktops.includes(params.get('desktop'))) state.desktop = params.get('desktop');
  if (['reduce', 'normal'].includes(params.get('motion'))) state.reduce = params.get('motion') === 'reduce';
  if (['0', '1'].includes(params.get('debug'))) state.debug = params.get('debug') === '1';
  return state;
}

function cookieValue(cookieText) {
  const entry = cookieText.split(';').map(value => value.trim()).find(value => value.startsWith(`${REVIEW_COOKIE_NAME}=`));
  return entry ? entry.slice(REVIEW_COOKIE_NAME.length + 1) : null;
}

export function setupSettings(onChange) {
  const osMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const preset = document.querySelector('#motion-preset');
  const desktop = document.querySelector('#desktop-layout');
  const reduce = document.querySelector('#reduce-motion');
  const debug = document.querySelector('#show-debug');
  const panel = document.querySelector('#review-settings');
  const status = document.querySelector('#review-persistence-status');
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
  function applyControls() {
    preset.value = state.preset;
    desktop.value = state.desktop;
    reduce.checked = state.reduce;
    debug.checked = state.debug;
    panel.open = state.panelOpen;
  }
  applyControls();
  function readControls() {
    state = { preset: preset.value, desktop: desktop.value, reduce: reduce.checked, debug: debug.checked, panelOpen: panel.open };
  }
  function attributes(maxAge) {
    return `; Max-Age=${maxAge}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  }
  function save() {
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
  [preset, desktop, reduce, debug].forEach(control => control.addEventListener('change', () => {
    readControls();
    clearReviewQuery();
    save();
    onChange();
  }));
  panel.addEventListener('toggle', () => {
    // Browsers also queue a toggle after restoring or resetting the panel programmatically.
    if (panel.open === state.panelOpen) return;
    readControls();
    clearReviewQuery();
    save();
  });
  document.querySelector('#reset-review-settings')?.addEventListener('click', () => {
    state = { ...DEFAULT_REVIEW_SETTINGS, panelOpen: true };
    applyControls();
    clearReviewQuery();
    try {
      document.cookie = `${REVIEW_COOKIE_NAME}=${attributes(0)}`;
      if (cookieValue(document.cookie) !== null || globalThis.navigator?.cookieEnabled === false) unavailable();
      else notice('');
    } catch { unavailable(); }
    onChange();
  });
  osMotion.addEventListener('change', onChange);
  panel.hidden = false;
  return {
    get preset() { return preset.value; },
    get desktop() { return desktop.value; },
    get reduced() { return osMotion.matches || reduce.checked; },
    get debug() { return debug.checked; },
  };
}
