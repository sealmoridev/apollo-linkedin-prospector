export interface AdminJwtPayload {
    id: string;
    email: string;
    role: 'SUPERADMIN' | 'ADMIN';
    empresa_id: string | null;
}

export interface EmpresaDetail {
    id: string;
    nombre: string;
    tenant_api_key: string;
    apollo_api_key: string | null;
    millionverifier_api_key: string | null;
    logo_url: string | null;
    key_active: boolean;
    createdAt: string;
    updatedAt: string;
    _count: { extensionUsers: number; consumos: number };
}

export interface ExtensionUser {
    id: string;
    email: string;
    nombre: string | null;
    avatar_url: string | null;
    empresa_id: string;
    createdAt: string;
    updatedAt: string;
    _count: { consumos: number };
}

export interface ConsumoResumen {
    empresa_id: string;
    empresa: { id: string; nombre: string; logo_url: string | null } | null;
    total_apollo: number;
    total_verifier: number;
    total_busquedas: number;
}

export interface LeadData {
    created_at: string | null;
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    title: string | null;
    primary_email: string | null;
    personal_email: string | null;
    phone_number: string | null;
    company_name: string | null;
    company_domain: string | null;
    industry: string | null;
    location: string | null;
    linkedin_url: string | null;
    email_status: string | null;
    sdr_id: string | null;
    sdr_name: string | null;
    sdr_mail: string | null;
}

export interface Consumo {
    id: string;
    usuario_id: string;
    empresa_id: string;
    creditos_apollo: number;
    creditos_verifier: number;
    sesion_id: string | null;
    // Credits from the full sesion (backend-enriched, only present in historial response)
    sesion_apollo: number | null;
    sesion_verifier: number | null;
    fecha: string;
    lead_data: LeadData | null;
    sheet_id: string | null;
    sheet_name: string | null;
    usuario: { email: string; id: string };
    empresa: { nombre: string };
}

// Constante para la URL del API
export const API_URL = '/api';

/** Obtiene el token guardado en el localStorage */
export const getToken = () => localStorage.getItem('admin_token');

/** Guarda el token */
export const setToken = (token: string) => localStorage.setItem('admin_token', token);

/** Elimina el token (Logout) */
export const removeToken = () => localStorage.removeItem('admin_token');

const getAuthHeaders = () => {
    const token = getToken();
    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
};

// ==========================================
// AUTENTICACIÓN
// ==========================================

export const login = async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Login fallido');
    }
    return res.json();
};

export const getMe = async () => {
    const res = await fetch(`${API_URL}/admin/me`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Not authenticated');
    return res.json();
};

// ==========================================
// EMPRESAS (SuperAdmin)
// ==========================================

export const getEmpresas = async (): Promise<EmpresaDetail[]> => {
    const res = await fetch(`${API_URL}/admin/empresas`, { headers: getAuthHeaders() });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to fetch empresas');
    }
    return res.json();
};

export const createEmpresa = async (data: {
    nombre: string;
    apollo_api_key?: string;
    millionverifier_api_key?: string;
    logo_url?: string;
}) => {
    const res = await fetch(`${API_URL}/admin/empresas`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al crear empresa');
    }
    return res.json();
};

export const getEmpresa = async (id: string): Promise<EmpresaDetail> => {
    const res = await fetch(`${API_URL}/admin/empresas/${id}`, { headers: getAuthHeaders() });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al obtener empresa');
    }
    return res.json();
};

