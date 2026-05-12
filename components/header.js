import { formatCOP, formatDate } from '../utils.js';

export function HeaderComponent(container, user, onLogout, onRefresh) {
    const fecha = new Date();
    const fechaStr = fecha.toLocaleDateString('es-CO', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    container.innerHTML = `
        <div class="app-header">
            <div class="logo-area">
                <div class="big-b">B</div>
                <div>
                    <div class="logo-text">AREKE</div>
                    <div class="logo-sub">bakery & coffee</div>
                </div>
            </div>
            <div class="user-info">
                <div class="user-badge">
                    👤 ${user?.nombre || 'Usuario'} 
                    ${user?.tipo === 'admin' ? '👑 Admin' : '👨‍🍳 Empleado'}
                </div>
                <div class="fecha-badge">📅 ${fechaStr}</div>
            </div>
            <div class="header-actions">
                <button class="refresh-btn" id="refreshBtn">🔄</button>
                <button class="logout-btn" id="headerLogoutBtn">🚪 Salir</button>
            </div>
        </div>
    `;
    
    document.getElementById('headerLogoutBtn')?.addEventListener('click', () => {
        onLogout();
        window.location.reload();
    });
    
    document.getElementById('refreshBtn')?.addEventListener('click', () => {
        if (onRefresh) onRefresh();
    });
}
