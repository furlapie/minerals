(function () {
  const loader = document.getElementById('global-loader');
  if (!loader) return;
  let done = false;
  const hide = () => {
    if (done) return;
    done = true;
    loader.classList.add('hidden');
    document.documentElement.classList.remove('is-loading');
    setTimeout(() => loader.remove(), 600);
  };

  const waits = [document.fonts ? document.fonts.ready : Promise.resolve()];
  const hero = document.querySelector('#heroFrame img');
  if (hero && !hero.complete) {
    waits.push(new Promise(r => {
      hero.addEventListener('load', r, { once: true });
      hero.addEventListener('error', r, { once: true });
    }));
  }
  Promise.all(waits).then(hide);
  setTimeout(hide, 2500); // never keep the loader longer than this
})();

const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const root = document.documentElement;
    const nextTheme = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = nextTheme;

    try {
      localStorage.setItem('theme', nextTheme);
    } catch {}
  });
}