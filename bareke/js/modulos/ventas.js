import { supabase } from '../supabase-client.js';
import { formatCOP, mostrarToast, playTap, playBeep, flashElement, getToday } from '../utils.js';
import { isAdmin } from '../auth.js';

let estado = {
    inventario: [],
    cart: [],
    cajaTotal: 0,
    currentShift: null,
    currentUser: null,
    turnoManana: null,
    turnoTarde: null,
    refreshCallback: null
};

export function initVentasModule(config) {
    estado = { ...estado, ...config };
}

export function renderVentas(container, data) {
    estado = { ...estado, ...data };
    
    container.innerHTML = `
        <!-- Stats cards -->
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-title">💰 CAJA TOTAL</div><div class="stat-value" id="statsCaja">${formatCOP(estado.cajaTotal)}</div></div>
            <div class="stat-card"><div class="stat-title">📈 VENTAS HOY</div><div class="stat-value" id="statsVentas">$0</div></div>
            <div class="stat-card"><div class="stat-title">💳 VENTAS POR NEQUI</div><div class="stat-value" id="statsNequi">$0</div></div>
            <div class="stat-card"><div class="stat-title">📉 GASTOS HOY</div><div class="stat-value" id="statsGastos">$0</div></div>
        </div>
        
        <div class="sales-layout">
            <!-- Panel POS -->
            <div class="pos-panel">
                <h2>🛒 PUNTO DE VENTA (POS)</h2>
                <input type="text" id="productSearch" class="search-box" placeholder="🔍 Buscar producto...">
                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <button id="btnQuickAdd1" class="btn-primary" style="background:#2f8b46;">+1 Rápido</button>
                    <button id="btnQuickAdd2" class="btn-primary" style="background:#2f8b46;">+2 Rápido</button>
                </div>
                <div class="pos-buttons" id="posButtonsContainer"></div>
                <div id="productListPOS" class="product-list-pos"></div>
            </div>
            
            <!-- Panel Carrito -->
            <div class="cart-panel">
                <h2>🛒 CARRITO DE VENTAS</h2>
                <div id="cartContainer" style="min-height: 150px; max-height: 300px; overflow-y: auto; margin-bottom: 15px;"></div>
                <div class="cart-total">Total: <span id="cartTotal">$0</span></div>
                <div class="form-group">
                    <label>➕ Agregar producto</label>
                    <select id="cartProductSelect"></select>
                    <input type="number" id="cartCantidad" value="1" min="1">
                    <button id="btnAddToCart" class="btn-primary" style="background:#6c757d;">Añadir al carrito</button>
                </div>
                <div class="payment-group" style="background:#f3e5d4; border-radius: 40px; padding: 12px; margin: 10px 0;">
                    <label>💵 Método de pago:</label>
                    <div class="radio-group">
                        <label><input type="radio" name="metodoPagoCarrito" value="efectivo" checked> Efectivo</label>
                        <label><input type="radio" name="metodoPagoCarrito" value="nequi"> Nequi</label>
                    </div>
                </div>
                <div id="efectivoSection">
                    <label>💸 Monto recibido (COP)</label>
                    <input type="number" id="montoRecibido" placeholder="0">
                    <div id="cambioDisplay" class="change-display">💰 Cambio: $0</div>
                </div>
                <button id="btnConfirmarVenta" class="btn-primary">✅ CONFIRMAR VENTA</button>
                <button id="btnLimpiarCarrito" class="btn-primary btn-secondary">🗑️ Limpiar carrito</button>
                <hr style="margin: 18px 0;">
                <h3>🧾 Gastos de mi turno</h3>
                <input type="text" id="gastoConcepto" placeholder="Concepto (ej. harina)">
                <input type="number" id="gastoValor" placeholder="Valor COP">
                <button id="btnAgregarGasto" class="btn-primary">➕ AGREGAR GASTO</button>
                <div id="gastosTurnoList" style="background:#f3e5d4; border-radius: 25px; padding: 12px; margin-top: 12px;"></div>
                <div style="background:#e4cfb5; border-radius: 25px; padding: 12px; margin-top: 12px;">
                    <strong>📊 Mi aporte neto:</strong> <span id="miAporteNeto">$0</span><br>
                    <strong>💳 Nequi en mi turno:</strong> <span id="miNequiTotal">$0</span>
                </div>
            </div>
        </div>
        
        ${isAdmin() ? `
        <div class="admin-section">
            <h2>📊 REPORTES DE VENTAS</h2>
            <div class="filter-group">
                <input type="date" id="filterFechaDesde" placeholder="Desde">
                <input type="date" id="filterFechaHasta" placeholder="Hasta">
                <select id="filterEmpleado"><option value="">Todos los empleados</option></select>
                <select id="filterTurno"><option value="">Todos los turnos</option><option value="mañana">Mañana</option><option value="tarde">Tarde</option></select>
                <button id="btnAplicarFiltros" class="btn-primary" style="width: auto;">Filtrar</button>
            </div>
            <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-bottom: 20px;">
                <button id="btnExportCSV" class="btn-primary">📎 Exportar CSV</button>
                <button id="btnPrintPDF" class="btn-primary">🖨️ Imprimir</button>
                <button id="btnBackupManual" class="btn-primary">💾 Backup</button>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 20px;">
                <div style="flex: 2;"><h3>📈 Ventas</h3><canvas id="ventasChart" style="max-height: 250px;"></canvas></div>
                <div style="flex: 1;"><h3>🔥 Productos más vendidos</h3><div id="topProductosList" style="background:#f7ecdd; border-radius: 25px; padding: 12px;"></div></div>
                <div style="flex: 1;"><h3>🏆 Ranking empleados</h3><div id="rankingEmpleadosList" style="background:#f7ecdd; border-radius: 25px; padding: 12px;"></div></div>
            </div>
        </div>
        ` : ''}
    `;
    
    actualizarStatsCards();
    renderProductosPOS();
    renderCarritoUI();
    initEventosVentas();
}

