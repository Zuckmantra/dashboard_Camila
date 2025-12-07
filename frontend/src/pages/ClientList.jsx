import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import ClientModal from '../components/ClientModal';
import { useAuth } from '../context/AuthContext';

const ClientList = () => {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 20; 
    const [totalClients, setTotalClients] = useState(null);
    const [period, setPeriod] = useState('30'); 
    const [estadoFilter, setEstadoFilter] = useState('Todos');
    const [tasaFilter, setTasaFilter] = useState('todos');
    const [q, setQ] = useState('');
    const [debouncedQ, setDebouncedQ] = useState('');

    const { auth, fetchWithAuth } = useAuth();
    const [selectedClient, setSelectedClient] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const skip = page * PAGE_SIZE;
                const params = new URLSearchParams();
                params.set('limit', PAGE_SIZE);
                params.set('skip', skip);
                if (period) params.set('period_days', period);
                if (estadoFilter && estadoFilter !== 'Todos') params.set('estado', estadoFilter);
                if (tasaFilter && tasaFilter !== 'todos') params.set('tasa_band', tasaFilter);
                if (debouncedQ) params.set('q', debouncedQ);

                const res = await fetchWithAuth(`/api/clientes?${params.toString()}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                setClients(data || []);
                try {
                    const statsRes = await fetchWithAuth('/api/dashboard/stats');
                    if (statsRes.ok) {
                        const s = await statsRes.json();
                        if (s && typeof s.total_clients !== 'undefined') setTotalClients(s.total_clients);
                    }
                } catch (e) {
                }
            } catch (err) {
                console.error(err);
                setError(err.message || 'Error fetching');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [auth, page, period, estadoFilter, tasaFilter, debouncedQ]);

    useEffect(() => {
        const id = setTimeout(() => {
            setDebouncedQ(q);
            setPage(0);
        }, 400);
        return () => clearTimeout(id);
    }, [q]);

    const filteredClients = useMemo(() => {
        if (!Array.isArray(clients)) return [];
        const ql = (debouncedQ || '').trim().toLowerCase();
        return clients.filter(c => {

            if (estadoFilter && estadoFilter !== 'Todos') {
                const st = (c.estado || c.state || '').toString().toLowerCase();
                if (st !== estadoFilter.toLowerCase()) return false;
            }
            if (tasaFilter && tasaFilter !== 'todos') {
                const v = (c.tasa_conversion ?? c.tasa ?? c.conversion);
                const num = Number(v);
                const pct = isNaN(num) ? null : Math.round(num * 100);
                if (tasaFilter === 'alta' && (pct === null || pct < 75)) return false;
                if (tasaFilter === 'media' && (pct === null || pct < 40 || pct >= 75)) return false;
                if (tasaFilter === 'baja' && (pct === null || pct >= 40)) return false;
            }
            if (ql) {
                const name = (c.nombre || c.name || '').toString().toLowerCase();
                const email = (c.email || '').toString().toLowerCase();
                const phone = (c.celular || c.phone || '').toString().toLowerCase();
                if (!name.includes(ql) && !email.includes(ql) && !phone.includes(ql)) return false;
            }
            return true;
        });
    }, [clients, estadoFilter, tasaFilter, debouncedQ]);

    const displayedClients = useMemo(() => {
        const start = page * PAGE_SIZE;
        return (filteredClients || []).slice(start, start + PAGE_SIZE);
    }, [filteredClients, page]);

    useEffect(() => {
        const total = Math.max(1, Math.ceil((filteredClients.length || 0) / PAGE_SIZE));
        if (page >= total) setPage(0);
    }, [filteredClients.length]);

    return (
        <div>
            <div className="mb-4">
                <div className="flex flex-col md:flex-row md:items-end md:space-x-4">
                    <div className="flex items-center space-x-2">
                        <label className="text-sm text-gray-600">Periodo</label>
                        <select value={period} onChange={e => { setPeriod(e.target.value); setPage(0); }} className="px-3 py-2 border rounded-md">
                            <option value="7">Últimos 7 días</option>
                            <option value="30">Últimos 30 días</option>
                            <option value="90">Últimos 90 días</option>
                        </select>
                    </div>

                    <div className="flex items-center space-x-2 mt-2 md:mt-0">
                        <label className="text-sm text-gray-600">Estado</label>
                        <select value={estadoFilter} onChange={e => { setEstadoFilter(e.target.value); setPage(0); }} className="px-3 py-2 border rounded-md">
                            <option>Todos</option>
                            <option>Nuevo</option>
                            <option>En gestión</option>
                            <option>Cliente</option>
                        </select>
                    </div>

                    <div className="flex items-center space-x-2 mt-2 md:mt-0">
                        <label className="text-sm text-gray-600">Tasa de conversión</label>
                        <select value={tasaFilter} onChange={e => { setTasaFilter(e.target.value); setPage(0); }} className="px-3 py-2 border rounded-md">
                            <option value="todos">Todos</option>
                            <option value="alta">Alta (75%+)</option>
                            <option value="media">Media (40-74%)</option>
                            <option value="baja">Baja (&lt;40%)</option>
                        </select>
                    </div>

                    <div className="mt-3 md:mt-0 md:ml-auto">
                        <input value={q} onChange={e => { setQ(e.target.value); setPage(0); }} placeholder="Buscar Cliente" className="px-4 py-2 border rounded-lg w-64" />
                    </div>
                </div>
            </div>

            <h1 className="text-2xl font-semibold text-gray-900">Clientes</h1>

            {loading && <p className="mt-4">Cargando...</p>}
            {error && <p className="mt-4 text-red-600">Error: {error}</p>}

            {!loading && !error && (
                <div className="mt-4">
                    <ul className="divide-y divide-gray-200">
                        {(() => {
                            if (!filteredClients || filteredClients.length === 0) return <li className="py-4">No se encontraron clientes.</li>;
                            return null;
                        })()}

                        {displayedClients.map((client) => (
                            <li key={client.id || client.id_chat || `${client.table}_${client.row}` } className="py-4 flex">
                                <div className="ml-3">
                                    <p className="text-sm font-medium text-gray-900">{client.nombre || client.name || 'Sin nombre'}</p>
                                    <p className="text-sm text-gray-500">{client.celular || client.phone || client.email || '—'}</p>
                                    <p className="text-sm text-gray-400">Estado: {client.estado || client.state || '—'}</p>
                                    <p className="text-sm text-gray-400">Tasa: {(() => {
                                        const v = (client.tasa_conversion ?? client.tasa ?? client.conversion);
                                        if (v === null || typeof v === 'undefined' || isNaN(Number(v))) return '—';
                                        const pct = Math.round(Number(v) * 100);
                                        const label = pct >= 75 ? 'Alta' : (pct >= 40 ? 'Media' : 'Baja');
                                        const color = pct >= 75 ? 'bg-green-100 text-green-800' : (pct >= 40 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800');
                                        return (<span className={`inline-flex items-center px-2 py-0.5 text-xs rounded ${color}`}>{pct}% {label}</span>);
                                    })()}</p>
                                </div>
                                <div className="ml-auto text-right">
                                    <p className="text-sm text-gray-500">{client.fecha_registro ? new Date(client.fecha_registro).toLocaleString() : (client.creacion_cliente ? new Date(client.creacion_cliente).toLocaleString() : '—')}</p>
                                    <button onClick={() => setSelectedClient(client)} className="text-primary hover:text-pink-700">Ver detalles</button>
                                </div>
                            </li>
                        ))}
                    </ul>

                    {}
                    {(() => { 
                        const count = totalClients || filteredClients.length;
                        const totalPages = totalClients ? Math.max(1, Math.ceil(totalClients / PAGE_SIZE)) : Math.max(1, Math.ceil(count / PAGE_SIZE));
                        const shouldShow = totalPages > 1;
                        if (!shouldShow) return null;

                        const renderRange = (from, to) => {
                            const nodes = [];
                            for (let i = from; i <= to; i++) {
                                nodes.push(
                                    <button key={i} onClick={() => setPage(i)} className={`px-3 py-1 rounded ${i === page ? 'bg-pink-500 text-white' : 'bg-white border text-gray-700'}`}>
                                        {i + 1}
                                    </button>
                                );
                            }
                            return nodes;
                        };

                        return (
                            <div className="mt-4 flex items-center justify-between">
                                <div className="text-sm text-gray-600">{totalClients ? `Total: ${totalClients}` : `Total: ${count}`}</div>
                                <div className="flex items-center space-x-2">
                                    <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1 bg-gray-100 rounded disabled:opacity-50">Prev</button>

                                    {(() => {
                                        if (totalPages <= 7) return renderRange(0, totalPages - 1);
                                        const nodes = [];
                                        nodes.push(...renderRange(0, 0));
                                        if (page > 3) nodes.push(<div key="l-ell" className="px-1">...</div>);
                                        const start = Math.max(1, page - 1);
                                        const end = Math.min(totalPages - 2, page + 1);
                                        nodes.push(...renderRange(start, end));
                                        if (page < totalPages - 4) nodes.push(<div key="r-ell" className="px-1">...</div>);
                                        nodes.push(...renderRange(totalPages - 1, totalPages - 1));
                                        return nodes;
                                    })()}

                                    <button onClick={() => setPage(p => p + 1)} disabled={page + 1 >= totalPages} className="px-3 py-1 bg-gray-100 rounded disabled:opacity-50">Next</button>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            {selectedClient && (
                <ClientModal client={selectedClient} onClose={() => setSelectedClient(null)} />
            )}
        </div>
    );
};

export default ClientList;
