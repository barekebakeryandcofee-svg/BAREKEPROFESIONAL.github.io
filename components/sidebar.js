export function SidebarComponent(container, onNavigate) {
    container.innerHTML = `
        <div class="app-sidebar">
            <div class="sidebar-title">🎯 MENÚ PRINCIPAL</div>
            <ul class="sidebar-nav">
                <li><a href="#" data-modulo="ventas">🛒 Punto de Venta</a></li>
                <li><a href="#" data-modulo="inventario">📦 Inventario</a></li>
                <li><a href="#" data-modulo="panaderia">🥖 Producción</a></li>
            </ul>
        </div>
    `;
    
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const modulo = link.dataset.modulo;
            if (modulo) {
                document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
                link.classList.add('active');
                onNavigate(modulo);
            }
        });
    });
    
    // Activar el primero por defecto
    const primerLink = document.querySelector('.sidebar-nav a');
    if (primerLink) primerLink.classList.add('active');
}
