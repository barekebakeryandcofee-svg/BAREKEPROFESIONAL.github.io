// Formatear moneda COP
export function formatCOP(valor) {
    return new Intl.NumberFormat('es-CO', { 
        style: 'currency', 
        currency: 'COP', 
        minimumFractionDigits: 0 
    }).format(valor);
}

// Formatear fecha
export function formatDate(date) {
    return new Date(date).toISOString().slice(0, 10);
}

// Obtener fecha actual
export function getToday() {
    return new Date().toISOString().slice(0, 10);
}

// Mostrar toast notification
export function mostrarToast(msg, tipo = "info") {
    const toast = document.createElement('div');
    toast.innerText = msg;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = tipo === "success" ? "#2a7f3b" : "#2c1b12";
    toast.style.color = '#ffefcf';
    toast.style.padding = '10px 24px';
    toast.style.borderRadius = '40px';
    toast.style.zIndex = '9999';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2200);
}

// Reproducir sonido beep
export function playBeep(frecuencia = 800, duracion = 120) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.frequency.value = frecuencia;
        gainNode.gain.value = 0.2;
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duracion / 1000);
        oscillator.stop(audioCtx.currentTime + duracion / 1000);
    } catch (e) { console.log("Audio no soportado"); }
}

// Destello visual en elemento
export function flashElement(elemento) {
    if (!elemento) return;
    elemento.classList.add('flash');
    setTimeout(() => elemento.classList.remove('flash'), 300);
}

// Play tap sound
export function playTap() {
    playBeep(1200, 60);
}