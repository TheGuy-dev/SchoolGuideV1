(() => {
    const speed = 0.3;
    window.addEventListener('scroll', () => {
      // move both layers in sync
      document.body.style.backgroundPositionY =
        `${-window.pageYOffset * speed}px, ${-window.pageYOffset * speed}px`;
    });
  })();

// On load: apply saved settings
const htmlEl = document.documentElement;
const storedTheme = localStorage.getItem('theme');
if (storedTheme === 'dark') htmlEl.classList.add('dark');
const storedAccent = localStorage.getItem('accent');
if (storedAccent) document.documentElement.style.setProperty('--clr-accent', storedAccent);

// Toggle dark mode
document.getElementById('theme-toggle').addEventListener('click', () => {
  const isDark = htmlEl.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
});

// Accent color picker
document.getElementById('accent-picker').addEventListener('click', () => {
  const picker = document.createElement('input');
  picker.type = 'color';
  picker.value = getComputedStyle(htmlEl).getPropertyValue('--clr-accent').trim();
  picker.style.position = 'absolute';
  picker.oninput = () => {
    htmlEl.style.setProperty('--clr-accent', picker.value);
    localStorage.setItem('accent', picker.value);
  };
  picker.onchange = () => picker.remove();
  document.body.appendChild(picker);
  picker.click();
});
