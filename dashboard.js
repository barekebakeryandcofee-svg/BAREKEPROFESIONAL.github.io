import { supabase } from './supabase-client.js';
import { currentUser, currentShift, login, setTurno, logout, checkStoredSession, isAdmin, isEmployee } from './auth.js';
import { formatCOP, mostrarToast, playTap, playBeep, flashElement, getToday } from './utils.js';
import { HeaderComponent } from './components/header.js';
import { SidebarComponent } from './components/sidebar.js';

// Módulos
import { initVentasModule, renderVentas, actualizarStatsVentas } from './modulos/ventas.js';
import { initInventarioModule, renderInventario, actualizarStatsInventario } from './modulos/inventario.js';
import { initPanaderiaModule, renderPanaderia, actualizarStatsPanaderia } from './modulos/panaderia.js';

// Estado global
let moduloActual = 'ventas';
let inventario = [];
let cajaTotal = 0;
let turnoManana = { empleado: null, ventas: [], gastos: [] };
let turnoTarde = { empleado: null, ventas: [], gastos: [] };
let ventasDiariasHistorial = [];
let realtimeChannel = null;

// Inicialización principal
document.addEventListener('DOMContentLoaded', async () => {
    // Verificar sesión guardada
    if (checkStoredSession()) {
        // Hay sesión guardada, intentar restaurar datos
        await cargarDatosSupabase();
        mostrarDashboard();
        iniciarRealtime();
    } else {
        // Mostrar login
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
        initLoginEventos();
    }
});

function initLoginEventos() {
    const usernameInput = document.getElementById('loginUsername');
    const passwordInput = document.getElementById('loginPassword');
    const loginBtn = document.getElementById('loginBtn');
    const errorDiv = document.getElementById('loginError');
    const shiftDiv = document.getElementById('shiftSelectorDiv');
    const morningBtn = document.getElementById('shiftMorningBtn');
    const afternoonBtn = document.getElementById('shiftAfternoonBtn');
    
    let selectedShift = null;
    
    function updateShiftButtons() {
        morningBtn.classList.toggle('selected', selectedShift === 'manana');
        afternoonBtn.classList.toggle('selected', selectedShift === 'tarde');
    }
    
    morningBtn.onclick = () => { selectedShift = 'manana'; updateShiftButtons(); };
    afternoonBtn.onclick = () => { selectedShift = 'tarde'; updateShiftButtons(); };
    
    usernameInput.addEventListener('input', () => {
        shiftDiv.style.display = usernameInput.value.toLowerCase() === 'admin' ? 'none' : 'block';
    });
    
    // Botones de ojo
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const target = document.getElementById(btn.getAttribute('data-target'));
            if (target) target.type = target.type === 'password' ? 'text' : 'password';
        });
    });
    
    loginBtn.onclick = async () => {
        const username = usernameInput.value.trim().toLowerCase();
        const password = passwordInput.value;
        errorDiv.innerText = '';
        
        if (!username || !password) {
            errorDiv.innerText = '❌ Ingresa usuario y contraseña';
            return;
        }
        
        const result = await login(username, password);
        if (!result.success) {
            errorDiv.innerText = result.error;
            return;
        }
        
        if (result.user.tipo === 'admin') {
            await cargarDatosSupabase();
            mostrarDashboard();
            iniciarRealtime();
        } else {
            if (!selectedShift) {
                errorDiv.innerText = '❌ Selecciona un turno (Mañana o Tarde)';
                return;
            }
            await setTurno(selectedShift, result.user.nombre);
            await cargarDatosSupabase();
            mostrarDashboard();
            iniciarRealtime();
        }
    };
}

async function cargarDatosSupabase() {
    try {
        // Cargar productos
        const { data: productos } = await supabase.from('productos').select('*');
        inventario = productos || [];
        
        // Cargar caja
        const { data: cajaData } = await supabase.from('caja').select('total').order('id', { ascending: false }).limit(1);
        cajaTotal = (cajaData && cajaData[0]) ? cajaData[0].total : 280000;
        
        // Cargar turnos
        const { data: turnosData } = await supabase.from('turnos').select('*');
        turnoManana.empleado = turnosData?.find(t => t.id === 'manana')?.empleado || null;
        turnoTarde.empleado = turnosData?.find(t => t.id === 'tarde')?.empleado || null;
        
        // Cargar ventas y gastos del día
        const hoy = getToday();
        const { data: ventasHoy } = await supabase.from('ventas').select('*').eq('fecha', hoy);
        turnoManana.ventas = ventasHoy?.filter(v => v.turno_id === 'manana') || [];
        turnoTarde.ventas = ventasHoy?.filter(v => v.turno_id === 'tarde') || [];
        
        const { data: gastosHoy } = await supabase.from('gastos').select('*').eq('fecha', hoy);
        turnoManana.gastos = gastosHoy?.filter(g => g.turno_id === 'manana') || [];
        turnoTarde.gastos = gastosHoy?.filter(g => g.turno_id === 'tarde') || [];
        
        // Cargar historial
        const { data: historial } = await supabase.from('historial_ventas').select('*').order('fecha', { ascending: true }).limit(7);
        ventasDiariasHistorial = historial || [];
        
        // Actualizar estadísticas en módulos
        actualizarStatsVentas({ cajaTotal, turnoManana, turnoTarde });
        actualizarStatsInventario({ inventario });
        actualizarStatsPanaderia({ turnoManana, turnoTarde });
        
    } catch (e) {
        console.error("Error cargando datos:", e);
        mostrarToast("Error al cargar datos", "error");
    }
}

function iniciarRealtime() {
    if (realtimeChannel) supabase.removeChannel(realtimeChannel);
    realtimeChannel = supabase.channel('realtime-bareke')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas' }, () => cargarDatosSupabase())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'gastos' }, () => cargarDatosSupabase())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'productos' }, () => cargarDatosSupabase())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'caja' }, () => cargarDatosSupabase())
        .subscribe();
}

function mostrarDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    
    // Renderizar header y sidebar
    const headerContainer = document.getElementById('appHeader');
    const sidebarContainer = document.getElementById('appSidebar');
    
    HeaderComponent(headerContainer, currentUser, logout, () => cargarDatosSupabase());
    SidebarComponent(sidebarContainer, cambiarModulo);
    
    // Cargar módulo inicial
    cambiarModulo('ventas');
}

function cambiarModulo(modulo) {
    moduloActual = modulo;
    
    // Actualizar active en sidebar (se maneja desde el sidebar)
    const mainContent = document.getElementById('mainContent');
    
    switch(modulo) {
        case 'ventas':
            renderVentas(mainContent, {
                inventario,
                cajaTotal,
                turnoManana,
                turnoTarde,
                currentUser,
                currentShift,
                refreshData: cargarDatosSupabase
            });
            break;
        case 'inventario':
            renderInventario(mainContent, {
                inventario,
                refreshData: cargarDatosSupabase
            });
            break;
        case 'panaderia':
            renderPanaderia(mainContent, {
                turnoManana,
                turnoTarde,
                ventasDiariasHistorial,
                refreshData: cargarDatosSupabase
            });
            break;
        default:
            renderVentas(mainContent, {
                inventario,
                cajaTotal,
                turnoManana,
                turnoTarde,
                currentUser,
                currentShift,
                refreshData: cargarDatosSupabase
            });
    }
}

// Exportar datos necesarios para otros módulos
export { inventario, cajaTotal, turnoManana, turnoTarde, ventasDiariasHistorial, cargarDatosSupabase };