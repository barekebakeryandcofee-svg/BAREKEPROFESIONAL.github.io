import { supabase } from './supabase-client.js';
import { mostrarToast } from './utils.js';

// Estado global de autenticación
export let currentUser = null;
export let currentShift = null;

// Escuchar cambios en la autenticación
export function onAuthStateChange(callback) {
    // Simulamos el estado (esto sería con supabase.auth si usaramos auth real)
    // Por ahora manejamos usuarios desde nuestra tabla
}

// Login con credenciales de la tabla usuarios
export async function login(username, password) {
    try {
        const { data, error } = await supabase
            .from('usuarios')
            .select('*')
            .eq('id', username.toLowerCase());
        
        if (error) throw error;
        if (!data || data.length === 0) {
            return { success: false, error: "Usuario o contraseña incorrectos" };
        }
        
        const user = data[0];
        if (user.password !== password) {
            return { success: false, error: "Usuario o contraseña incorrectos" };
        }
        
        currentUser = {
            id: user.id,
            nombre: user.nombre,
            tipo: user.tipo
        };
        
        // Guardar en localStorage para persistencia de sesión
        localStorage.setItem('bareke_user', JSON.stringify(currentUser));
        
        return { success: true, user: currentUser };
    } catch (error) {
        console.error("Login error:", error);
        return { success: false, error: "Error de conexión" };
    }
}

// Asignar turno a empleado
export async function setTurno(shift, empleadoNombre) {
    currentShift = shift;
    const { error } = await supabase
        .from('turnos')
        .upsert({ id: shift, empleado: empleadoNombre, ultima_actualizacion: new Date().toISOString() });
    
    if (error) {
        console.error("Error guardando turno:", error);
    }
    return { success: !error };
}

// Logout
export function logout() {
    currentUser = null;
    currentShift = null;
    localStorage.removeItem('bareke_user');
    mostrarToast("Sesión cerrada");
}

// Verificar sesión guardada
export function checkStoredSession() {
    const stored = localStorage.getItem('bareke_user');
    if (stored) {
        try {
            currentUser = JSON.parse(stored);
            return true;
        } catch(e) {}
    }
    return false;
}

// Verificar si el usuario es admin
export function isAdmin() {
    return currentUser?.tipo === 'admin';
}

// Verificar si es empleado
export function isEmployee() {
    return currentUser?.tipo === 'empleado';
}
