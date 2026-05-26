/* DiTareas — app.js */

const API_BASE = '';
let tasksCache = [];
let currentFilter = 'todas';  // Track current filter

/* ─── Actualizar estado activo del navbar dinámicamente ─── */
function setActiveNavLink() {
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('.site-nav a');
  
  navLinks.forEach((link) => {
    link.classList.remove('active');
    const href = link.getAttribute('href');
    if (href === currentPath || (currentPath === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
}

// Ejecutar al cargar la página
document.addEventListener('DOMContentLoaded', setActiveNavLink);

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

function normalizeEvidence(evidence) {
  if (!evidence) return [];
  if (Array.isArray(evidence)) return evidence;
  if (typeof evidence === 'string') {
    try {
      const parsed = JSON.parse(evidence);
      return Array.isArray(parsed) ? parsed : [{ name: 'Evidencia', data: evidence }];
    } catch {
      return [{ name: 'Evidencia', data: evidence }];
    }
  }
  return [];
}

async function getTasks() {
  const tasks = await apiJson('/tasks');
  tasksCache = tasks.map((task) => ({
    ...task,
    completed: Boolean(task.completed),
    evidence: normalizeEvidence(task.evidence),
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
  const evidenceInput = document.getElementById('taskEvidenceImages');
  const evidenceName = document.getElementById('taskEvidenceFileNames');
  if (!form) return;

  if (evidenceInput && evidenceName) {
    evidenceInput.addEventListener('change', () => {
      const files = Array.from(evidenceInput.files);
      if (files.length === 0) {
        evidenceName.textContent = '';
        evidenceName.style.display = 'none';
        return;
      }
      evidenceName.textContent = `✓ ${files.length} archivo(s) seleccionado(s)`;
      evidenceName.style.display = 'block';
    });
  }

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
      evidence: [],
      hours: '',
      completed: false,
      createdAt: new Date().toISOString(),
      completedAt: null,
    };

    if (evidenceInput?.files?.length) {
      const files = Array.from(evidenceInput.files);
      newTask.evidence = await Promise.all(
        files.map(async (file) => ({ name: file.name, data: await readFileAsDataURL(file) }))
      );
    }

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
  const editEvidenceCount = document.getElementById('editEvidenceCount');
  const editEvidenceList = document.getElementById('editEvidenceList');
  const editPreviewWrap = document.getElementById('editEvidencePreviewWrap');
  let activeEditId = null;

  // Setup filter buttons
  const filterTabs = document.getElementById('filterTabs');
  if (filterTabs) {
    const filterBtns = filterTabs.querySelectorAll('.filter-btn');
    filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        filterBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        refreshTable();
      });
    });
  }

  async function refreshTable() {
    const tasks = await getTasks();
    let filteredTasks = tasks;
    
    if (currentFilter === 'pendientes') {
      filteredTasks = tasks.filter((t) => !t.completed);
    } else if (currentFilter === 'completadas') {
      filteredTasks = tasks.filter((t) => t.completed);
    }
    
    renderTable(filteredTasks);
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

      const existingEvidence = normalizeEvidence(task.evidence);
      const files = editFileInput?.files ? Array.from(editFileInput.files) : [];
      if (files.length > 0) {
        const newEvidence = await Promise.all(
          files.map(async (file) => ({ name: file.name, data: await readFileAsDataURL(file) }))
        );
        updatedTask.evidence = [...existingEvidence, ...newEvidence];
      } else {
        updatedTask.evidence = existingEvidence;
      }

      if (updatedTask.completed && updatedTask.evidence.length < 5) {
        showToast('Para completar la tarea debes subir al menos 5 evidencias.');
        return;
      }

      try {
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
      const files = Array.from(editFileInput.files);
      if (files.length === 0) {
        if (editFileName) {
          editFileName.textContent = '';
          editFileName.style.display = 'none';
        }
        return;
      }
      if (editFileName) {
        editFileName.textContent = `✓ ${files.length} archivo(s) seleccionado(s)`;
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
    if (editEvidenceCount) {
      editEvidenceCount.textContent = '';
      editEvidenceCount.style.display = 'none';
    }
    if (editEvidenceList) {
      editEvidenceList.innerHTML = '';
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

    const evidence = normalizeEvidence(task.evidence);
    if (editEvidenceCount) {
      editEvidenceCount.textContent = `${evidence.length} evidencia(s) cargada(s)`;
      editEvidenceCount.style.display = 'block';
    }
    if (editEvidenceList) {
      editEvidenceList.innerHTML = evidence
        .map(
          (item, index) => `
            <div class="evidence-thumb-wrap">
              <img class="evidence-thumb" src="${item.data}" alt="Evidencia ${index + 1}" />
              <span class="evidence-label">${index + 1}</span>
            </div>
          `
        )
        .join('');
    }
    if (evidence.length > 0 && editPreviewWrap) {
      editPreviewWrap.style.display = 'block';
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
      .map((task) => {
        const evidence = normalizeEvidence(task.evidence);
        return `
        <tr id="row-${task.id}">
          <td class="task-name">${escHtml(task.title)}</td>
          <td class="task-desc">${escHtml(task.description) || '<span style="color:var(--ink-3);font-style:italic">Sin descripción</span>'}</td>
          <td>${formatDate(task.date)}</td>
          <td>${priorityBadge(task.priority)}</td>
          <td>${statusBadge(task.completed)}</td>
          <td>
            ${evidence.length > 0
              ? `<div class="evidence-cell"><img class="evidence-thumb" src="${evidence[0].data}" alt="Evidencia"><span>${evidence.length} evidencia(s)</span><button class="btn btn-sm btn-secondary" type="button" onclick="downloadEvidence('${task.id}')" title="Descargar primera evidencia">⬇</button></div>`
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
        </tr>`;
      })
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
    const result = await Swal.fire({
      title: '¿Eliminar tarea?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#8B2B2B',
      cancelButtonColor: '#7A7570',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true,
    });

    if (result.isConfirmed) {
      try {
        await deleteTaskRequest(id);
        showToast('Tarea eliminada');
        await refreshTable();
      } catch (error) {
        showToast(error.message || 'Error al eliminar la tarea');
      }
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
    const evidence = task?.evidence?.[0];
    if (!task || !evidence) return;
    const link = document.createElement('a');
    link.href = evidence.data;
    link.download = evidence.name || `evidencia-${id}.png`;
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
