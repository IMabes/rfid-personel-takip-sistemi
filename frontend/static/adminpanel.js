/**
 * SecureRoom AI — Admin Panel JS
 * Gerçek backend bağlantısı:
 *   GET    /api/users
 *   POST   /api/users
 *   PUT    /api/users/<id>
 *   DELETE /api/users/<id>
 */

'use strict';

const State = {
  cards: [],
  filtered: [],
  paginated: [],
  loading: false,
  error: null,

  activePage: 'rfid',
  search: '',
  filterRole: '',
  filterStatus: '',
  sortKey: 'id',
  sortDir: 'desc',

  currentPage: 1,
  rowsPerPage: 8,
  totalPages: 1,
  editingCardId: null,
  pendingDeleteId: null,
};

const DOM = {
  sidebar: document.getElementById('sidebar'),
  sidebarToggle: document.getElementById('sidebarToggle'),

  kpiTotal: document.getElementById('kpiTotal'),
  kpiActive: document.getElementById('kpiActive'),
  kpiActivePct: document.getElementById('kpiActivePct'),
  kpiInactive: document.getElementById('kpiInactive'),
  kpiPending: document.getElementById('kpiPending'),
  navBadge: document.getElementById('navBadge'),

  globalSearch: document.getElementById('globalSearch'),
  filterRole: document.getElementById('filterRole'),
  filterStatus: document.getElementById('filterStatus'),
  btnAddCard: document.getElementById('btnAddCard'),
  tableCount: document.getElementById('tableCount'),
  tableContainer: document.getElementById('tableContainer'),
  tablePagination: document.getElementById('tablePagination'),
  paginationInfo: document.getElementById('paginationInfo'),
  paginationControls: document.getElementById('paginationControls'),

  modalBackdrop: document.getElementById('modalBackdrop'),
  modalTitle: document.getElementById('modalTitle'),
  modalSubtitle: document.getElementById('modalSubtitle'),
  modalClose: document.getElementById('modalClose'),
  modalCancelBtn: document.getElementById('modalCancelBtn'),
  modalSaveBtn: document.getElementById('modalSaveBtn'),
  modalSaveBtnText: document.getElementById('modalSaveBtnText'),
  cardForm: document.getElementById('cardForm'),
  formCardId: document.getElementById('formCardId'),
  formUid: document.getElementById('formUid'),
  formUsername: document.getElementById('formUsername'),
  formRole: document.getElementById('formRole'),
  formDept: document.getElementById('formDept'),
  formActive: document.getElementById('formActive'),
  formActiveLabel: document.getElementById('formActiveLabel'),
  formUidError: document.getElementById('formUidError'),
  formUsernameError: document.getElementById('formUsernameError'),
  formRoleError: document.getElementById('formRoleError'),

  deleteBackdrop: document.getElementById('deleteBackdrop'),
  deletePreview: document.getElementById('deletePreview'),
  deleteClose: document.getElementById('deleteClose'),
  deleteCancelBtn: document.getElementById('deleteCancelBtn'),
  deleteConfirmBtn: document.getElementById('deleteConfirmBtn'),

  toastContainer: document.getElementById('toastContainer'),

  notifBtn: document.getElementById('notifBtn'),
  notifDropdown: document.getElementById('notifDropdown'),
  notifCount: document.getElementById('notifCount'),
  markAllRead: document.getElementById('markAllRead'),
  profileBtn: document.getElementById('profileBtn'),
  profileDropdown: document.getElementById('profileDropdown'),

  statusDot: document.getElementById('statusDot'),
  statusLabel: document.getElementById('statusLabel'),
  navLinks: document.querySelectorAll('.sidebar__nav-link'),
  pageTitle: document.getElementById('pageTitle'),

  btnRefreshLogs: document.getElementById('btnRefreshLogs'),
  logsTableContainer: document.getElementById('logsTableContainer'),
  logsCount: document.getElementById('logsCount'),
  logsLastUpdate: document.getElementById('logsLastUpdate'),
};

