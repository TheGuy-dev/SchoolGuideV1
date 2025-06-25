// public/JAVASCRIPT/main.js
document.addEventListener('DOMContentLoaded', () => {
  const htmlEl     = document.documentElement;
  const themeBtn   = document.getElementById('theme-toggle');
  const accentBtn  = document.getElementById('accent-picker');

  // --- 1. Initialize theme from localStorage ---
  const savedTheme = localStorage.getItem('theme');
  const isDark     = savedTheme === 'dark';
  htmlEl.classList.toggle('dark', isDark);

  // --- 2. Set the toggle button icon ---
  if (themeBtn) {
    themeBtn.textContent = isDark ? '☀️' : '🌙';
  }

  // --- 3. Recolor placed subjects to match current text color ---
  function recolorBoxes() {
    const textColor = getComputedStyle(htmlEl).getPropertyValue('--clr-text').trim();
    document.querySelectorAll('.cell .subject-item').forEach(item => {
      item.style.color = textColor;
    });
  }
  recolorBoxes();

  // --- 4. Hook the theme toggle ---
  themeBtn?.addEventListener('click', () => {
    const nowDark = htmlEl.classList.toggle('dark');
    localStorage.setItem('theme', nowDark ? 'dark' : 'light');
    themeBtn.textContent = nowDark ? '☀️' : '🌙';
    recolorBoxes();
  });

  // --- 5. Accent color picker ---
  accentBtn?.addEventListener('click', () => {
    const picker = document.createElement('input');
    picker.type  = 'color';
    picker.value = getComputedStyle(htmlEl).getPropertyValue('--clr-accent').trim();
    picker.oninput = () => {
      htmlEl.style.setProperty('--clr-accent', picker.value);
      localStorage.setItem('accent', picker.value);
    };
    picker.onchange = () => picker.remove();
    document.body.appendChild(picker);
    picker.click();
  });

  // --- 6. Show/hide password toggle ---
  const toggle = document.querySelector('#togglePassword');
  const input  = document.querySelector('#password');

  if (toggle && input) {
    toggle.addEventListener('click', () => {
      const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
      input.setAttribute('type', type);
      toggle.textContent = type === 'text' ? '🙈' : '👁️';
    });
  }

  // --- 7. Password strength indicator ---
  const strengthBar = document.createElement('div');
  strengthBar.className = 'pw-strength';
  input?.parentNode?.appendChild(strengthBar);

  input?.addEventListener('input', () => {
    const val = input.value;
    let score = 0;
    if (val.length >= 8) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[a-z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    const meter = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
    strengthBar.textContent = meter[score];
    strengthBar.style.color = ['#d00','#d60','#e90','#6c3','#3a3','#080'][score];
  });
});
