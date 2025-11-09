// public/main.js (recomendado)
import { invoke } from '@tauri-apps/api/tauri';

let currentId = null;

async function unlock() {
  const mp = document.getElementById("mp").value;
  try {
    const ok = await invoke("unlock", { password: mp });
    if (ok) {
      document.getElementById("login").style.display = "none";
      document.getElementById("panel").style.display = "block";
      await loadList();
    } else {
      alert("❌ Contraseña maestra incorrecta");
    }
  } catch (err) {
    console.error("invoke unlock error:", err);
    alert("❌ Error interno: " + (err?.message ?? err));
  }
}

function lock() {
  document.getElementById("login").style.display = "flex";
  document.getElementById("panel").style.display = "none";
  document.getElementById("mp").value = "";
  document.getElementById("form").style.display = "none";
  invoke("lock").catch(e => console.error("lock failed", e));
}

async function changeMP() {
  const oldPass = prompt("Contraseña actual:");
  const newPass = prompt("Nueva contraseña:");
  if (!oldPass || !newPass) return;
  try {
    const ok = await invoke("change_master_password", { oldPass, newPass });
    alert(ok ? "✅ Contraseña cambiada" : "❌ Error");
  } catch (err) {
    console.error("change_master_password error:", err);
    alert("❌ Error al cambiar contraseña");
  }
}

function showNew() {
  currentId = crypto.randomUUID();
  document.getElementById("form").style.display = "flex";
  document.getElementById("fLink").value = "";
  document.getElementById("fUser").value = "";
  document.getElementById("fPass").value = "";
  document.getElementById("fNotes").value = "";
}

async function loadList(filter = "") {
  try {
    const entries = await invoke("get_entries", { filter });
    const list = document.getElementById("list");
    list.innerHTML = entries.map(e =>
      `<div onclick="editEntry('${e.id}')"><strong>${e.link}</strong><br><small>${e.user}</small></div>`
    ).join("");
  } catch (err) {
    console.error("get_entries error:", err);
  }
}

function filterList() {
  const term = document.getElementById("search").value;
  loadList(term);
}

async function editEntry(id) {
  currentId = id;
  try {
    const entries = await invoke("get_entries", { filter: "" });
    const entry = entries.find(e => e.id === id);
    if (entry) {
      document.getElementById("fLink").value = entry.link;
      document.getElementById("fUser").value = entry.user;
      document.getElementById("fPass").value = entry.pass;
      document.getElementById("fNotes").value = entry.notes;
      document.getElementById("form").style.display = "flex";
    }
  } catch (err) {
    console.error("editEntry error:", err);
  }
}

async function saveEntry() {
  const entry = {
    id: currentId,
    link: document.getElementById("fLink").value,
    user: document.getElementById("fUser").value,
    pass: document.getElementById("fPass").value,
    notes: document.getElementById("fNotes").value
  };
  try {
    await invoke("save_entry", { entry });
    await loadList();
    document.getElementById("form").style.display = "none";
    alert("✅ Guardado en USB");
  } catch (err) {
    console.error("saveEntry error:", err);
    alert("❌ Error al guardar");
  }
}

async function delEntry() {
  if (!confirm("¿Borrar esta entrada?")) return;
  try {
    await invoke("delete_entry", { id: currentId });
    await loadList();
    document.getElementById("form").style.display = "none";
  } catch (err) {
    console.error("delete_entry error:", err);
    alert("❌ Error al borrar");
  }
}

async function copyLink() {
  await invoke("copy_to_clipboard", { text: document.getElementById("fLink").value });
}
async function copyUser() {
  await invoke("copy_to_clipboard", { text: document.getElementById("fUser").value });
}
async function copyPass() {
  await invoke("copy_to_clipboard", { text: document.getElementById("fPass").value });
}

// Export or bind to window if tu HTML expects global functions
window.unlock = unlock;
window.lock = lock;
window.changeMP = changeMP;
window.showNew = showNew;
window.filterList = filterList;
window.editEntry = editEntry;
window.saveEntry = saveEntry;
window.delEntry = delEntry;
window.copyLink = copyLink;
window.copyUser = copyUser;
window.copyPass = copyPass;

// Si tu proyecto no soporta módulos nativos en el navegador:
// - En proyectos con bundler (Vite/webpack) esto se incluirá bien.
// - Si no usas bundler, cambia import/usage según la versión de Tauri:
//   const { invoke } = window.__TAURI__ ? window.__TAURI__ : require('@tauri-apps/api').tauri;
