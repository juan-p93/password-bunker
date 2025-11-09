const { invoke } = window.__TAURI__.core;

let currentId = null;

async function unlock() {
  const mp = document.getElementById('mp').value;
  const ok = await invoke('unlock', { password: mp });
  if (ok) {
    document.getElementById('login').style.display = 'none';
    document.getElementById('panel').style.display = 'block';
    loadList();
  } else {
    alert('❌ Contraseña maestra incorrecta');
  }
}

function lock() {
  document.getElementById('login').style.display = 'flex';
  document.getElementById('panel').style.display = 'none';
  document.getElementById('mp').value = '';
  document.getElementById('form').style.display = 'none';
  invoke('lock');
}

async function changeMP() {
  const old = prompt('Contraseña actual:');
  const nueva = prompt('Nueva contraseña:');
  if (!old || !nueva) return;
  const ok = await invoke('change_master_password', { oldPass: old, newPass: nueva });
  alert(ok ? '✅ Contraseña cambiada' : '❌ Error');
}

function showNew() {
  currentId = crypto.randomUUID();
  document.getElementById('form').style.display = 'flex';
  document.getElementById('fLink').value = '';
  document.getElementById('fUser').value = '';
  document.getElementById('fPass').value = '';
  document.getElementById('fNotes').value = '';
}

async function loadList(filter = '') {
  const entries = await invoke('get_entries', { filter });
  const list = document.getElementById('list');
  list.innerHTML = entries.map(e => `
    <div onclick="editEntry('${e.id}')">
      <strong>${e.link}</strong><br>
      <small>${e.user}</small>
    </div>
  `).join('');
}

function filterList() {
  const term = document.getElementById('search').value;
  loadList(term);
}

async function editEntry(id) {
  currentId = id;
  const entries = await invoke('get_entries', { filter: '' });
  const entry = entries.find(e => e.id === id);
  if (entry) {
    document.getElementById('fLink').value = entry.link;
    document.getElementById('fUser').value = entry.user;
    document.getElementById('fPass').value = entry.pass;
    document.getElementById('fNotes').value = entry.notes;
    document.getElementById('form').style.display = 'flex';
  }
}

async function saveEntry() {
  const entry = {
    id: currentId,
    link: document.getElementById('fLink').value,
    user: document.getElementById('fUser').value,
    pass: document.getElementById('fPass').value,
    notes: document.getElementById('fNotes').value,
  };
  await invoke('save_entry', { entry });
  loadList();
  document.getElementById('form').style.display = 'none';
  alert('✅ Guardado en USB');
}

async function delEntry() {
  if (!confirm('¿Borrar esta entrada?')) return;
  await invoke('delete_entry', { id: currentId });
  loadList();
  document.getElementById('form').style.display = 'none';
}

async function copyLink() {
  await invoke('copy_to_clipboard', { text: document.getElementById('fLink').value });
}
async function copyUser() {
  await invoke('copy_to_clipboard', { text: document.getElementById('fUser').value });
}
async function copyPass() {
  await invoke('copy_to_clipboard', { text: document.getElementById('fPass').value });
}