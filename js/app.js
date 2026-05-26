/* DiTareas — app.js */

const API_BASE = '';
let tasksCache = [];

async function apiJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Error de red');
  }

  return response.json();
}

async function getTasks() {
  const tasks = await apiJson('/tasks');
  tasksCache = tasks.map((task) => ({
    ...task,
    completed: Boolean(task.completed),
  }));
  return tasksCache;
}

async function createTask(task) {
  return apiJson('/tasks', {
    method: 'POST',
    body: JSON.stringify(task),
  });
}

async function updateTask(id, task) {
  return apiJson(`/tasks/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(task),
  });
}

async function deleteTaskRequest(id) {
  return apiJson(`/tasks/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
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

async function initDashboard() {
  const tasks = await getTasks();
  const pending = tasks.filter((t) => !t.completed).length;
  const completed = tasks.filter((t) => t.completed).length;

  const pEl = document.getElementById('pendingCount');
  const cEl = document.getElementById('completedCount');
  if (pEl) pEl.textContent = pending;
  if (cEl) cEl.textContent = completed;
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

function escHtml(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function initCreateForm() {
  const form = document.getElementById('taskForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('taskTitle').value.trim();
    if (!title) return;

    const newTask = {
      id: Date.now().toString(),
      title,
      description: document.getElementById('taskDescription').value.trim(),
      date: document.getElementById('taskDate').value,
      priority: document.getElementById('taskPriority').value,
      evidence: null,
      hours: '',
      completed: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };

    try {
      await createTask(newTask);
      showToast('Tarea creada correctamente');
      setTimeout(() => { window.location.href = 'tareas.html'; }, 900);
    } catch (error) {
      showToast(error.message || 'Error al crear la tarea');
    }
  });
}

async function initTaskList() {
  const tbody = document.querySelector('#taskTable tbody');
  if (!tbody) return;

  const editPanel = document.getElementById('editPanel');
  const editForm = document.getElementById('editTaskForm');
  const editFileInput = document.getElementById('editTaskEvidenceImage');
  const editFileName = document.getElementById('editFileName');
  const editPreviewWrap = document.getElementById('editEvidencePreviewWrap');
  const editPreview = document.getElementById('editEvidencePreview');
  let activeEditId = null;

  async function refreshTable() {
    const tasks = await getTasks();
    renderTable(tasks);
  }

  if (editForm) {
    editForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!activeEditId) return;

      const task = tasksCache.find((t) => String(t.id) === String(activeEditId));
      if (!task) return;

      const title = document.getElementById('editTaskTitle').value.trim();
      if (!title) return;

      const updatedTask = {
        ...task,
        title,
        description: document.getElementById('editTaskDescription').value.trim(),
        date: document.getElementById('editTaskDate').value,
        priority: document.getElementById('editTaskPriority').value,
        hours: document.getElementById('editTaskHours').value,
        completed: document.getElementById('editTaskStatus').value === 'true',
      };

      const file = editFileInput?.files?.[0];
      try {
        if (file) {
          updatedTask.evidence = await readFileAsDataURL(file);
        }
        await updateTask(activeEditId, updatedTask);
        showToast('Tarea actualizada correctamente');
        closeEditPanel();
        await refreshTable();
      } catch (error) {
        showToast(error.message || 'Error al actualizar la tarea');
      }
    });
  }

  if (editFileInput) {
    editFileInput.addEventListener('change', () => {
      const file = editFileInput.files[0];
      if (!file) {
        if (editFileName) {
          editFileName.textContent = '';
          editFileName.style.display = 'none';
        }
        return;
      }
      if (editFileName) {
        editFileName.textContent = `✓ ${file.name}`;
        editFileName.style.display = 'block';
      }
    });
  }

  const cancelEditBtn = document.getElementById('cancelEditBtn');
  if (cancelEditBtn) {
    cancelEditBtn.addEventListener('click', () => {
      closeEditPanel();
    });
  }

  function closeEditPanel() {
    activeEditId = null;
    if (editPanel) editPanel.style.display = 'none';
    if (editFileInput) editFileInput.value = '';
    if (editFileName) {
      editFileName.textContent = '';
      editFileName.style.display = 'none';
    }
    if (editPreviewWrap) editPreviewWrap.style.display = 'none';
  }

  window.openEditTask = (id) => {
    const task = tasksCache.find((t) => String(t.id) === String(id));
    if (!task || !editPanel) return;

    activeEditId = id;
    editPanel.style.display = 'block';
    document.getElementById('editTaskTitle').value = task.title || '';
    document.getElementById('editTaskDescription').value = task.description || '';
    document.getElementById('editTaskDate').value = task.date || '';
    document.getElementById('editTaskPriority').value = task.priority || 'Media';
    document.getElementById('editTaskHours').value = task.hours || '';
    document.getElementById('editTaskStatus').value = task.completed ? 'true' : 'false';

    if (editFileInput) editFileInput.value = '';
    if (editFileName) {
      editFileName.textContent = '';
      editFileName.style.display = 'none';
    }

    if (task.evidence && editPreview) {
      editPreview.src = task.evidence;
      if (editPreviewWrap) editPreviewWrap.style.display = 'block';
    } else if (editPreviewWrap) {
      editPreviewWrap.style.display = 'none';
    }

    window.scrollTo({ top: editPanel.offsetTop - 20, behavior: 'smooth' });
  };

  async function renderTable(tasks) {
    const badge = document.getElementById('taskCountBadge');
    const empty = document.getElementById('emptyState');
    const table = document.getElementById('taskTable');

    if (badge) badge.textContent = `${tasks.length} ${tasks.length === 1 ? 'tarea' : 'tareas'}`;

    if (tasks.length === 0) {
      if (table) table.style.display = 'none';
      if (empty) empty.style.display = 'block';
      tbody.innerHTML = '';
      return;
    }

    if (table) table.style.display = '';
    if (empty) empty.style.display = 'none';

    tbody.innerHTML = tasks
      .map((task) => `
        <tr id="row-${task.id}">
          <td class="task-name">${escHtml(task.title)}</td>
          <td class="task-desc">${escHtml(task.description) || '<span style="color:var(--ink-3);font-style:italic">Sin descripción</span>'}</td>
          <td>${formatDate(task.date)}</td>
          <td>${priorityBadge(task.priority)}</td>
          <td>${statusBadge(task.completed)}</td>
          <td>
            ${task.evidence
              ? `<div class="evidence-cell"><img class="evidence-thumb" src="${task.evidence}" alt="Evidencia"><button class="btn btn-sm btn-secondary" type="button" onclick="downloadEvidence('${task.id}')" title="Descargar evidencia">⬇</button></div>`
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
              <button class="btn btn-sm btn-secondary" onclick="openEditTask('${task.id}')" title="Editar tarea">✎</button>
              ${!task.completed
                ? `<button class="btn btn-sm btn-secondary" onclick="markDone('${task.id}')" title="Marcar completada">✓</button>`
                : `<button class="btn btn-sm btn-ghost" onclick="markPending('${task.id}')" title="Marcar pendiente">↺</button>`}
              <button class="btn btn-sm btn-danger" onclick="deleteTask('${task.id}')" title="Eliminar">✕</button>
            </div>
          </td>
        </tr>
      `)
      .join('');

    tbody.querySelectorAll('.hours-input').forEach((input) => {
      input.addEventListener('change', async () => {
        const id = input.dataset.id;
        const task = tasksCache.find((t) => String(t.id) === String(id));
        if (!task) return;
        task.hours = input.value;
        try {
          await updateTask(id, task);
          showToast('Horas actualizadas');
        } catch (error) {
          showToast(error.message || 'Error al guardar horas');
        }
      });
    });
  }

  window.deleteTask = async (id) => {
    try {
      await deleteTaskRequest(id);
      showToast('Tarea eliminada');
      await refreshTable();
    } catch (error) {
      showToast(error.message || 'Error al eliminar la tarea');
    }
  };

  window.markDone = async (id) => {
    const task = tasksCache.find((t) => String(t.id) === String(id));
    if (!task) return;
    task.completed = true;
    task.completedAt = new Date().toISOString();
    try {
      await updateTask(id, task);
      showToast('Tarea marcada como completada');
      await refreshTable();
    } catch (error) {
      showToast(error.message || 'Error al marcar la tarea');
    }
  };

  window.markPending = async (id) => {
    const task = tasksCache.find((t) => String(t.id) === String(id));
    if (!task) return;
    task.completed = false;
    task.completedAt = null;
    try {
      await updateTask(id, task);
      showToast('Tarea marcada como pendiente');
      await refreshTable();
    } catch (error) {
      showToast(error.message || 'Error al marcar la tarea');
    }
  };

  window.downloadEvidence = (id) => {
    const task = tasksCache.find((t) => String(t.id) === String(id));
    if (!task || !task.evidence) return;
    const link = document.createElement('a');
    link.href = task.evidence;
    link.download = `evidencia-${id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  await refreshTable();
}

(function initializePage() {
  const page = document.body.dataset.page;
  if (page === 'dashboard') {
    initDashboard();
  } else if (page === 'create') {
    initCreateForm();
  } else if (page === 'tasks') {
    initTaskList();
  }
})();
