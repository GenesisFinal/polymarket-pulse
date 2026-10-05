# Polymarket Pulse — Monitor de Probabilidades en Tiempo Real

Aplicación web progresiva (**PWA**) y dashboard analítico para consultar estadísticas, probabilidades implícitas en tiempo real, volumen e historial de cotizaciones de **Polymarket** de manera 100% de solo lectura (*read-only*), sin realizar apuestas ni conectar billeteras cripto.

---

## 🚀 Características Principales

- **Bypass de Bloqueo en Argentina:**
  - **Apple App Store:** Configurado como **PWA** para agregar directamente a la pantalla de inicio del iPhone desde Safari ("Compartir" $\rightarrow$ "Agregar a inicio") funcionando a pantalla completa como una app nativa.
  - **Bloqueo DNS de ISPs locales:** El backend resuelve todas las peticiones a `gamma-api.polymarket.com` y `clob.polymarket.com` a través de **DNS-over-HTTPS (DoH)** con Cloudflare (`https://1.1.1.1/dns-query`), evitando cualquier censura o error de resolución de proveedores como Personal, Fibertel, TeleCentro o Movistar.
- **Dashboard Multicategoría:**
  - Pestañas temáticas: **🔥 Trending**, **🇦🇷 Argentina**, **📈 Macroeconomía**, **🏛️ Política**, **⚡ Cripto**, **🤖 IA & Tech**, **⚽ Deportes** y **🌐 Todos**.
  - **Buscador en tiempo real** por palabra clave con debounce.
  - **Ordenamiento flexible:** Mayor volumen en 24h, Mayor volumen total acumulado o Mayor liquidez.
- **Gráficos Interactivos de Evolución:**
  - Modal detallado con gráficos de líneas dinámicos (Chart.js) para visualizar cómo cambió la probabilidad a lo largo del tiempo.
  - Filtros temporales: **24H**, **7D**, **30D** y **Histórico Completo**.
  - Selector de opción (Sí / No / Candidato / etc.) dentro del mismo evento.
- **Watchlist / Favoritos:**
  - Guarda mercados clave en el almacenamiento local (`localStorage`) del celular o PC tocando el ícono de la estrella.
- **Actualización automática:** Refresco continuo de cotizaciones en segundo plano.

---

## 💻 Cómo Ejecutar en tu Computadora

1. Abre una terminal (PowerShell o CMD) en esta carpeta:
   ```bash
   python run.py
   ```
2. Abre tu navegador web en:
   ```
   http://localhost:8000
   ```

---

## 📱 Cómo Abrir e Instalar en tu iPhone

1. Asegúrate de que tu iPhone esté conectado a la **misma red Wi-Fi** que tu computadora.
2. Al ejecutar `python run.py`, la consola te mostrará una dirección de red local (ejemplo: `http://192.168.1.45:8000`).
3. En tu iPhone, abre **Safari** e ingresa esa dirección URL.
4. Toca el botón **Compartir** (el ícono del cuadrado con la flecha hacia arriba en la barra inferior de Safari).
5. Desliza hacia abajo y selecciona **"Agregar a pantalla de inicio"** (*Add to Home Screen*).
6. ¡Listo! Se creará un ícono en tu iPhone que se abrirá en modo app nativa a pantalla completa.

---

## ☁️ Despliegue en la Nube (Opcional, 24/7)

Si prefieres tener la webapp disponible en tu iPhone en todo momento sin necesidad de dejar tu PC encendida, puedes subir este repositorio a [Render](https://render.com), [Railway](https://railway.app) o [Fly.io] de forma gratuita:

- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn server:app --host 0.0.0.0 --port $PORT`
