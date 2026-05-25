/* DiTareas — app.js */

const STORAGE_KEY = 'ditareas_tasks';

function getTasks() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function saveTasks(tasks) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function priorityBadge(p) {
  const map = { Alta: 'badge-alta', Media: 'badge-media', Baja: 'badge-baja' };
  return `<span class="badge ${map[p] || 'badge-baja'}">${p}</span>`;
}

function statusBadge(done) {
  return done
    ? '<span class="badge badge-done">✓ Completada</span>'
    : '<span class="badge badge-pending">● Pendiente</span>';
}

/* ── DASHBOARD ─────────────────────────────────── */

function initDashboard() {
  const tasks = getTasks();
  const pending   = tasks.filter(t => !t.done).length;
  const completed = tasks.filter(t =>  t.done).length;

  const pEl = document.getElementById('pendingCount');
  const cEl = document.getElementById('completedCount');
  if (pEl) pEl.textContent   = pending;
  if (cEl) cEl.textContent   = completed;
}

/* ── CREATE FORM ───────────────────────────────── */

function initCreateForm() {
  const form = document.getElementById('taskForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const title = document.getElementById('taskTitle').value.trim();
    if (!title) return;

    const fileInput = document.getElementById('taskEvidenceImage');
    const file = fileInput?.files[0];

    const saveTask = (imageData) => {
      const tasks = getTasks();
      tasks.push({
        id: Date.now(),
        title,
        description: document.getElementById('taskDescription').value.trim(),
        date: document.getElementById('taskDate').value,
        priority: document.getElementById('taskPriority').value,
        done: false,
        hours: '',
        evidence: imageData || null,
      });
      saveTasks(tasks);
      showToast('Tarea creada correctamente');
      setTimeout(() => window.location.href = 'tareas.html', 900);
    };

    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => saveTask(ev.target.result);
      reader.readAsDataURL(file);
    } else {
      saveTask(null);
    }
  });
}

/* ── TASK LIST ─────────────────────────────────── */

function initTaskList() {
  const tbody = document.querySelector('#taskTable tbody');
  if (!tbody) return;

  renderTable();

  function renderTable() {
    const tasks = getTasks();
    const badge = document.getElementById('taskCountBadge');
    const empty = document.getElementById('emptyState');
    const table = document.getElementById('taskTable');

    if (badge) badge.textContent = `${tasks.length} ${tasks.length === 1 ? 'tarea' : 'tareas'}`;

    if (tasks.length === 0) {
      if (table) table.style.display = 'none';
      if (empty) empty.style.display = 'block';
      return;
    }

    if (table) table.style.display = '';
    if (empty) empty.style.display = 'none';

    tbody.innerHTML = tasks.map(task => `
      <tr id="row-${task.id}">
        <td class="task-name">${escHtml(task.title)}</td>
        <td class="task-desc">${escHtml(task.description) || '<span style="color:var(--ink-3);font-style:italic">Sin descripción</span>'}</td>
        <td>${formatDate(task.date)}</td>
        <td>${priorityBadge(task.priority)}</td>
        <td>${statusBadge(task.done)}</td>
        <td>
          ${task.evidence
            ? `<img class="evidence-thumb" src="${task.evidence}" alt="Evidencia">`
            : '<span class="no-evidence">Sin evidencia</span>'}
        </td>
        <td>
          <input
            class="hours-input"
            type="number"
            min="0"
            step="0.5"
            placeholder="0"
            value="${escHtml(task.hours)}"
            data-id="${task.id}"
            title="Horas dedicadas"
          />
        </td>
        <td>
          <div class="action-group">
            ${!task.done
              ? `<button class="btn btn-sm btn-secondary" onclick="markDone(${task.id})" title="Marcar completada">✓</button>`
              : `<button class="btn btn-sm btn-ghost" onclick="markPending(${task.id})" title="Marcar pendiente">↺</button>`}
            <button class="btn btn-sm btn-danger" onclick="deleteTask(${task.id})" title="Eliminar">✕</button>
          </div>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.hours-input').forEach(input => {
      input.addEventListener('change', () => {
        const id = Number(input.dataset.id);
        const tasks = getTasks();
        const task = tasks.find(t => t.id === id);
        if (task) {
          task.hours = input.value;
          saveTasks(tasks);
        }
      });
    });
  }

  window.markDone = (id) => {
    const tasks = getTasks();
    const t = tasks.find(t => t.id === id);
    if (t) { t.done = true; saveTasks(tasks); renderTable(); showToast('Tarea completada ✓'); }
  };

  window.markPending = (id) => {
    const tasks = getTasks();
    const t = tasks.find(t => t.id === id);
    if (t) { t.done = false; saveTasks(tasks); renderTable(); showToast('Tarea marcada como pendiente'); }
  };

  window.deleteTask = (id) => {
    if (!confirm('¿Eliminar esta tarea?')) return;
    const tasks = getTasks().filter(t => t.id !== id);
    saveTasks(tasks);
    renderTable();
    showToast('Tarea eliminada');
  };
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── INIT ──────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  const page = document.body.dataset.page;
  if (page === 'dashboard') initDashboard();
  if (page === 'create')    initCreateForm();
  if (page === 'tasks')     initTaskList();
});