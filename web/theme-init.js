// Runs before styles are painted so a saved dark theme never flashes white.
(function () {
  let choice = 'dark';
  try { choice = localStorage.getItem('explorer-theme') || choice; } catch {}
  if (!['light', 'dark', 'system'].includes(choice)) choice = 'dark';
  document.documentElement.dataset.theme = choice === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : choice;
  document.documentElement.dataset.themeChoice = choice;
})();
