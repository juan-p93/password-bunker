// src-tauri/src/main.rs
use tauri::State;
use std::sync::Mutex;
use std::path::PathBuf;
use std::fs;
use serde::{Serialize, Deserialize};
use aes_gcm_siv::{
    aead::{Aead, KeyInit, OsRng, generic_array::GenericArray},
    Aes256GcmSiv, Nonce,
};
use sha2::{Sha256, Digest};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

#[derive(Serialize, Deserialize, Clone)]
struct Entry {
    id: String,
    link: String,
    user: String,
    pass: String,
    notes: String,
}

#[derive(Default)]
struct VaultState {
    unlocked: bool,
    master_hash: Mutex<Option<String>>,
    entries: Mutex<Vec<Entry>>,
}

#[tauri::command]
fn unlock(password: String, state: State<VaultState>) -> Result<bool, String> {
    let vault_path = get_vault_path()?;
    let hash = hash_password(&password);

    if vault_path.exists() {
        let data = fs::read_to_string(&vault_path).map_err(|e| e.to_string())?;
        if data.is_empty() {
            *state.master_hash.lock().unwrap() = Some(hash);
            state.unlocked = true;
            return Ok(true);
        }
        
        match decrypt_data(&data, &password) {
            Ok(entries_str) => {
                let entries: Vec<Entry> = serde_json::from_str(&entries_str)
                    .map_err(|_| "Error al leer vault")?;
                *state.entries.lock().unwrap() = entries;
                *state.master_hash.lock().unwrap() = Some(hash);
                state.unlocked = true;
                Ok(true)
            }
            Err(_) => Ok(false)
        }
    } else {
        *state.master_hash.lock().unwrap() = Some(hash);
        state.unlocked = true;
        Ok(true)
    }
}

#[tauri::command]
fn lock(state: State<VaultState>) {
    state.unlocked = false;
    *state.master_hash.lock().unwrap() = None;
    *state.entries.lock().unwrap() = Vec::new();
}

#[tauri::command]
fn change_master_password(old_pass: String, new_pass: String, state: State<VaultState>) -> Result<bool, String> {
    if !state.unlocked {
        return Err("Vault locked".to_string());
    }
    
    let current_hash = state.master_hash.lock().unwrap().clone();
    if let Some(hash) = current_hash {
        if hash != hash_password(&old_pass) {
            return Ok(false);
        }
    }

    *state.master_hash.lock().unwrap() = Some(hash_password(&new_pass));
    save_vault(state)?;
    Ok(true)
}

#[tauri::command]
fn get_entries(filter: String, state: State<VaultState>) -> Result<Vec<Entry>, String> {
    if !state.unlocked {
        return Err("Vault locked".to_string());
    }
    
    let entries = state.entries.lock().unwrap();
    let filtered: Vec<Entry> = entries.iter()
        .filter(|e| e.link.contains(&filter) || e.user.contains(&filter))
        .cloned()
        .collect();
    
    Ok(filtered)
}

#[tauri::command]
fn save_entry(entry: Entry, state: State<VaultState>) -> Result<(), String> {
    if !state.unlocked {
        return Err("Vault locked".to_string());
    }
    
    let mut entries = state.entries.lock().unwrap();
    
    if let Some(pos) = entries.iter().position(|e| e.id == entry.id) {
        entries[pos] = entry;
    } else {
        entries.push(entry);
    }
    
    save_vault(state)?;
    Ok(())
}

#[tauri::command]
fn delete_entry(id: String, state: State<VaultState>) -> Result<(), String> {
    if !state.unlocked {
        return Err("Vault locked".to_string());
    }
    
    let mut entries = state.entries.lock().unwrap();
    entries.retain(|e| e.id != id);
    save_vault(state)?;
    Ok(())
}

#[tauri::command]
fn copy_to_clipboard(text: String) -> Result<(), String> {
    use tauri::Manager;
    tauri::api::clipboard::write_text(text).map_err(|e| e.to_string())
}

fn hash_password(password: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn get_vault_path() -> Result<PathBuf, String> {
    let exe_path = std::env::current_exe()
        .map_err(|_| "No se pudo obtener ruta del ejecutable")?;
    let dir = exe_path.parent().ok_or("No se pudo obtener directorio")?;
    Ok(dir.join("vault.json"))
}

fn save_vault(state: State<VaultState>) -> Result<(), String> {
    let vault_path = get_vault_path()?;
    let entries = state.entries.lock().unwrap();
    let master_hash = state.master_hash.lock().unwrap();
    
    let json = serde_json::to_string(&*entries).map_err(|e| e.to_string())?;
    
    if let Some(hash) = &*master_hash {
        let encrypted = encrypt_data(&json, hash)?;
        fs::write(&vault_path, encrypted).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

fn encrypt_data(data: &str, password: &str) -> Result<String, String> {
    let key = derive_key(password);
    let cipher = Aes256GcmSiv::new(&key);
    let nonce = Nonce::from_slice(&[0u8; 12]);
    let ciphertext = cipher.encrypt(nonce, data.as_bytes())
        .map_err(|_| "Error al encriptar")?;
    Ok(BASE64.encode(&ciphertext))
}

fn decrypt_data(encrypted: &str, password: &str) -> Result<String, String> {
    let key = derive_key(password);
    let cipher = Aes256GcmSiv::new(&key);
    let nonce = Nonce::from_slice(&[0u8; 12]);
    let ciphertext = BASE64.decode(encrypted).map_err(|_| "Error al decodificar")?;
    let plaintext = cipher.decrypt(nonce, ciphertext.as_ref())
        .map_err(|_| "Error al desencriptar")?;
    Ok(String::from_utf8(plaintext).map_err(|_| "Error UTF8")?)
}

fn derive_key(password: &str) -> GenericArray<u8, 32> {
    let mut hasher = Sha256::new();
    hasher.update(password.as_bytes());
    let result = hasher.finalize();
    *GenericArray::from_slice(&result)
}

fn main() {
    tauri::Builder::default()
        .manage(VaultState::default())
        .invoke_handler(tauri::generate_handler![
            unlock, lock, change_master_password, 
            get_entries, save_entry, delete_entry, copy_to_clipboard
        ])
        .run(tauri::generate_context!())
        .expect("Error al iniciar Tauri");
}