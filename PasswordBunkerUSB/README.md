# Password Bunker USB

Password manager portable que guarda datos encriptados directamente en la USB.

## 📦 Requisitos

- **Windows 10/11** (64-bit)
- **Docker Desktop** (método recomendado) o **Rust 1.75+**

## 🚀 Compilación (Método Docker)

1. Instala Docker Desktop: https://www.docker.com/products/docker-desktop/
2. Abre PowerShell en la carpeta del proyecto
3. Ejecuta:

```powershell
docker run --rm -v ${PWD}:/app -w /app tauri-apps/tauri:1 cargo tauri build