function actualizarStatsCards() {
    const ventasManana = estado.turnoManana?.ventas.reduce((s,v)=>s+v.total,0) || 0;
    const ventasTarde = estado.turnoTarde?.ventas.reduce((s,v)=>s+v.total,0) || 0;
    const totalVentas = ventasManana + ventasTarde;
    const nequiManana = estado.turnoManana?.ventas.filter(v=>v.metodo_pago==="nequi").reduce((s,v)=>s+v.total,0) || 0;
    const nequiTarde = estado.turnoTarde?.ventas.filter(v=>v.metodo_pago==="nequi").reduce((s,v)=>s+v.total,0) || 0;
    const gastosManana = estado.turnoManana?.gastos.reduce((s,g)=>s+g.valor,0) || 0;
    const gastosTarde = estado.turnoTarde?.gastos.reduce((s,g)=>s+g.valor,0) || 0;
    
    document.getElementById('statsVentas').innerText = formatCOP(totalVentas);
    document.getElementById('statsNequi').innerText = formatCOP(nequiManana + nequiTarde);
    document.getElementById('statsGastos').innerText = formatCOP(gastosManana + gastosTarde);
    document.getElementById('statsCaja').innerText = formatCOP(estado.cajaTotal);
}

export function actualizarStatsVentas(data) {
    estado.cajaTotal = data.cajaTotal;
    estado.turnoManana = data.turnoManana;
    estado.turnoTarde = data.turnoTarde;
    if (document.getElementById('statsCaja')) {
        actualizarStatsCards();
    }
}