const API = {
  async fetchCards() {
    const response = await fetch('/api/users', {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      throw new Error('Kullanıcılar veritabanından alınamadı. /api/users endpointini kontrol et.');
    }

    const users = await response.json();

    return users.map(user => ({
      id: Number(user.id),
      uid: normalizeUIDForDisplay(user.uid),
      username: user.name || user.username || '—',
      initials: buildInitials(user.name || user.username),
      role: normalizeRole(user.role),
      dept: user.department || user.dept || '—',
      active: Number(user.is_active) === 1 || user.active === true,
      lastAccess: user.last_access || user.lastAccess || user.created_at || '—',
    }));
  },

  async createCard(data) {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.username,
        uid: normalizeUIDForSave(data.uid),
        role: data.role,
        department: data.dept,
        is_active: data.active ? 1 : 0,
      }),
    });

    const result = await safeJson(response);

    if (!response.ok) {
      throw new Error(result.message || 'Kart eklenemedi.');
    }

    return result;
  },

  async updateCard(id, updates) {
    const response = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: updates.username,
        uid: normalizeUIDForSave(updates.uid),
        role: updates.role,
        department: updates.dept,
        is_active: updates.active ? 1 : 0,
      }),
    });

    const result = await safeJson(response);

    if (!response.ok) {
      throw new Error(result.message || 'Kart güncellenemedi.');
    }

    return result;
  },

  async deleteCard(id) {
    const response = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    const result = await safeJson(response);

    if (!response.ok) {
      throw new Error(result.message || 'Kart silinemedi.');
    }

    return true;
  },
};

function esc(value) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, char => map[char]);
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function buildInitials(name) {
  if (!name || name === '—') return '?';
  return String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toLocaleUpperCase('tr-TR'))
    .join('') || '?';
}

function normalizeRole(role) {
  if (!role) return 'Guest';
  const raw = String(role).trim();
  const lower = raw.toLowerCase();

  const roleMap = {
    admin: 'Admin',
    supervisor: 'Supervisor',
    operator: 'Operator',
    technician: 'Technician',
    guest: 'Guest',
    user: 'User',
  };

  return roleMap[lower] || raw;
}

function roleClass(role) {
  const map = {
    Admin: 'admin',
    Supervisor: 'supervisor',
    Operator: 'operator',
    Technician: 'technician',
    Guest: 'guest',
    User: 'default',
  };

  return map[role] || 'default';
}

