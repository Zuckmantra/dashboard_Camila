import React, { createContext, useState, useContext, useEffect } from 'react';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [auth, setAuth] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const raw = localStorage.getItem('auth');
        if (raw) {
            try {
                setAuth(JSON.parse(raw));
            } catch (e) {
                setAuth(null);
            }
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        const tryRefresh = async () => {
            try {
                const raw = localStorage.getItem('auth');
                let body = null;
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw);
                        if (parsed && parsed.refresh_token) body = JSON.stringify({ refresh_token: parsed.refresh_token });
                    } catch (e) {}
                }

                const opts = { method: 'POST', credentials: 'include' };
                if (body) {
                    opts.body = body;
                    opts.headers = { 'Content-Type': 'application/json' };
                }
                try {
                    const parsed = JSON.parse(localStorage.getItem('auth') || 'null');
                    if (parsed && parsed.refresh_token) {
                        opts.headers = { ...(opts.headers || {}), Authorization: `Bearer ${parsed.refresh_token}` };
                    }
                } catch (e) {}

                const res = await fetch('/api/auth/refresh', opts);
                if (!res.ok) return;
                const data = await res.json()
                setAuth(data);
            } catch (e) {
            }
        };
        tryRefresh();
    }, []);

    useEffect(() => {
        try {
            if (auth) localStorage.setItem('auth', JSON.stringify(auth));
            else localStorage.removeItem('auth');
            console.log('Auth state changed', auth);
        } catch (e) {
        }
    }, [auth]);

    const login = (authData) => {
        setAuth(authData);
    };

    const logout = () => {
        setAuth(null);
    };

    const getAuthHeaders = () => {
        if (auth && auth.access_token) return { Authorization: `Bearer ${auth.access_token}` };
        return {};
    };

    const refreshAuth = async () => {
        try {
            console.log('refreshAuth: sending refresh request to server');

            const opts = { method: 'POST', credentials: 'include' };
            if (auth && auth.refresh_token) {
                opts.body = JSON.stringify({ refresh_token: auth.refresh_token });
                opts.headers = { 'Content-Type': 'application/json' };
            }
            try {
                const parsed = JSON.parse(localStorage.getItem('auth') || 'null');
                const rt = (auth && auth.refresh_token) || (parsed && parsed.refresh_token);
                if (rt) {
                    opts.headers = { ...(opts.headers || {}), Authorization: `Bearer ${rt}` };
                }
            } catch (e) {}

            const res = await fetch('/api/auth/refresh', opts);
            if (!res.ok) {
                setAuth(null);
                return null;
            }
            const data = await res.json();
            setAuth(data);
            return data;
        } catch (e) {
            setAuth(null);
            return null;
        }
    };

    const fetchWithAuth = async (input, init = {}) => {
        init.headers = init.headers || {};
        const headers = getAuthHeaders();
        init.headers = { ...init.headers, ...headers };
        init.credentials = init.credentials || 'include';

        console.log('fetchWithAuth: request', input, { headers: init.headers, credentials: init.credentials });
        let res = await fetch(input, init);
        if (res.status === 401) {
            const refreshed = await refreshAuth();
            if (refreshed && refreshed.access_token) {
                init.headers = { ...init.headers, Authorization: `Bearer ${refreshed.access_token}` };
                res = await fetch(input, init);
            }
        }
        return res;
    };

    return (
        <AuthContext.Provider value={{ auth, login, logout, loading, getAuthHeaders, refreshAuth, fetchWithAuth }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    return useContext(AuthContext);
};
