import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// Crear cliente de Supabase
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper para manejar errores
export const handleSupabaseError = (error) => {
    console.error("Supabase error:", error);
    return { success: false, error: error.message };
};

// Helper para consultas exitosas
export const handleSupabaseSuccess = (data) => {
    return { success: true, data };
};