function renderProductosPOS() {
    const searchTerm = document.getElementById('productSearch')?.value.toLowerCase() || '';
    const filtered = estado.inventario.filter(p => p.nombre.toLowerCase().includes(searchTerm));
    const container = document.getElementById('productListPOS');
    
    if (container) {
        container.innerHTML = '';
        filtered.forEach(prod => {
            const stockClass = prod.cantidad === 0 ? 'stock-cero' : (prod.cantidad < 5 ? 'stock-bajo' : '');
            const stockText = prod.cantidad === 0 ? 'AGOTADO' : (prod.cantidad < 5 ? `⚠️ Stock bajo: ${prod.cantidad}` : `Stock: ${prod.cantidad}`);
            const div = document.createElement('div');
            div.className = 'product-pos-item';
            div.innerHTML = `<span><strong>${prod.nombre}</strong> · ${formatCOP(prod.precio)}<br><span class="${stockClass}">${stockText}</span></span>
                            <button class="btn-sell-pos" data-id="${prod.id}" style="background:#2f8b46; border:none; padding:4px 12px; border-radius:30px; color:white;" ${prod.cantidad===0 ? 'disabled' : ''}>+1</button>`;
            container.appendChild(div);
        });
        
        document.querySelectorAll('.btn-sell-pos').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                playTap();
                flashElement(btn);
                const id = parseInt(btn.dataset.id);
                agregarAlCarrito(id, 1);
            });
        });
    }
    
    // Botones rápidos
    const posBtns = document.getElementById('posButtonsContainer');
    if (posBtns) {
        posBtns.innerHTML = '';
        estado.inventario.slice(0, 12).forEach(prod => {
            const btn = document.createElement('button');
            btn.className = 'pos-product-btn';
            btn.innerText = `${prod.nombre}\n${formatCOP(prod.precio)}`;
            if (prod.cantidad === 0) btn.style.opacity = '0.5';
            btn.onclick = () => { playTap(); flashElement(btn); agregarAlCarrito(prod.id, 1); };
            posBtns.appendChild(btn);
        });
    }
    
    // Select carrito
    const selectCart = document.getElementById('cartProductSelect');
    if (selectCart) {
        selectCart.innerHTML = '';
        estado.inventario.forEach(p => {
            selectCart.innerHTML += `<option value="${p.id}">${p.nombre} - ${formatCOP(p.precio)} (stock ${p.cantidad})</option>`;
        });
    }
}

function renderCarritoUI() {
    const container = document.getElementById('cartContainer');
    if (!container) return;
    
    if (estado.cart.length === 0) {
        container.innerHTML = "<div style='text-align:center; padding:20px; color:#aa7a4c;'>🛒 Carrito vacío</div>";
        document.getElementById('cartTotal').innerText = formatCOP(0);
        return;
    }
    
    let html = '', total = 0;
    estado.cart.forEach((item, idx) => {
        total += item.subtotal;
        html += `<div class="cart-item">
                    <span><strong>${item.nombre}</strong> x${item.cantidad} = ${formatCOP(item.subtotal)}</span>
                    <div class="cart-controls">
                        <button class="cart-minus" data-idx="${idx}">-</button>
                        <span>${item.cantidad}</span>
                        <button class="cart-plus" data-idx="${idx}">+</button>
                        <button class="cart-remove" data-idx="${idx}">🗑️</button>
                    </div>
                </div>`;
    });
    container.innerHTML = html;
    document.getElementById('cartTotal').innerText = formatCOP(total);
    
    // Eventos del carrito
    document.querySelectorAll('.cart-minus').forEach(btn => btn.onclick = () => {
        const idx = parseInt(btn.dataset.idx);
        if (estado.cart[idx].cantidad > 1) {
            estado.cart[idx].cantidad--;
            estado.cart[idx].subtotal = estado.cart[idx].cantidad * estado.cart[idx].precioUnitario;
        } else {
            estado.cart.splice(idx, 1);
        }
        renderCarritoUI();
        calcularCambio();
    });
    
    document.querySelectorAll('.cart-plus').forEach(btn => btn.onclick = () => {
        const idx = parseInt(btn.dataset.idx);
        const prod = estado.inventario.find(p => p.id === estado.cart[idx].productId);
        if (prod && prod.cantidad >= estado.cart[idx].cantidad + 1) {
            estado.cart[idx].cantidad++;
            estado.cart[idx].subtotal = estado.cart[idx].cantidad * estado.cart[idx].precioUnitario;
        } else {
            alert("Stock insuficiente");
        }
        renderCarritoUI();
        calcularCambio();
    });
    
    document.querySelectorAll('.cart-remove').forEach(btn => btn.onclick = () => {
        const idx = parseInt(btn.dataset.idx);
        estado.cart.splice(idx, 1);
        renderCarritoUI();
        calcularCambio();
    });
    
    calcularCambio();
}

