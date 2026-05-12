import { supabase } from '../supabase-client.js';
import { formatCOP, formatDate, mostrarToast, playTap, getToday } from '../utils.js';
import { isAdmin } from '../auth.js';

let estado = {
    turnoManana: null,
    turnoTarde: null,
    ventasDiariasHistorial: [],
    refreshCallback: null
};

let chartInstance = null;

export function initPanaderiaModule(config) {
    estado = { ...estado, ...config };
}

export function renderPanaderia(container, data) {
    estado = { ...estado, ...data };
    
    const ventasManana = estado.turnoManana?.ventas.reduce((s,v)=>s+v.total,0) || 0;
    const ventasTarde = estado.turnoTarde?.ventas.reduce((s,v)=>s+v.total,0) || 0;
    const hoy = getToday();
    
    container.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-title">🥖 PRODUCCIÓN HOY</div><div class="stat-value" id="produccionHoy">0</div></div>
            <div class="stat-card"><div class="stat-title">🌅 VENTAS MAÑANA</div><div class="stat-value" id="ventasMananaCard">${formatCOP(ventasManana)}</div></div>
            <div class="stat-card"><div class="stat-title">🌆 VENTAS TARDE</div><div class="stat-value" id="ventasTardeCard">${formatCOP(ventasTarde)}</div></div>
            <div class="stat-card"><div class="stat-title">📈 PROMEDIO DIARIO</div><div class="stat-value" id="promedioDiario">$0</div></div>
        </div>
        
        <div class="admin-section">
            <h2>🥖 PRODUCCIÓN DIARIA</h2>
            <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 20px;">
                <select id="selectProductoProduccion" style="flex:2;"></select>
                <input type="number" id="cantidadProducida" placeholder="Cantidad" style="flex:1;">
                <button id="btnRegistrarProduccion" class="btn-primary" style="width: auto;">➕ Registrar producción</button>
            </div>
            
            <div id="listaProduccionHoy" style="background:#f7ecdd; border-radius: 30px; padding: 18px;">
                <h3>📦 Producción de hoy</h3>
                <div id="produccionRegistros">No hay registros de producción hoy</div>
            </div>
        </div>
        
        ${isAdmin() ? `
        <div class="admin-section">
            <h2>📊 ESTADÍSTICAS DE VENTAS</h2>
            <canvas id="ventasChart" style="max-height: 300px;"></canvas>
            
            <div style="display: flex; gap: 20px; flex-wrap: wrap; margin-top: 20px;">
                <div style="flex:1;">
                    <h3>🔥 Productos más vendidos (hoy)</h3>
                    <div id="topProductosHoy" style="background:#f7ecdd; border-radius: 30px; padding: 12px;"></div>
                </div>
                <div style="flex:1;">
                    <h3>🏆 Ranking empleados</h3>
                    <div id="rankingEmpleados" style="background:#f7ecdd; border-radius: 30px; padding: 12px;"></div>
                </div>
            </div>
        </div>
        ` : ''}
    `;
    
    renderSelectProductos();
    renderProduccionHoy();
    if (isAdmin()) {
        renderGraficoVentas();
        renderTopProductos();
        renderRankingEmpleados();
    }
    initEventosPanaderia();
}

function renderSelectProductos() {
    const select = document.getElementById('selectProductoProduccion');
    if (select) {
        select.innerHTML = '<option value="">Seleccionar producto</option>';
        estado.inventario?.forEach(prod => {
            select.innerHTML += `<option value="${prod.id}">${prod.nombre} (stock actual: ${prod.cantidad})</option>`;
        });
    }
}

function renderProduccionHoy() {
    // Simular registros de producción (esto se podria guardar en una tabla aparte "produccion")
    // Por ahora mostramos productos con bajo stock sugeridos
    const productosBajoStock = estado.inventario?.filter(p => p.cantidad < 10 && p.cantidad > 0) || [];
    const container = document.getElementById('produccionRegistros');
    if (container) {
        if (productosBajoStock.length === 0) {
            container.innerHTML = '✅ Todos los productos tienen stock suficiente. ¡Buen trabajo!';
        } else {
            let html = '<ul>';
            productosBajoStock.forEach(p => {
                html += `<li><strong>${p.nombre}</strong> - Stock actual: ${p.cantidad} uds. <span style="color:#e67e22;">⚠️ Sugerir producción</span></li>`;
            });
            html += '</ul>';
            container.innerHTML = html;
        }
    }
}

async function registrarProduccion() {
    const productoId = parseInt(document.getElementById('selectProductoProduccion').value);
    const cantidad = parseInt(document.getElementById('cantidadProducida').value);
    
    if (!productoId || isNaN(cantidad) || cantidad <= 0) {
        alert('Selecciona un producto y una cantidad válida');
        return;
    }
    
    const producto = estado.inventario.find(p => p.id === productoId);
    if (!producto) return;
    
    producto.cantidad += cantidad;
    await supabase.from('productos').update(producto).eq('id', productoId);
    
    mostrarToast(`Producción registrada: ${cantidad} uds de ${producto.nombre}`, 'success');
    playTap();
    
    document.getElementById('cantidadProducida').value = '';
    await estado.refreshCallback?.();
    renderSelectProductos();
    renderProduccionHoy();
}

function renderGraficoVentas() {
    const ctx = document.getElementById('ventasChart')?.getContext('2d');
    if (!ctx) return;
    
    const labels = estado.ventasDiariasHistorial?.map(h => h.fecha.slice(5)) || [];
    const datos = estado.ventasDiariasHistorial?.map(h => h.totalVentas) || [];
    
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Ventas COP', data: datos, backgroundColor: '#d9944a' }] },
        options: { responsive: true, maintainAspectRatio: true }
    });
    
    // Calcular promedio
    const promedio = datos.length ? datos.reduce((a,b)=>a+b,0) / datos.length : 0;
    document.getElementById('promedioDiario').innerHTML = formatCOP(promedio);
    document.getElementById('produccionHoy').innerHTML = estado.inventario?.reduce((s,p) => s + p.cantidad, 0) || 0;
}

function renderTopProductos() {
    const ventasHoy = [...(estado.turnoManana?.ventas || []), ...(estado.turnoTarde?.ventas || [])];
    const prodMap = new Map();
    ventasHoy.forEach(venta => {
        venta.productos.forEach(p => {
            prodMap.set(p.nombre, (prodMap.get(p.nombre) || 0) + p.cantidad);
        });
    });
    const top = Array.from(prodMap.entries()).sort((a,b) => b[1] - a[1]).slice(0, 5);
    const container = document.getElementById('topProductosHoy');
    if (container) {
        if (top.length === 0) {
            container.innerHTML = 'Sin ventas registradas hoy';
        } else {
            container.innerHTML = `<ul>${top.map(([n,c]) => `<li>🍞 ${n}: ${c} unidades</li>`).join('')}</ul>`;
        }
    }
}

function renderRankingEmpleados() {
    const ventasHoy = [...(estado.turnoManana?.ventas || []), ...(estado.turnoTarde?.ventas || [])];
    const empMap = new Map();
    ventasHoy.forEach(v => {
        empMap.set(v.empleado, (empMap.get(v.empleado) || 0) + v.total);
    });
    const ranking = Array.from(empMap.entries()).sort((a,b) => b[1] - a[1]);
    const container = document.getElementById('rankingEmpleados');
    if (container) {
        if (ranking.length === 0) {
            container.innerHTML = 'Sin ventas registradas hoy';
        } else {
            container.innerHTML = `<ul>${ranking.map(([e,t]) => `<li>👤 ${e}: ${formatCOP(t)}</li>`).join('')}</ul>`;
        }
    }
}

export function actualizarStatsPanaderia(data) {
    estado.turnoManana = data.turnoManana;
    estado.turnoTarde = data.turnoTarde;
    if (document.getElementById('ventasMananaCard')) {
        const ventasManana = estado.turnoManana?.ventas.reduce((s,v)=>s+v.total,0) || 0;
        const ventasTarde = estado.turnoTarde?.ventas.reduce((s,v)=>s+v.total,0) || 0;
        document.getElementById('ventasMananaCard').innerHTML = formatCOP(ventasManana);
        document.getElementById('ventasTardeCard').innerHTML = formatCOP(ventasTarde);
    }
    if (isAdmin()) {
        renderTopProductos();
        renderRankingEmpleados();
        renderGraficoVentas();
    }
}

function initEventosPanaderia() {
    document.getElementById('btnRegistrarProduccion')?.addEventListener('click', registrarProduccion);
}
