/* Opt-in, browser-local diagnostics for the isolated Safari QA preview. */
(() => {
  if (new URLSearchParams(location.search).get('qa') !== '1') return;
  const limit = 1200;
  let enabled = true, dropped = 0, attached, panel, summary, output, status, revision = null, lastLayout = null;
  let lastMouseMove = -Infinity;
  const events = [], inputIds = new WeakMap();
  let inputSequence = 0;
  const session = globalThis.crypto?.randomUUID?.() || 'qa-' + Date.now();
  const startedAt = new Date().toISOString();
  const element = node => node?.nodeType === 1 ? node.tagName.toLowerCase() + (node.id ? '#' + node.id.slice(0, 80) : '') : 'unknown';
  const privateTarget = target => Boolean(target?.closest?.('#contact-dialog,input,textarea,[contenteditable],#qa-session'));
  function record(type, detail = {}) {
    if (type === 'layout') lastLayout = detail;
    if (!enabled) return;
    events.push({ at: Math.round(performance.now() * 100) / 100, type, ...detail });
    if (events.length > limit) { events.shift(); dropped++; }
  }
  function snapshot() {
    const viewport = window.visualViewport, stage = document.querySelector('#deck-stage');
    const readButton = document.querySelector('#read-mode'), preview = document.querySelector('#preview-view');
    const settings = attached?.settings;
    return {
      mode: document.body?.dataset.mode || 'startup',
      modeNote: document.querySelector('#mode-note')?.textContent || '',
      cardButtonDisabled: readButton?.disabled ?? null,
      previewSelectorDisabled: preview?.disabled ?? null,
      requestedView: settings?.view ?? preview?.value ?? null,
      reducedOS: matchMedia('(prefers-reduced-motion: reduce)').matches,
      reducedReview: document.querySelector('#reduce-motion')?.checked ?? null,
      reducedEffective: settings?.reduced ?? null,
      viewport: { innerWidth, innerHeight, clientWidth: document.documentElement.clientWidth, clientHeight: document.documentElement.clientHeight,
        visualWidth: viewport?.width, visualHeight: viewport?.height, scale: viewport?.scale, offsetTop: viewport?.offsetTop, offsetLeft: viewport?.offsetLeft },
      orientation: screen.orientation?.type ?? (innerWidth > innerHeight ? 'landscape' : 'portrait'),
      rootFontSize: getComputedStyle(document.documentElement).fontSize,
      fonts: document.fonts?.status ?? 'unavailable',
      features: { pointerEvents: 'PointerEvent' in window, resizeObserver: 'ResizeObserver' in window, inert: 'inert' in HTMLElement.prototype, animate: Boolean(Element.prototype.animate), visualViewport: Boolean(viewport) },
      deck: { state: attached?.deck.state ?? stage?.dataset.deckState, index: attached?.deck.index, requestedIndex: attached?.deck.requestedIndex,
        position: attached?.deck.position, gateRemaining: attached?.deck.gateRemaining, lastRejection: attached?.deck.lastRejection },
      tuning: settings?.tuning ?? null,
      layoutDecision: lastLayout,
    };
  }
  function report() {
    return { session, startedAt, page: location.origin + location.pathname, browser: navigator.userAgent, platform: navigator.platform,
      revision, logging: enabled, limit, dropped, snapshot: snapshot(), counts: events.reduce((all, item) => { all[item.type] = (all[item.type] || 0) + 1; return all; }, {}), events: events.slice() };
  }
  function refresh() {
    if (!panel) return;
    const state = snapshot(), layout = state.layoutDecision, geometry = layout?.geometry;
    summary.textContent = 'QA session · ' + (enabled ? 'recording' : 'paused');
    const reasons = [
      state.reducedOS ? 'OS requests reduced motion' : '',
      state.reducedReview ? 'Review Reduce motion is checked' : '',
      state.viewport.visualHeight < 540 ? 'Usable viewport is below 540px' : '',
      geometry && geometry.neededHeight > geometry.limit ? 'Card content exceeds available height' : '',
      state.requestedView === 'page' ? 'Page view is selected' : '',
    ].filter(Boolean);
    const recent = events.slice(-8).map(e => Math.round(e.at) + 'ms ' + e.type + (e.reason ? ' · ' + e.reason : ''));
    output.textContent = [
      'View: ' + state.mode + ' · ' + state.modeNote,
      'Card button disabled: ' + state.cardButtonDisabled,
      'OS reduced motion: ' + state.reducedOS + ' · Review reduced motion: ' + state.reducedReview,
      'Usable viewport: ' + Math.round(state.viewport.visualWidth || innerWidth) + ' × ' + Math.round(state.viewport.visualHeight || innerHeight) + ' · zoom ' + (state.viewport.scale ?? 1),
      'Layout checks: ' + (reasons.join('; ') || 'No blocking check reported'),
      geometry ? 'Card requirement / limit: ' + geometry.neededHeight + ' / ' + geometry.limit + 'px\n' + geometry.cards.map(card => card.id + ': ' + card.neededHeight + 'px').join(' · ') : 'Card fit was not evaluated in the last layout pass.',
      'Deck: ' + (state.deck.state ?? 'disabled') + ' · requested card ' + ((state.deck.requestedIndex ?? 0) + 1) + ' · gate ' + Math.round(state.deck.gateRemaining || 0) + 'ms',
      events.length + ' events retained · ' + dropped + ' older events dropped',
      recent.join('\n'),
    ].join('\n\n');
  }
  globalThis.__cardQA = {
    record, snapshot, report,
    attach(value) { attached = value; record('app-ready', { view: value.settings.view, tuning: value.settings.tuning, reducedOS: matchMedia('(prefers-reduced-motion: reduce)').matches, reducedReview: document.querySelector('#reduce-motion')?.checked, reducedEffective: value.settings.reduced }); refresh(); },
  };
  // Capture failures before the application module starts. No input values or selected text are read.
  window.addEventListener('error', event => record('error', { name: event.error?.name || 'resource', message: String(event.message || 'Resource failed').slice(0, 240), file: event.filename ? event.filename.split('/').pop() : element(event.target), line: event.lineno }), true);
  window.addEventListener('unhandledrejection', event => record('rejection', { name: event.reason?.name || 'unhandled', message: String(event.reason?.message || 'Unhandled promise rejection').slice(0, 240) }));
  for (const type of ['resize', 'focus', 'blur', 'pageshow', 'pagehide']) window.addEventListener(type, () => record('window/' + type, { width: innerWidth, height: innerHeight }));
  document.addEventListener('visibilitychange', () => record('visibility', { hidden: document.hidden }));
  window.visualViewport?.addEventListener('resize', () => record('viewport/resize', { width: visualViewport.width, height: visualViewport.height, scale: visualViewport.scale }));
  document.addEventListener('selectionchange', () => record('selection', { active: !window.getSelection()?.isCollapsed }));
  const capture = event => {
    if (privateTarget(event.target)) return;
    if (event.type === 'pointermove' && event.pointerType === 'mouse' && !event.buttons) {
      if (performance.now() - lastMouseMove < 50) return;
      lastMouseMove = performance.now();
    }
    if (!enabled) return;
    const target = element(event.target), card = event.target.closest?.('.card');
    const detail = { target, card: card?.id, cardInert: card?.inert, trusted: event.isTrusted, x: event.clientX, y: event.clientY,
      pointerType: event.pointerType, pointerId: event.pointerId, stageInPath: event.composedPath().some(node => node?.id === 'deck-stage') };
    if (event.type === 'wheel') Object.assign(detail, { deltaX: event.deltaX, deltaY: event.deltaY, deltaMode: event.deltaMode, cancelable: event.cancelable,
      ctrl: event.ctrlKey, meta: event.metaKey, shift: event.shiftKey, hit: element(document.elementFromPoint(event.clientX, event.clientY)),
      path: event.composedPath().filter(node => node?.nodeType === 1).slice(0, 7).map(element) });
    const inputId = ++inputSequence;
    inputIds.set(event, inputId);
    record('input/' + event.type, { inputId, ...detail });
  };
  // A microtask from document capture can run before a trusted event bubbles.
  // Read the final prevention/state at window bubble, after the deck handler.
  for (const type of ['wheel', 'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'gotpointercapture', 'lostpointercapture']) {
    document.addEventListener(type, capture, { capture: true, passive: true });
    window.addEventListener(type, event => {
      const inputId = inputIds.get(event);
      if (!inputId) return;
      record('result/' + event.type, { inputId, target: element(event.target), prevented: event.defaultPrevented, state: document.querySelector('#deck-stage')?.dataset.deckState,
        position: document.querySelector('#deck-stage')?.dataset.deckPosition, requestedIndex: attached?.deck.requestedIndex });
    }, { passive: true });
  }
  function mount() {
    const style = document.createElement('style');
    style.textContent = '#qa-session{position:fixed;left:10px;bottom:10px;z-index:10000;max-width:min(94vw,520px);font:13px/1.45 system-ui;color:#25332b;background:#fafbf7f2;border:1px solid #b9c5b8;border-radius:10px;box-shadow:0 4px 20px #17251a20}#qa-session>summary{padding:9px 12px;cursor:pointer}#qa-session .qa-body{padding:0 12px 12px;max-height:65vh;overflow:auto}#qa-session p{margin:8px 0}#qa-session pre{font:12px/1.45 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere}#qa-session button{font:inherit;color:inherit;background:#fff;border:1px solid #aab8aa;border-radius:5px;padding:6px 9px;margin:3px}#qa-session button:focus-visible{outline:2px solid #273d2c;outline-offset:2px}';
    document.head.append(style);
    panel = document.createElement('details'); panel.id = 'qa-session';
    summary = document.createElement('summary'); summary.textContent = 'QA session · recording'; panel.append(summary);
    const body = document.createElement('div'); body.className = 'qa-body';
    const notice = document.createElement('p'); notice.textContent = 'Diagnostic preview. Logging stays in this tab, is bounded, and excludes form values. Nothing is uploaded. Reload clears the session.';
    const pause = document.createElement('button'); pause.type = 'button'; pause.textContent = 'Pause logging';
    pause.onclick = () => { enabled = !enabled; pause.textContent = enabled ? 'Pause logging' : 'Resume logging'; refresh(); };
    const clear = document.createElement('button'); clear.type = 'button'; clear.textContent = 'Clear session';
    clear.onclick = () => { events.length = 0; dropped = 0; refresh(); };
    const captureButton = document.createElement('button'); captureButton.type = 'button'; captureButton.textContent = 'Capture snapshot';
    captureButton.onclick = () => { record('snapshot', snapshot()); refresh(); };
    const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = 'Copy diagnostic report';
    copy.onclick = async () => {
      const text = JSON.stringify(report(), null, 2);
      try { await navigator.clipboard.writeText(text); status.textContent = 'Report copied. You can paste it into the QA conversation.'; }
      catch {
        const field = document.createElement('textarea'); field.value = text; field.readOnly = true; field.setAttribute('aria-label', 'Diagnostic report'); field.style.cssText = 'width:100%;height:140px'; body.append(field); field.focus(); field.select();
        status.textContent = 'Clipboard unavailable. Select and copy the report below.';
      }
    };
    status = document.createElement('p'); status.setAttribute('role', 'status');
    output = document.createElement('pre'); output.setAttribute('aria-live', 'off');
    body.append(notice, pause, clear, captureButton, copy, status, output); panel.append(body); document.body.append(panel);
    panel.addEventListener('toggle', refresh);
    setInterval(() => { if (panel.open) refresh(); }, 500);
    refresh();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
  fetch('./revision.json').then(response => response.ok ? response.json() : null).then(value => { revision = value?.revision || null; record('revision', { revision }); }).catch(() => record('revision-unavailable'));
  record('session-start', { session });
})();
