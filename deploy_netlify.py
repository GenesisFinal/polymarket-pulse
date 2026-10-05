import os
import io
import zipfile
import json
from curl_cffi import requests

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
TOKEN_PATH = r"G:\Mi unidad\IA\Token de Netlify.txt"
CONFIG_PATH = os.path.join(BASE_DIR, "netlify_config.json")

def get_token():
    if not os.path.exists(TOKEN_PATH):
        raise FileNotFoundError(f"Token no encontrado en {TOKEN_PATH}")
    with open(TOKEN_PATH, "r", encoding="utf-8") as f:
        for line in f.read().splitlines():
            clean = line.strip()
            if clean and not clean.startswith("#") and "token" not in clean.lower():
                return clean
    raise ValueError("No se pudo extraer el token de Netlify.")

def main():
    token = get_token()
    headers = {"Authorization": f"Bearer {token}"}

    site_id = None
    site_url = None

    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                site_id = cfg.get("site_id")
                site_url = cfg.get("site_url")
                print(f"Configuración existente cargada: Site ID={site_id}, URL={site_url}")
        except Exception as e:
            print(f"Aviso: {e}")

    # Create site if not configured
    if not site_id:
        print("Creando nuevo sitio en Netlify...")
        site_name = "polymarket-pulse-ar"
        payload = {"name": site_name}
        r = requests.post("https://api.netlify.com/api/v1/sites", headers=headers, json=payload)
        
        # If name is taken, try auto-generated
        if r.status_code not in [200, 201]:
            print(f"Nombre '{site_name}' no disponible, creando con nombre automático...")
            r = requests.post("https://api.netlify.com/api/v1/sites", headers=headers, json={})

        if r.status_code in [200, 201]:
            data = r.json()
            site_id = data.get("id")
            site_url = data.get("ssl_url") or data.get("url")
            with open(CONFIG_PATH, "w", encoding="utf-8") as f:
                json.dump({"site_id": site_id, "site_url": site_url}, f, indent=2)
            print(f"Sitio creado exitosamente: {site_url} (ID: {site_id})")
        else:
            print(f"Error al crear sitio en Netlify: {r.status_code} - {r.text}")
            return

    # Zip the static directory
    print("Empaquetando archivos del frontend y reglas de proxy...")
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, _, files in os.walk(STATIC_DIR):
            for file in files:
                if file == "desktop.ini":
                    continue
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, STATIC_DIR)
                zf.write(file_path, arcname=arcname)
                print(f"  + {arcname}")

        # Add Cache-Control headers
        headers_content = (
            "/*\n"
            "  Cache-Control: no-cache, no-store, must-revalidate\n"
            "  Pragma: no-cache\n"
            "  Expires: 0\n"
        )
        zf.writestr("_headers", headers_content)
        print("  + _headers")

    zip_data = zip_buffer.getvalue()

    # Deploy to Netlify
    print(f"Subiendo versión a Netlify (Site ID: {site_id})...")
    deploy_url = f"https://api.netlify.com/api/v1/sites/{site_id}/deploys"
    deploy_headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/zip"
    }

    r = requests.post(deploy_url, headers=deploy_headers, data=zip_data)
    if r.status_code in [200, 201, 202]:
        data = r.json()
        final_url = data.get("ssl_url") or data.get("url")
        print("\n" + "=" * 65)
        print(" [OK] DESPLIEGUE EN LA NUBE COMPLETADO EXITOSAMENTE!")
        print("=" * 65)
        print(f"\n  URL Publica para tu iPhone: {final_url}")
        print("\n  Instrucciones para el celular:")
        print("  1. Abre ese enlace desde Safari en tu iPhone.")
        print("  2. Toca 'Compartir' -> 'Agregar a pantalla de inicio'.")
        print("  3. Listo! Ya es 100% autonomo y funciona 24/7 sin tu PC.")
        print("=" * 65 + "\n")
    else:
        print(f"Error en el despliegue: {r.status_code} - {r.text}")

if __name__ == "__main__":
    main()
