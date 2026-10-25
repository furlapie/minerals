// Add loading class immediately to prevent FOUC
document.documentElement.classList.add('is-loading');
    
window.addEventListener('load', () => {
    const loader = document.getElementById('global-loader');
    if (loader) {
    loader.classList.add('hidden');
    document.documentElement.classList.remove('is-loading');
    // Remove from DOM after fade out
    setTimeout(() => loader.remove(), 600);
    }
});

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