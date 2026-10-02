export function setupSettings(onChange) {
  const params = new URLSearchParams(location.search);
  const osMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const preset = document.querySelector('#motion-preset');
  const desktop = document.querySelector('#desktop-layout');
  const reduce = document.querySelector('#reduce-motion');
  const debug = document.querySelector('#show-debug');
  preset.value = ['crisp', 'gentle'].includes(params.get('preset')) ? params.get('preset') : 'balanced';
  desktop.value = params.get('desktop') === 'conventional' ? 'conventional' : 'staggered';
  reduce.checked = params.get('motion') === 'reduce';
  debug.checked = params.get('debug') === '1';
  const settings = {
    get preset() { return preset.value; },
    get desktop() { return desktop.value; },
    get reduced() { return osMotion.matches || reduce.checked; },
    get debug() { return debug.checked; },
  };
  [preset, desktop, reduce, debug].forEach(control => control.addEventListener('change', onChange));
  osMotion.addEventListener('change', onChange);
  document.querySelector('#review-settings').hidden = false;
  return settings;
}
