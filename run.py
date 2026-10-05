import socket
import sys
import uvicorn

def get_local_ip():
    """Obtain local network IP to allow connecting from iPhone in same Wi-Fi."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # doesn't even have to be reachable
        s.connect(('10.255.255.255', 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

def main():
    local_ip = get_local_ip()
    port = 8000

    print("=" * 65)
    print("       🚀 POLYMARKET PULSE — INICIANDO SERVIDOR WEB")
    print("=" * 65)
    print(f"\n  [PC Local]    http://localhost:{port}")
    print(f"  [Desde iPhone] http://{local_ip}:{port}")
    print("\n  Para abrir en iPhone:")
    print("  1. Conecta tu iPhone a la misma red Wi-Fi.")
    print(f"  2. Abre Safari e ingresa: http://{local_ip}:{port}")
    print("  3. Toca 'Compartir' -> 'Agregar a pantalla de inicio'.")
    print("\n  Presiona CTRL+C para detener el servidor.\n")
    print("=" * 65 + "\n")

    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False, log_level="info")

if __name__ == "__main__":
    main()
