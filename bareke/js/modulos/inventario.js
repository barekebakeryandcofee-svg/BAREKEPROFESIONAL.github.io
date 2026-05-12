import { supabase } from '../supabase-client.js';
import { formatCOP, mostrarToast, playTap, flashElement } from '../utils.js';
import { isAdmin } from '../auth.js';

let estado = {
    inventario: [],
    refreshCallback: null
};

export function initInventarioModule(config) {
    estado = { ...estado, ...config };
}

export function renderInventario(container, data) {
    estado = { ...estado, ...data };
    
    container.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-title">📦 TOTAL PRODUCTOS</div><div class="stat-value" id="totalProductos">${estado.inventario.length}</div></div>
            <div class="stat-card"><div class="stat-title">⚠️ STOCK BAJO</div><div class="stat-value" id="stockBajoCount">${estado.inventario.filter(p => p.cantidad < 5 && p.cantidad > 0).length}</div></div>
            <div class="stat-card"><div class="stat-title">❌ AGOTADOS</div><div class="stat-value" id="agotadosCount">${estado.inventario.filter(p => p.cantidad === 0).length}</div></div>
            <div class="stat-card"><div class="stat-title">💰 VALOR INVENTARIO</div><div class="stat-value" id="valorInventario">${formatCOP(estado.inventario.reduce((s,p) => s + (p.precio * p.cantidad), 0))}</div></div>
        </div>
        
        <div class="admin-section">
            <h2>📦 GESTIÓN DE INVENTARIO</h2>
            <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 20px;">
                <input type="text" id="searchProducto" placeholder="🔍 Buscar producto..." style="flex:2;">
                <button id="btnNuevoProducto" class="btn-primary" style="width: auto;">➕ Nuevo producto</button>
                <button id="btnExportarInventario" class="btn-primary" style="width: auto;">📎 Exportar</button>
            </div>
            
            <div id="listaProductos" class="productos-lista">
                <!-- Aquí se cargarán los productos -->
            </div>
        </div>
        
        <!-- Modal para editar/crear producto -->
        <div id="productoModal" class="modal" style="display: none;">
            <div class="modal-content">
                <h3 id="modalTitle">✏️ Producto</h3>
                <input type="text" id="prodId" hidden>
                <label>Nombre (con emoji)</label>
                <input type="text" id="prodNombre">
                <label>Precio (COP)</label>
                <input type="number" id="prodPrecio" step="100">
                <label>Cantidad (stock)</label>
                <input type="number" id="prodCantidad" step="1">
                <div style="display: flex; gap: 10px; margin-top: 15px;">
                    <button id="btnGuardarProducto" class="btn-primary">Guardar</button>
                    <button id="btnCancelarModal" class="btn-primary btn-secondary">Cancelar</button>
                </div>
            </div>
        </div>
    `;
    
    renderizarListaProductos();
    initEventosInventario();
}

function renderizarListaProductos() {
    const searchTerm = document.getElementById('searchProducto')?.value.toLowerCase() || '';
    const filtrados = estado.inventario.filter(p => p.nombre.toLowerCase().includes(searchTerm));
    const container = document.getElementById('listaProductos');
    
    if (!container) return;
    
    container.innerHTML = `
        <div class="producto-item" style="background:#e8d5bd; font-weight:bold;">
            <span>📦 Producto</span>
            <span>💰 Precio</span>
            <span>📊 Stock</span>
            <span>⚙️ Acciones</span>
        </div>
    `;
    
    filtrados.forEach(prod => {
        const stockClass = prod.cantidad === 0 ? 'stock-cero' : (prod.cantidad < 5 ? 'stock-bajo' : '');
        const div = document.createElement('div');
        div.className = 'producto-item';
        div.innerHTML = `
            <span><strong>${prod.nombre}</strong></span>
            <span>${formatCOP(prod.precio)}</span>
            <span class="${stockClass}">${prod.cantidad} uds</span>
            <div style="display: flex; gap: 8px;">
                <button class="btn-edit-product" data-id="${prod.id}" style="background:#d9944a; border:none; border-radius:25px; padding:4px 12px; color:white;">✏️ Editar</button>
                ${isAdmin() ? `<button class="btn-delete-product" data-id="${prod.id}" style="background:#dc3545; border:none; border-radius:25px; padding:4px 12px; color:white;">🗑️</button>` : ''}
            </div>
        `;
        container.appendChild(div);
    });
    
    document.querySelectorAll('.btn-edit-product').forEach(btn => {
        btn.onclick = () => abrirModalEdicion(parseInt(btn.dataset.id));
    });
    
    document.querySelectorAll('.btn-delete-product').forEach(btn => {
        btn.onclick = async () => {
            if (confirm('¿Eliminar este producto permanentemente?')) {
                const id = parseInt(btn.dataset.id);
                await supabase.from('productos').delete().eq('id', id);
                await estado.refreshCallback?.();
                mostrarToast('Producto eliminado');
                renderizarListaProductos();
            }
        };
    });
    
    // Actualizar estadísticas
    document.getElementById('totalProductos').innerText = estado.inventario.length;
    document.getElementById('stockBajoCount').innerText = estado.inventario.filter(p => p.cantidad < 5 && p.cantidad > 0).length;
    document.getElementById('agotadosCount').innerText = estado.inventario.filter(p => p.cantidad === 0).length;
    document.getElementById('valorInventario').innerHTML = formatCOP(estado.inventario.reduce((s,p) => s + (p.precio * p.cantidad), 0));
}

export function actualizarStatsInventario(data) {
    estado.inventario = data.inventario;
    if (document.getElementById('listaProductos')) {
        renderizarListaProductos();
    }
}

function abrirModalEdicion(id) {
    const prod = estado.inventario.find(p => p.id === id);
    if (!prod) return;
    document.getElementById('modalTitle').innerText = '✏️ Editar producto';
    document.getElementById('prodId').value = prod.id;
    document.getElementById('prodNombre').value = prod.nombre;
    document.getElementById('prodPrecio').value = prod.precio;
    document.getElementById('prodCantidad').value = prod.cantidad;
    document.getElementById('productoModal').style.display = 'flex';
}

function abrirModalNuevo() {
    document.getElementById('modalTitle').innerText = '➕ Nuevo producto';
    document.getElementById('prodId').value = '';
    document.getElementById('prodNombre').value = '';
    document.getElementById('prodPrecio').value = '';
    document.getElementById('prodCantidad').value = '';
    document.getElementById('productoModal').style.display = 'flex';
}

async function guardarProducto() {
    const id = document.getElementById('prodId').value;
    const nombre = document.getElementById('prodNombre').value.trim();
    const precio = parseInt(document.getElementById('prodPrecio').value);
    const cantidad = parseInt(document.getElementById('prodCantidad').value);
    
    if (!nombre || isNaN(precio) || isNaN(cantidad)) {
        alert('Complete todos los campos correctamente');
        return;
    }
    
    if (id) {
        // Actualizar
        await supabase.from('productos').update({ nombre, precio, cantidad }).eq('id', parseInt(id));
        mostrarToast('Producto actualizado', 'success');
    } else {
        // Crear nuevo
        const nuevoId = Math.max(...estado.inventario.map(p => p.id), 0) + 1;
        await supabase.from('productos').insert({ id: nuevoId, nombre, precio, cantidad });
        mostrarToast('Producto creado', 'success');
    }
    
    document.getElementById('productoModal').style.display = 'none';
    await estado.refreshCallback?.();
    renderizarListaProductos();
}

function exportarInventario() {
    const csvRows = [['ID', 'Nombre', 'Precio', 'Stock']];
    estado.inventario.forEach(p => {
        csvRows.push([p.id, p.nombre, p.precio, p.cantidad]);
    });
    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `inventario_bareke_${new Date().toISOString().slice(0,19)}.csv`;
    link.click();
    mostrarToast('Inventario exportado', 'success');
}

function initEventosInventario() {
    document.getElementById('searchProducto')?.addEventListener('input', () => renderizarListaProductos());
    document.getElementById('btnNuevoProducto')?.addEventListener('click', abrirModalNuevo);
    document.getElementById('btnExportarInventario')?.addEventListener('click', exportarInventario);
    document.getElementById('btnGuardarProducto')?.addEventListener('click', guardarProducto);
    document.getElementById('btnCancelarModal')?.addEventListener('click', () => {
        document.getElementById('productoModal').style.display = 'none';
    });
}