function agregarAlCarrito(productId, cantidad) {
    const prod = estado.inventario.find(p => p.id === productId);
    if (!prod || cantidad <= 0) return;
    if (prod.cantidad < cantidad) {
        alert(`Stock insuficiente de ${prod.nombre}`);
        return;
    }
    const existente = estado.cart.find(i => i.productId === productId);
    if (existente) {
        if (prod.cantidad >= existente.cantidad + cantidad) {
            existente.cantidad += cantidad;
            existente.subtotal = existente.cantidad * existente.precioUnitario;
        } else {
            alert(`No hay suficiente stock para añadir más ${prod.nombre}`);
        }
    } else {
        estado.cart.push({
            productId,
            nombre: prod.nombre,
            cantidad,
            precioUnitario: prod.precio,
            subtotal: prod.precio * cantidad
        });
    }
    renderCarritoUI();
}

function calcularCambio() {
    const metodo = document.querySelector('input[name="metodoPagoCarrito"]:checked').value;
    const efectivoSec = document.getElementById('efectivoSection');
    if (metodo === 'nequi') {
        efectivoSec.style.display = 'none';
        document.getElementById('cambioDisplay').innerText = '💰 (Nequi: no aplica cambio)';
        return;
    }
    efectivoSec.style.display = 'block';
    const total = estado.cart.reduce((s, i) => s + i.subtotal, 0);
    const recibido = parseFloat(document.getElementById('montoRecibido').value) || 0;
    const cambio = recibido - total;
    document.getElementById('cambioDisplay').innerHTML = cambio >= 0 ? `💰 Cambio: ${formatCOP(cambio)}` : `⚠️ Falta dinero: ${formatCOP(Math.abs(cambio))}`;
}

async function confirmarVenta() {
    if (estado.cart.length === 0) {
        alert("Carrito vacío");
        return;
    }
    
    const metodo = document.querySelector('input[name="metodoPagoCarrito"]:checked').value;
    const total = estado.cart.reduce((s, i) => s + i.subtotal, 0);
    
    if (metodo === 'efectivo') {
        const recibido = parseFloat(document.getElementById('montoRecibido').value) || 0;
        if (recibido < total) {
            alert(`Faltan ${formatCOP(total - recibido)}`);
            return;
        }
        estado.cajaTotal += total;
        await guardarCaja();
    }
    
    // Descontar stock
    for (const item of estado.cart) {
        const prod = estado.inventario.find(p => p.id === item.productId);
        if (prod.cantidad < item.cantidad) {
            alert(`Stock insuficiente de ${item.nombre}`);
            return;
        }
        prod.cantidad -= item.cantidad;
        await actualizarProducto(prod);
    }
    
    const turnoId = estado.currentShift === 'manana' ? 'manana' : 'tarde';
    const ventaReg = {
        turno_id: turnoId,
        productos: estado.cart.map(i => ({
            nombre: i.nombre,
            cantidad: i.cantidad,
            precioUnitario: i.precioUnitario,
            subtotal: i.subtotal
        })),
        total,
        metodo_pago: metodo,
        hora: new Date().toLocaleTimeString(),
        empleado: estado.currentUser?.nombre || "Admin",
        fecha: getToday()
    };
    
    await guardarVenta(ventaReg, turnoId);
    
    // Limpiar carrito
    estado.cart = [];
    document.getElementById('montoRecibido').value = '';
    
    renderCarritoUI();
    renderProductosPOS();
    await estado.refreshCallback?.();
    
    mostrarToast(`Venta registrada: ${formatCOP(total)} (${metodo === 'nequi' ? 'Nequi' : 'Efectivo'})`, 'success');
    playBeep(1000, 200);
    flashElement(document.querySelector('.cart-panel'));
}

