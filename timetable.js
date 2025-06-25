// public/JAVASCRIPT/timetable.js
document.addEventListener('DOMContentLoaded', () => {
  const bankList  = document.querySelector('.bank-list');
  const addBtn    = document.getElementById('add-subject-btn');
  const clearBtn  = document.getElementById('clear-subjects-btn');
  const nameInput = document.getElementById('new-subject-name');
  let draggedItem = null;

  // Enter key adds subject
  nameInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') addBtn.click();
  });

  // 1. Load & render subjects
  const DEFAULT_SUBJECTS = ['Math','English','Science','Free Session'];
  const subjects = JSON.parse(localStorage.getItem('subjects') || 'null')
                   || DEFAULT_SUBJECTS.map(n => ({name: n, color: ''}));
  subjects.forEach(renderSubject);

  // 2. Load & populate saved timetable
  const savedTT = JSON.parse(localStorage.getItem('timetable') || '{}');
  Object.entries(savedTT).forEach(([key, {name, color}]) => {
    const [day, session] = key.split('-');
    const cell = document.querySelector(`.cell[data-day="${day}"][data-session="${session}"]`);
    if (cell) placeSubject(cell, {name, color}, false);
  });

  // 3. Add New Subject
  addBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) return;
    const subj = {name, color: ''};
    subjects.push(subj);
    localStorage.setItem('subjects', JSON.stringify(subjects));
    renderSubject(subj);
    nameInput.value = '';
  });

  // 4. Clear All Subjects
  clearBtn.addEventListener('click', () => {
    localStorage.removeItem('subjects');
    bankList.innerHTML = '';
  });

  // Render one bank button
  function renderSubject({name, color}) {
    const btn = document.createElement('button');
    btn.className        = 'subject-item';
    btn.draggable        = true;
    btn.textContent      = name;
    btn.dataset.subject  = name;
    if (color) btn.style.background = color;
    bankList.appendChild(btn);

    btn.addEventListener('dragstart', () => draggedItem = btn);
    btn.addEventListener('dragend', () => draggedItem = null);
  }

  // 5. Setup cells for drop
  document.querySelectorAll('.cell').forEach(cell => {
    cell.addEventListener('dragover', e => {
      e.preventDefault();
      cell.classList.add('highlight');
    });
    cell.addEventListener('dragleave', () => cell.classList.remove('highlight'));
    cell.addEventListener('drop', () => {
      cell.classList.remove('highlight');
      if (!cell.querySelector('.subject-item') && draggedItem) {
        placeSubject(cell, {
          name: draggedItem.dataset.subject,
          color: draggedItem.style.background || ''
        }, true);
      }
    });
  });

  // 6. Place into a cell (and optionally save)
  function placeSubject(cell, {name, color}, save = true) {
    // Subject tile
    const item = document.createElement('div');
    item.className = 'subject-item';
    item.textContent = name;
    item.style.background = color;
    item.style.color = getComputedStyle(document.documentElement)
                      .getPropertyValue('--clr-text').trim();
    cell.appendChild(item);

    // Color button
    const colorBtn = document.createElement('button');
    colorBtn.textContent = '🎨';
    colorBtn.className   = 'color-btn';
    colorBtn.addEventListener('click', () => {
      const picker = document.createElement('input');
      picker.type  = 'color';
      picker.value = color || '#ffffff';
      picker.oninput = () => {
        item.style.background = picker.value;
        if (save) saveTimetable();
      };
      picker.onchange = () => picker.remove();
      document.body.appendChild(picker);
      picker.click();
    });
    cell.appendChild(colorBtn);

    // Delete button (trash icon)
    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑️';
    delBtn.className   = 'delete-btn';
    delBtn.addEventListener('click', () => {
      item.remove();
      colorBtn.remove();
      delBtn.remove();
      if (save) saveTimetable();
    });
    cell.appendChild(delBtn);

    // Save after placing
    if (save) saveTimetable();
  }

  // 7. Persist timetable
  function saveTimetable() {
    const data = {};
    document.querySelectorAll('.cell').forEach(cell => {
      const sub = cell.querySelector('.subject-item');
      if (sub) {
        const key = `${cell.dataset.day}-${cell.dataset.session}`;
        data[key] = {
          name: sub.textContent,
          color: sub.style.background || ''
        };
      }
    });
    localStorage.setItem('timetable', JSON.stringify(data));
  }
});