export const updateEmpresa = async (
    id: string,
    data: { nombre?: string; apollo_api_key?: string; millionverifier_api_key?: string; logo_url?: string }
): Promise<EmpresaDetail> => {
    const res = await fetch(`${API_URL}/admin/empresas/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al actualizar empresa');
    }
    return res.json();
};

export const getEmpresaUsuarios = async (id: string): Promise<ExtensionUser[]> => {
    const res = await fetch(`${API_URL}/admin/empresas/${id}/usuarios`, { headers: getAuthHeaders() });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al listar usuarios');
    }
    return res.json();
};

export const getMiEmpresa = async (): Promise<EmpresaDetail> => {
    const res = await fetch(`${API_URL}/admin/mi-empresa`, { headers: getAuthHeaders() });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al obtener tu empresa');
    }
    return res.json();
};

export const regenerateTenantKey = async (id: string): Promise<{ tenant_api_key: string }> => {
    const res = await fetch(`${API_URL}/admin/empresas/${id}/regenerate-key`, {
        method: 'POST',
        headers: getAuthHeaders()
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al regenerar la key');
    }
    return res.json();
};

export const toggleTenantKey = async (id: string): Promise<{ key_active: boolean }> => {
    const res = await fetch(`${API_URL}/admin/empresas/${id}/toggle-key`, {
        method: 'PATCH',
        headers: getAuthHeaders()
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al cambiar estado de la key');
    }
    return res.json();
};

// ==========================================
// CONSUMOS (Admin/SuperAdmin)
// ==========================================

export const getConsumos = async (empresa_id?: string, desde?: string, hasta?: string): Promise<Consumo[]> => {
    const params = new URLSearchParams();
    if (empresa_id) params.set('empresa_id', empresa_id);
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    const qs = params.toString();
    const url = `${API_URL}/admin/consumos${qs ? '?' + qs : ''}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to fetch consumos');
    }
    return res.json();
};

export interface ConsumoHistorialResult {
    data: Consumo[];
    total: number;
    page: number;
    totalPages: number;
    limit: number;
}

export const getConsumoHistorial = async (params: {
    empresa_id?: string;
    desde?: string;
    hasta?: string;
    usuario_id?: string;
    page?: number;
    limit?: number;
    sheet_name?: string;
    only_leads?: boolean;
    search?: string;
}): Promise<ConsumoHistorialResult> => {
    const qs = new URLSearchParams();
    if (params.empresa_id) qs.set('empresa_id', params.empresa_id);
    if (params.desde) qs.set('desde', params.desde);
    if (params.hasta) qs.set('hasta', params.hasta);
    if (params.usuario_id) qs.set('usuario_id', params.usuario_id);
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.sheet_name) qs.set('sheet_name', params.sheet_name);
    if (params.only_leads) qs.set('only_leads', 'true');
    if (params.search) qs.set('search', params.search);
    const url = `${API_URL}/admin/consumos/historial?${qs.toString()}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al obtener historial');
    }
    return res.json();
};

export const getConsumoSheetNames = async (empresa_id?: string): Promise<string[]> => {
    const qs = new URLSearchParams();
    if (empresa_id) qs.set('empresa_id', empresa_id);
    const url = `${API_URL}/admin/consumos/sheet-names${qs.toString() ? '?' + qs.toString() : ''}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al obtener sheet names');
    }
    return res.json();
};

export const getConsumoResumen = async (): Promise<ConsumoResumen[]> => {
    const res = await fetch(`${API_URL}/admin/consumos/resumen`, { headers: getAuthHeaders() });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al obtener resumen de consumos');
    }
    return res.json();
};

// ==========================================
// ADMIN USERS (SuperAdmin)
// ==========================================

export interface AdminUser {
    id: string;
    email: string;
    role: 'ADMIN' | 'SUPERADMIN';
    empresa_id: string | null;
    empresa?: { id: string; nombre: string } | null;
    createdAt: string;
}

export const getAdminUsers = async (): Promise<AdminUser[]> => {
    const res = await fetch(`${API_URL}/admin/users`, { headers: getAuthHeaders() });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al listar usuarios');
    }
    return res.json();
};

export const createAdminUser = async (data: {
    email: string;
    password: string;
    role: 'ADMIN' | 'SUPERADMIN';
    empresa_id?: string;
}) => {
    const res = await fetch(`${API_URL}/admin/users`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al crear usuario');
    }
    return res.json();
};

export const updateAdminUser = async (
    id: string,
    data: { email?: string; role?: 'ADMIN' | 'SUPERADMIN'; empresa_id?: string | null }
): Promise<AdminUser> => {
    const res = await fetch(`${API_URL}/admin/users/${id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al actualizar usuario');
    }
    return res.json();
};

export const deleteAdminUser = async (id: string): Promise<void> => {
    const res = await fetch(`${API_URL}/admin/users/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al eliminar usuario');
    }
};

export const changeAdminUserPassword = async (id: string, newPassword: string): Promise<void> => {
    const res = await fetch(`${API_URL}/admin/users/${id}/change-password`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ newPassword })
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al cambiar contraseña');
    }
};