function normalizeUIDForDisplay(uid) {
  if (!uid) return '';
  return String(uid)
    .replace(/[:\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function normalizeUIDForSave(uid) {
  return normalizeUIDForDisplay(uid);
}

function formatUIDInput(raw) {
  const clean = String(raw || '').replace(/[^a-fA-F0-9]/g, '').toUpperCase().slice(0, 14);
  return clean.match(/.{1,2}/g)?.join(' ') || clean;
}

function setSystemStatus(isOnline, text = null) {
  if (!DOM.statusDot || !DOM.statusLabel) return;
  DOM.statusDot.classList.toggle('system-status__dot--error', !isOnline);
  DOM.statusLabel.textContent = text || (isOnline ? 'Sistem Aktif' : 'Bağlantı Hatası');
}

function showToast(title, desc = '', type = 'info', duration = 3500) {
  if (!DOM.toastContainer) return;

  const icons = { success: '✓', error: '✕', info: 'i', warn: '!' };
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <div class="toast__icon">${icons[type] || 'i'}</div>
    <div class="toast__body">
      <p class="toast__title">${esc(title)}</p>
      ${desc ? `<p class="toast__desc">${esc(desc)}</p>` : ''}
    </div>
    <button class="toast__close" type="button" aria-label="Bildirimi kapat">×</button>
  `;

  const dismiss = () => {
    toast.classList.add('toast--leaving');
    setTimeout(() => toast.remove(), 220);
  };

  toast.querySelector('.toast__close')?.addEventListener('click', dismiss);
  DOM.toastContainer.appendChild(toast);
  setTimeout(dismiss, duration);
}

function renderLoadingState() {
  [DOM.kpiTotal, DOM.kpiActive, DOM.kpiInactive, DOM.kpiPending].forEach(el => {
    if (el) el.innerHTML = '<span class="kpi-card__value--loading"></span>';
  });

  if (DOM.kpiActivePct) DOM.kpiActivePct.textContent = '—';
  if (DOM.navBadge) DOM.navBadge.textContent = '…';
  if (DOM.tableCount) DOM.tableCount.textContent = 'Yükleniyor…';
  if (DOM.tablePagination) DOM.tablePagination.hidden = true;

  if (DOM.tableContainer) {
    DOM.tableContainer.innerHTML = `
      <div class="state-loading" role="status" aria-label="RFID kartlar yükleniyor">
        <div class="spinner" aria-hidden="true"></div>
        <p class="state-loading__text">Veritabanından kartlar alınıyor…</p>
      </div>
    `;
  }
}

function renderEmptyState() {
  if (DOM.tableCount) DOM.tableCount.textContent = '0 kayıt';
  if (DOM.tablePagination) DOM.tablePagination.hidden = true;

  if (DOM.tableContainer) {
    DOM.tableContainer.innerHTML = `
      <div class="state-empty" role="status">
        <div>
          <div class="state-empty__icon" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>
            </svg>
          </div>
          <p class="state-empty__title">Kayıtlı RFID kart yok</p>
          <p class="state-empty__desc">Yeni RFID Kart Ekle butonuyla ilk kartı veritabanına kaydedebilirsin.</p>
        </div>
      </div>
    `;
  }
}

function renderErrorState(message) {
  setSystemStatus(false, 'Bağlantı Hatası');
  if (DOM.tableCount) DOM.tableCount.textContent = 'Hata';
  if (DOM.tablePagination) DOM.tablePagination.hidden = true;

  if (DOM.tableContainer) {
    DOM.tableContainer.innerHTML = `
      <div class="state-error" role="alert">
        <div>
          <p class="state-error__title">Veritabanı bağlantısı başarısız</p>
          <p class="state-error__desc">${esc(message || 'Beklenmeyen bir hata oluştu.')}</p>
          <button class="state-error__retry" id="retryBtn" type="button">Tekrar dene</button>
        </div>
      </div>
    `;
    document.getElementById('retryBtn')?.addEventListener('click', loadCards);
  }
}

function updateKPIs() {
  const total = State.cards.length;
  const active = State.cards.filter(card => card.active).length;
  const inactive = total - active;
  const pending = State.cards.filter(card => !card.username || card.username === '—').length;
  const pct = total === 0 ? 0 : Math.round((active / total) * 100);

  if (DOM.kpiTotal) DOM.kpiTotal.textContent = total;
  if (DOM.kpiActive) DOM.kpiActive.textContent = active;
  if (DOM.kpiInactive) DOM.kpiInactive.textContent = inactive;
  if (DOM.kpiPending) DOM.kpiPending.textContent = pending;
  if (DOM.kpiActivePct) DOM.kpiActivePct.textContent = `${pct}% aktif`;
  if (DOM.navBadge) DOM.navBadge.textContent = total;
}

function applyFiltersAndSort() {
  const search = State.search.trim().toLowerCase();

  let list = [...State.cards];

  if (search) {
    list = list.filter(card => {
      return [card.uid, card.username, card.role, card.dept]
        .some(value => String(value || '').toLowerCase().includes(search));
    });
  }

  if (State.filterRole) {
    list = list.filter(card => card.role === State.filterRole);
  }

  if (State.filterStatus === 'active') {
    list = list.filter(card => card.active);
  }

  if (State.filterStatus === 'inactive') {
    list = list.filter(card => !card.active);
  }

  list.sort((a, b) => {
    const direction = State.sortDir === 'asc' ? 1 : -1;
    let valueA = a[State.sortKey];
    let valueB = b[State.sortKey];

    if (typeof valueA === 'boolean') valueA = valueA ? 1 : 0;
    if (typeof valueB === 'boolean') valueB = valueB ? 1 : 0;

    if (typeof valueA === 'number' && typeof valueB === 'number') {
      return (valueA - valueB) * direction;
    }

    return String(valueA || '').localeCompare(String(valueB || ''), 'tr-TR', {
      numeric: true,
      sensitivity: 'base',
    }) * direction;
  });

  State.filtered = list;
  State.totalPages = Math.max(1, Math.ceil(State.filtered.length / State.rowsPerPage));

  if (State.currentPage > State.totalPages) {
    State.currentPage = State.totalPages;
  }

  const start = (State.currentPage - 1) * State.rowsPerPage;
  State.paginated = State.filtered.slice(start, start + State.rowsPerPage);
}

function sortArrow(key) {
  if (State.sortKey !== key) return '<i class="th-sort-icon">⇅</i>';
  return `<i class="th-sort-icon th-sort-icon--active">${State.sortDir === 'asc' ? '↑' : '↓'}</i>`;
}

function sortedClass(key) {
  return State.sortKey === key ? ' class="sorted"' : '';
}

function renderTable() {
  if (State.loading) return renderLoadingState();
  if (State.error) return renderErrorState(State.error);
  if (State.filtered.length === 0) return renderEmptyState();

  const start = (State.currentPage - 1) * State.rowsPerPage + 1;
  const end = Math.min(State.currentPage * State.rowsPerPage, State.filtered.length);

  if (DOM.tableCount) {
    DOM.tableCount.textContent = `${State.filtered.length} kayıt bulundu`;
  }

  const rows = State.paginated.map(card => `
    <tr data-id="${card.id}">
      <td><span class="cell-uid">${esc(card.uid)}</span></td>
      <td>
        <div class="cell-user">
          <div class="avatar avatar--row" aria-hidden="true">${esc(card.initials)}</div>
          <div>
            <p class="cell-user__name">${esc(card.username)}</p>
            ${card.dept && card.dept !== '—' ? `<p class="cell-user__dept">${esc(card.dept)}</p>` : ''}
          </div>
        </div>
      </td>
      <td><span class="role-badge role-badge--${roleClass(card.role)}">${esc(card.role)}</span></td>
      <td>
        <div class="toggle-wrap" title="${card.active ? 'Kartı pasifleştir' : 'Kartı aktifleştir'}">
          <button class="toggle-btn btn-toggle-card" type="button" data-id="${card.id}" role="switch" aria-checked="${card.active}" aria-label="${card.active ? 'Pasifleştir' : 'Aktifleştir'}">
            <span class="toggle-track ${card.active ? 'toggle-track--active' : ''}">
              <span class="toggle-thumb ${card.active ? 'toggle-thumb--active' : ''}"></span>
            </span>
          </button>
          <span class="toggle-label ${card.active ? 'toggle-label--active' : ''}">${card.active ? 'Aktif' : 'Pasif'}</span>
        </div>
      </td>
      <td class="cell-last-access">${esc(card.lastAccess)}</td>
      <td>
        <div class="action-group">
          <button class="action-btn action-btn--edit btn-edit-card" type="button" data-id="${card.id}" title="Kartı düzenle" aria-label="Kartı düzenle">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="action-btn action-btn--delete btn-delete-card" type="button" data-id="${card.id}" title="Kartı sil" aria-label="Kartı sil">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');

  DOM.tableContainer.innerHTML = `
    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th data-sort="uid"${sortedClass('uid')}>Kart UID ${sortArrow('uid')}</th>
            <th data-sort="username"${sortedClass('username')}>Kullanıcı ${sortArrow('username')}</th>
            <th data-sort="role"${sortedClass('role')}>Rol ${sortArrow('role')}</th>
            <th data-sort="active"${sortedClass('active')}>Durum ${sortArrow('active')}</th>
            <th data-sort="lastAccess"${sortedClass('lastAccess')}>Kayıt Tarihi ${sortArrow('lastAccess')}</th>
            <th style="text-align:right;cursor:default;">İşlem</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  renderPagination(start, end);
}

function renderPagination(start, end) {
  if (!DOM.tablePagination || !DOM.paginationInfo || !DOM.paginationControls) return;

  if (State.filtered.length <= State.rowsPerPage) {
    DOM.tablePagination.hidden = true;
    return;
  }

  DOM.tablePagination.hidden = false;
  DOM.paginationInfo.textContent = `${start}-${end} / ${State.filtered.length} kayıt`;

  let buttons = `
    <button class="page-btn" type="button" data-page="prev" ${State.currentPage === 1 ? 'disabled' : ''}>Önceki</button>
  `;

  for (let page = 1; page <= State.totalPages; page++) {
    buttons += `
      <button class="page-btn ${page === State.currentPage ? 'page-btn--active' : ''}" type="button" data-page="${page}">${page}</button>
    `;
  }

  buttons += `
    <button class="page-btn" type="button" data-page="next" ${State.currentPage === State.totalPages ? 'disabled' : ''}>Sonraki</button>
  `;

  DOM.paginationControls.innerHTML = buttons;
}

async function loadCards() {
  State.loading = true;
  State.error = null;
  renderLoadingState();

  try {
    State.cards = await API.fetchCards();
    State.loading = false;
    State.error = null;
    setSystemStatus(true);
    applyFiltersAndSort();
    updateKPIs();
    renderTable();
  } catch (error) {
    State.loading = false;
    State.error = error.message;
    updateKPIs();
    renderErrorState(error.message);
  }
}

function clearFormErrors() {
  [DOM.formUidError, DOM.formUsernameError, DOM.formRoleError].forEach(el => {
    if (el) el.textContent = '';
  });
}

function resetForm() {
  DOM.cardForm?.reset();
  if (DOM.formCardId) DOM.formCardId.value = '';
  if (DOM.formActive) DOM.formActive.checked = true;
  updateActiveLabel();
  clearFormErrors();
}

function openModal() {
  if (DOM.modalBackdrop) DOM.modalBackdrop.hidden = false;
  document.body.style.overflow = 'hidden';
  setTimeout(() => DOM.formUid?.focus(), 50);
}

function closeModal() {
  if (DOM.modalBackdrop) DOM.modalBackdrop.hidden = true;
  document.body.style.overflow = '';
  State.editingCardId = null;
  resetForm();
}

function openAddModal() {
  State.editingCardId = null;
  resetForm();

  if (DOM.modalTitle) DOM.modalTitle.textContent = 'Yeni RFID Kart Ekle';
  if (DOM.modalSubtitle) DOM.modalSubtitle.textContent = 'Kart UID değerini kullanıcıyla eşleştir.';
  if (DOM.modalSaveBtnText) DOM.modalSaveBtnText.textContent = 'Kartı Kaydet';

  openModal();
}

function openEditModal(id) {
  const card = State.cards.find(item => item.id === Number(id));
  if (!card) return;

  State.editingCardId = card.id;
  clearFormErrors();

  if (DOM.modalTitle) DOM.modalTitle.textContent = 'RFID Kartı Düzenle';
  if (DOM.modalSubtitle) DOM.modalSubtitle.textContent = `${card.uid} kartının bilgilerini güncelle.`;
  if (DOM.modalSaveBtnText) DOM.modalSaveBtnText.textContent = 'Değişiklikleri Kaydet';

  if (DOM.formCardId) DOM.formCardId.value = card.id;
  if (DOM.formUid) DOM.formUid.value = card.uid;
  if (DOM.formUsername) DOM.formUsername.value = card.username === '—' ? '' : card.username;
  if (DOM.formRole) DOM.formRole.value = card.role;
  if (DOM.formDept) DOM.formDept.value = card.dept === '—' ? '' : card.dept;
  if (DOM.formActive) DOM.formActive.checked = card.active;
  updateActiveLabel();

  openModal();
}

function validateForm() {
  clearFormErrors();

  const uid = DOM.formUid?.value.trim() || '';
  const username = DOM.formUsername?.value.trim() || '';
  const role = DOM.formRole?.value || '';
  let valid = true;

  if (!uid) {
    if (DOM.formUidError) DOM.formUidError.textContent = 'Kart UID zorunludur.';
    valid = false;
  }

  if (!username) {
    if (DOM.formUsernameError) DOM.formUsernameError.textContent = 'Ad Soyad zorunludur.';
    valid = false;
  }

  if (!role) {
    if (DOM.formRoleError) DOM.formRoleError.textContent = 'Rol seçmelisin.';
    valid = false;
  }

  const normalizedUid = normalizeUIDForSave(uid);
  const duplicate = State.cards.find(card => {
    return normalizeUIDForSave(card.uid) === normalizedUid && card.id !== State.editingCardId;
  });

  if (duplicate) {
    if (DOM.formUidError) DOM.formUidError.textContent = 'Bu UID zaten başka bir kullanıcıya kayıtlı.';
    valid = false;
  }

  return valid;
}

async function handleFormSubmit(event) {
  event.preventDefault();

  if (!validateForm()) return;

  const payload = {
    uid: normalizeUIDForSave(DOM.formUid.value),
    username: DOM.formUsername.value.trim(),
    role: DOM.formRole.value,
    dept: DOM.formDept?.value.trim() || '—',
    active: Boolean(DOM.formActive.checked),
  };

  const isEditing = State.editingCardId !== null;

  try {
    setSaveButtonLoading(true);

    if (isEditing) {
      await API.updateCard(State.editingCardId, payload);
      showToast('Kart güncellendi', `${payload.username} bilgileri kaydedildi.`, 'success');
    } else {
      await API.createCard(payload);
      showToast('Kart eklendi', `${payload.username} sisteme kaydedildi.`, 'success');
    }

    closeModal();
    await loadCards();
  } catch (error) {
    showToast('İşlem başarısız', error.message, 'error', 5000);
  } finally {
    setSaveButtonLoading(false);
  }
}

function setSaveButtonLoading(isLoading) {
  if (!DOM.modalSaveBtn || !DOM.modalSaveBtnText) return;
  DOM.modalSaveBtn.classList.toggle('btn--loading', isLoading);
  DOM.modalSaveBtn.disabled = isLoading;
  DOM.modalSaveBtnText.textContent = isLoading ? 'Kaydediliyor…' : (State.editingCardId ? 'Değişiklikleri Kaydet' : 'Kartı Kaydet');
}

function updateActiveLabel() {
  if (!DOM.formActiveLabel || !DOM.formActive) return;
  DOM.formActiveLabel.textContent = DOM.formActive.checked ? 'Aktif' : 'Pasif';
}

function openDeleteModal(id) {
  const card = State.cards.find(item => item.id === Number(id));
  if (!card) return;

  State.pendingDeleteId = card.id;

  if (DOM.deletePreview) {
    DOM.deletePreview.innerHTML = `
      <strong>${esc(card.username)}</strong>
      <span>${esc(card.uid)} • ${esc(card.role)}</span>
    `;
  }

  if (DOM.deleteBackdrop) DOM.deleteBackdrop.hidden = false;
  document.body.style.overflow = 'hidden';
}

function closeDeleteModal() {
  if (DOM.deleteBackdrop) DOM.deleteBackdrop.hidden = true;
  document.body.style.overflow = '';
  State.pendingDeleteId = null;
}

async function confirmDelete() {
  if (State.pendingDeleteId === null) return;

  const id = State.pendingDeleteId;
  const card = State.cards.find(item => item.id === id);

  try {
    if (DOM.deleteConfirmBtn) DOM.deleteConfirmBtn.disabled = true;
    await API.deleteCard(id);
    closeDeleteModal();
    showToast('Kart silindi', `${card?.uid || 'Kart'} sistemden kaldırıldı.`, 'success');
    await loadCards();
  } catch (error) {
    showToast('Silme başarısız', error.message, 'error', 5000);
  } finally {
    if (DOM.deleteConfirmBtn) DOM.deleteConfirmBtn.disabled = false;
  }
}

async function toggleCardStatus(id) {
  const card = State.cards.find(item => item.id === Number(id));
  if (!card) return;

  try {
    await API.updateCard(card.id, { ...card, active: !card.active });
    showToast(
      !card.active ? 'Kart aktifleştirildi' : 'Kart pasifleştirildi',
      `${card.uid} durumu güncellendi.`,
      'success'
    );
    await loadCards();
  } catch (error) {
    showToast('Durum güncellenemedi', error.message, 'error', 5000);
  }
}

function handleSort(key) {
  if (State.sortKey === key) {
    State.sortDir = State.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    State.sortKey = key;
    State.sortDir = key === 'id' ? 'desc' : 'asc';
  }

  applyFiltersAndSort();
  renderTable();
}

function changePage(value) {
  if (value === 'prev') {
    State.currentPage = Math.max(1, State.currentPage - 1);
  } else if (value === 'next') {
    State.currentPage = Math.min(State.totalPages, State.currentPage + 1);
  } else {
    State.currentPage = Number(value);
  }

  applyFiltersAndSort();
  renderTable();
}

async function fetchAccessLogs() {
  const response = await fetch('/api/events', {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error('Giriş logları alınamadı. /api/events endpointini kontrol et.');
  }

  return await response.json();
}

function getLogStatusBadge(status) {
  if (status === 'authorized') {
    return '<span class="log-badge log-badge--authorized">Yetkili</span>';
  }

  return '<span class="log-badge log-badge--unauthorized">Yetkisiz</span>';
}

function renderAccessLogs(logs) {
  if (!DOM.logsTableContainer) return;

  if (!logs || logs.length === 0) {
    DOM.logsTableContainer.innerHTML = `
      <div class="state-empty" role="status">
        <div>
          <div class="state-empty__icon" aria-hidden="true">📋</div>
          <p class="state-empty__title">Henüz giriş kaydı yok</p>
          <p class="state-empty__desc">RFID kart okutulduğunda loglar burada görünecek.</p>
        </div>
      </div>
    `;

    if (DOM.logsCount) DOM.logsCount.textContent = '0 log kaydı';
    return;
  }

  const rows = logs.map(log => `
    <tr>
      <td>${esc(log.id)}</td>
      <td><span class="cell-uid">${esc(log.uid)}</span></td>
      <td>${getLogStatusBadge(log.status)}</td>
      <td>${esc(log.message || '-')}</td>
      <td class="cell-last-access">${esc(log.created_at)}</td>
    </tr>
  `).join('');

  DOM.logsTableContainer.innerHTML = `
    <div class="table-scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Kart UID</th>
            <th>Durum</th>
            <th>Mesaj</th>
            <th>Tarih / Saat</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;

  if (DOM.logsCount) {
    DOM.logsCount.textContent = `${logs.length} log kaydı listeleniyor`;
  }

  if (DOM.logsLastUpdate) {
    DOM.logsLastUpdate.textContent =
      'Son güncelleme: ' + new Date().toLocaleTimeString('tr-TR');
  }
}

async function loadAccessLogs() {
  if (!DOM.logsTableContainer) return;

  DOM.logsTableContainer.innerHTML = `
    <div class="state-loading" role="status">
      <div class="spinner" aria-hidden="true"></div>
      <p class="state-loading__text">Giriş logları yükleniyor…</p>
    </div>
  `;

  try {
    const logs = await fetchAccessLogs();
    renderAccessLogs(logs);
  } catch (error) {
    DOM.logsTableContainer.innerHTML = `
      <div class="state-error" role="alert">
        <div>
          <p class="state-error__title">Giriş logları alınamadı</p>
          <p class="state-error__desc">${esc(error.message)}</p>
          <button class="state-error__retry" id="retryLogsBtn" type="button">Tekrar dene</button>
        </div>
      </div>
    `;

    document.getElementById('retryLogsBtn')?.addEventListener('click', loadAccessLogs);
  }
}

function showPage(pageName) {
  State.activePage = pageName;

  document.querySelectorAll('.page').forEach(page => {
    page.hidden = page.id !== `page-${pageName}`;
  });

  DOM.navLinks?.forEach(link => {
    const active = link.dataset.page === pageName;
    link.classList.toggle('sidebar__nav-link--active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  const titles = {
    dashboard: 'Genel Bakış',
    rfid: 'RFID Kart Yönetimi',
    logs: 'Giriş Logları',
    reporting: 'Raporlama',
    settings: 'Ayarlar',
  };

  if (DOM.pageTitle) DOM.pageTitle.textContent = titles[pageName] || 'SecureRoom AI';

  if (pageName === 'logs') {
  loadAccessLogs();
}
}

function bindEvents() {
  DOM.btnRefreshLogs?.addEventListener('click', loadAccessLogs);
  DOM.btnAddCard?.addEventListener('click', openAddModal);
  DOM.modalClose?.addEventListener('click', closeModal);
  DOM.modalCancelBtn?.addEventListener('click', closeModal);
  DOM.modalBackdrop?.addEventListener('click', event => {
    if (event.target === DOM.modalBackdrop) closeModal();
  });

  DOM.cardForm?.addEventListener('submit', handleFormSubmit);

  DOM.formUid?.addEventListener('input', event => {
    event.target.value = formatUIDInput(event.target.value);
  });

  DOM.formActive?.addEventListener('change', updateActiveLabel);

  DOM.deleteClose?.addEventListener('click', closeDeleteModal);
  DOM.deleteCancelBtn?.addEventListener('click', closeDeleteModal);
  DOM.deleteConfirmBtn?.addEventListener('click', confirmDelete);
  DOM.deleteBackdrop?.addEventListener('click', event => {
    if (event.target === DOM.deleteBackdrop) closeDeleteModal();
  });

  DOM.globalSearch?.addEventListener('input', event => {
    State.search = event.target.value;
    State.currentPage = 1;
    applyFiltersAndSort();
    renderTable();
  });

  DOM.filterRole?.addEventListener('change', event => {
    State.filterRole = event.target.value;
    State.currentPage = 1;
    applyFiltersAndSort();
    renderTable();
  });

  DOM.filterStatus?.addEventListener('change', event => {
    State.filterStatus = event.target.value;
    State.currentPage = 1;
    applyFiltersAndSort();
    renderTable();
  });

  DOM.tableContainer?.addEventListener('click', event => {
    const sortHeader = event.target.closest('th[data-sort]');
    if (sortHeader) {
      handleSort(sortHeader.dataset.sort);
      return;
    }

    const editBtn = event.target.closest('.btn-edit-card');
    if (editBtn) {
      openEditModal(editBtn.dataset.id);
      return;
    }

    const deleteBtn = event.target.closest('.btn-delete-card');
    if (deleteBtn) {
      openDeleteModal(deleteBtn.dataset.id);
      return;
    }

    const toggleBtn = event.target.closest('.btn-toggle-card');
    if (toggleBtn) {
      toggleCardStatus(toggleBtn.dataset.id);
    }
  });

  DOM.paginationControls?.addEventListener('click', event => {
    const btn = event.target.closest('.page-btn');
    if (!btn || btn.disabled) return;
    changePage(btn.dataset.page);
  });

  DOM.navLinks?.forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      showPage(link.dataset.page || 'rfid');
    });
  });

  DOM.sidebarToggle?.addEventListener('click', () => {
    const isOpen = DOM.sidebar?.classList.toggle('sidebar--open');
    DOM.sidebarToggle.setAttribute('aria-expanded', String(Boolean(isOpen)));
  });

  DOM.notifBtn?.addEventListener('click', event => {
    event.stopPropagation();
    DOM.notifDropdown.hidden = !DOM.notifDropdown.hidden;
    DOM.profileDropdown.hidden = true;
  });

  DOM.profileBtn?.addEventListener('click', event => {
    event.stopPropagation();
    DOM.profileDropdown.hidden = !DOM.profileDropdown.hidden;
    DOM.notifDropdown.hidden = true;
  });

  DOM.markAllRead?.addEventListener('click', () => {
    document.querySelectorAll('.notif-item--unread').forEach(item => item.classList.remove('notif-item--unread'));
    if (DOM.notifCount) {
      DOM.notifCount.textContent = '0';
      DOM.notifCount.classList.add('notif-badge--hidden');
    }
  });

  document.addEventListener('click', () => {
    if (DOM.notifDropdown) DOM.notifDropdown.hidden = true;
    if (DOM.profileDropdown) DOM.profileDropdown.hidden = true;
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeModal();
      closeDeleteModal();
      if (DOM.notifDropdown) DOM.notifDropdown.hidden = true;
      if (DOM.profileDropdown) DOM.profileDropdown.hidden = true;
    }
  });
}

function init() {
  bindEvents();
  updateActiveLabel();
  showPage('rfid');
  loadCards();
}

document.addEventListener('DOMContentLoaded', init);
