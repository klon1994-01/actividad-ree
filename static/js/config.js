/**
 * Configuración dinámica del servidor para DVEEEyR - Actividad REE
 * Soporta ejecución local (run.bat) y despliegue en la nube (Netlify + Render/Railway/Tunnel).
 */

window.GAME_CONFIG = (function() {
    const STORAGE_KEY = "dveeeyr_backend_url";

    // 1. Verificar si viene en los parámetros de la URL: ?server=...
    const urlParams = new URLSearchParams(window.location.search);
    const serverParam = urlParams.get("server");
    if (serverParam) {
        try {
            let clean = serverParam.trim().replace(/\/$/, "");
            if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
                clean = (window.location.protocol === "https:" ? "https://" : "http://") + clean;
            }
            localStorage.setItem(STORAGE_KEY, clean);
        } catch (e) {
            console.warn("No se pudo guardar serverParam en localStorage:", e);
        }
    }

    const hostname = window.location.hostname;
    const isLocalhost = hostname === "localhost" || 
                        hostname === "127.0.0.1" || 
                        hostname.startsWith("192.168.") || 
                        hostname.startsWith("10.") ||
                        hostname.endsWith(".local");

    function getSavedBackendUrl() {
        try {
            return localStorage.getItem(STORAGE_KEY) || "";
        } catch (e) {
            return "";
        }
    }

    function setBackendUrl(url) {
        try {
            if (!url) {
                localStorage.removeItem(STORAGE_KEY);
            } else {
                let clean = url.trim().replace(/\/$/, "");
                if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
                    clean = (window.location.protocol === "https:" ? "https://" : "http://") + clean;
                }
                localStorage.setItem(STORAGE_KEY, clean);
            }
        } catch (e) {
            console.warn("Error guardando backend URL:", e);
        }
    }

    function getBackendHttpUrl() {
        const saved = getSavedBackendUrl();
        if (saved) return saved.replace(/\/$/, "");
        if (isLocalhost) {
            return `${window.location.protocol}//${window.location.host}`;
        }
        // Si estamos en Netlify y no se ha configurado backend, usar el mismo origen
        return `${window.location.protocol}//${window.location.host}`;
    }

    function getBackendWsUrl() {
        const httpUrl = getBackendHttpUrl();
        const wsProtocol = httpUrl.startsWith("https:") ? "wss:" : "ws:";
        const hostPart = httpUrl.replace(/^https?:\/\//, "");
        return `${wsProtocol}//${hostPart}/ws`;
    }

    function getJoinUrl(pin) {
        const origin = window.location.origin;
        let url = `${origin}/play?pin=${pin}`;
        const saved = getSavedBackendUrl();
        // Si estamos en Netlify y hay un backend remoto configurado, incluirlo en el QR para que los participantes no tengan que configurar nada
        if (saved && !isLocalhost) {
            url += `&server=${encodeURIComponent(saved)}`;
        }
        return url;
    }

    return {
        isLocalhost,
        getSavedBackendUrl,
        setBackendUrl,
        getBackendHttpUrl,
        getBackendWsUrl,
        getJoinUrl
    };
})();