async function guardarCaja() {
    await supabase.from('caja').insert({ total: estado.cajaTotal });
}

async function guardarVenta(venta, turnoId) {
    await supabase.from('ventas').insert(venta);
}

async function actualizarProducto(producto) {
    await supabase.from('productos').update(producto).eq('id', producto.id);
}

async function registrarGasto() {
    const concepto = document.getElementById('gastoConcepto').value;
    const valor = parseInt(document.getElementById('gastoValor').value);
    if (!concepto.trim() || isNaN(valor) || valor <= 0) {
        alert("Datos inválidos");
        return;
    }
    
    estado.cajaTotal -= valor;
    await guardarCaja();
    
    const turnoId = estado.currentShift === 'manana' ? 'manana' : 'tarde';
    const gastoReg = {
        turno_id: turnoId,
        concepto,
        valor,
        hora: new Date().toLocaleTimeString(),
        empleado: estado.currentUser?.nombre,
        fecha: getToday()
    };
    
    await supabase.from('gastos').insert(gastoReg);
    await estado.refreshCallback?.();
    
    document.getElementById('gastoConcepto').value = '';
    document.getElementById('gastoValor').value = '';
    mostrarToast(`Gasto: ${concepto} - ${formatCOP(valor)}`);
    playTap();
}

function initEventosVentas() {
    document.getElementById('btnAddToCart')?.addEventListener('click', () => {
        const prodId = parseInt(document.getElementById('cartProductSelect').value);
        const cantidad = parseInt(document.getElementById('cartCantidad').value);
        agregarAlCarrito(prodId, cantidad);
        document.getElementById('cartCantidad').value = 1;
    });
    
    document.getElementById('btnConfirmarVenta')?.addEventListener('click', confirmarVenta);
    document.getElementById('btnLimpiarCarrito')?.addEventListener('click', () => {
        estado.cart = [];
        renderCarritoUI();
    });
    
    document.getElementById('btnAgregarGasto')?.addEventListener('click', registrarGasto);
    document.getElementById('montoRecibido')?.addEventListener('input', calcularCambio);
    document.querySelectorAll('input[name="metodoPagoCarrito"]').forEach(r => r.addEventListener('change', calcularCambio));
    
    document.getElementById('btnQuickAdd1')?.addEventListener('click', () => {
        const select = document.getElementById('cartProductSelect');
        if (select && select.value) agregarAlCarrito(parseInt(select.value), 1);
    });
    
    document.getElementById('btnQuickAdd2')?.addEventListener('click', () => {
        const select = document.getElementById('cartProductSelect');
        if (select && select.value) agregarAlCarrito(parseInt(select.value), 2);
    });
    
    document.getElementById('productSearch')?.addEventListener('input', renderProductosPOS);
    
    // Mostrar info del turno actual
    if (estado.currentShift && estado.currentUser?.tipo !== 'admin') {
        const turnoActual = estado.currentShift === 'manana' ? estado.turnoManana : estado.turnoTarde;
        const misVentas = turnoActual?.ventas.reduce((s, v) => s + v.total, 0) || 0;
        const misGastos = turnoActual?.gastos.reduce((s, g) => s + g.valor, 0) || 0;
        const miNequi = turnoActual?.ventas.filter(v => v.metodo_pago === 'nequi').reduce((s, v) => s + v.total, 0) || 0;
        
        document.getElementById('miAporteNeto').innerText = formatCOP(misVentas - misGastos);
        document.getElementById('miNequiTotal').innerText = formatCOP(miNequi);
        
        let gastosHtml = '';
        turnoActual?.gastos.forEach(g => {
            gastosHtml += `<div style="display:flex;justify-content:space-between;"><span>${g.concepto}</span><span>${formatCOP(g.valor)}</span></div>`;
        });
        document.getElementById('gastosTurnoList').innerHTML = gastosHtml || 'Sin gastos';
    }
}