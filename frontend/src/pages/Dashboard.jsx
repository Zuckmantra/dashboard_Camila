import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
} from 'recharts';
import ClientModal from '../components/ClientModal';

const StatCard = ({ title, value, note }) => (
    <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="text-sm text-gray-500">{title}</div>
        <div className="mt-2 text-2xl font-bold text-gray-900">{value}</div>
        {note && <div className="mt-1 text-sm text-green-500">{note}</div>}
    </div>
);

const StatusPill = ({ children }) => (
    <span className="inline-block px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">{children}</span>
);

const Dashboard = () => {
    const [stats, setStats] = useState(null);
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [clientPage, setClientPage] = useState(0);
    const CLIENT_PAGE_SIZE = 15;
    const [selectedClient, setSelectedClient] = useState(null);
    const today = new Date();
    const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const [selectedMonth, setSelectedMonth] = useState(lastMonthDate.getMonth() + 1); 
    const [selectedYear, setSelectedYear] = useState(lastMonthDate.getFullYear());
    const [period, setPeriod] = useState('day');

    const { auth, fetchWithAuth } = useAuth();

    const BAR_COLORS = ['#6a8cff', '#7ee0a8', '#ffd86b', '#ff7f7f', '#9b8cff', '#ffb26b'];
    const LOCAL_CHART_CSS = `
        /* ensure SVG charts show their explicit fills */
        .dashboard-charts svg { filter: none !important; opacity: 1 !important; }
        .dashboard-charts .recharts-pie-sector { opacity: 1 !important; }
        .dashboard-charts .recharts-pie-sector path { fill-opacity: 1 !important; }
    `;

    useEffect(() => {
        const fetchData = async () => {
            try {
                const chartsUrl = `/api/dashboard/charts?period=day&days=30`;
                const skip = clientPage * CLIENT_PAGE_SIZE;
                const [statsResponse, clientsResponse] = await Promise.all([
                    fetchWithAuth(chartsUrl),
                    fetchWithAuth(`/api/clientes?limit=${CLIENT_PAGE_SIZE}&skip=${skip}`),
                ]);
                const statsData = statsResponse.ok ? await statsResponse.json() : null;
                const clientsData = clientsResponse.ok ? await clientsResponse.json() : [];
                let enrichedStats = statsData || {};

                try {
                    const hasSentiment = Array.isArray(enrichedStats.sentiment_breakdown) && enrichedStats.sentiment_breakdown.length > 0;
                    let sumVals = 0;
                    if (hasSentiment) {
                        sumVals = enrichedStats.sentiment_breakdown.reduce((s, it) => s + (Number(it.value) || 0), 0);
                    }

                    if (!hasSentiment || sumVals <= 0) {
                        const wresp = await fetchWithAuth('/api/whatsapp?limit=1000');
                        if (wresp.ok) {
                            const wdata = await wresp.json();
                            const msgs = Array.isArray(wdata) ? wdata.map(x => (x && (x.message || x.text || x.body)) ? (x.message || x.text || x.body) : JSON.stringify(x)).slice(0, 1000) : [];
                            const pos_k = ['gracias', 'excelente', 'bien', 'perfecto', 'genial', 'feliz', 'bueno', 'ok', 'okey'];
                            const neg_k = ['malo', 'problema', 'error', 'no funciona', 'mal', 'falla', 'reclamo', 'insatisfecho'];
                            const counts = { Positivo: 0, Negativo: 0, Neutral: 0 };
                            for (const m of msgs) {
                                let text = '';
                                if (typeof m === 'string') text = m.toLowerCase();
                                else try { text = JSON.stringify(m).toLowerCase(); } catch (e) { text = String(m).toLowerCase(); }
                                if (pos_k.some(k => text.includes(k))) counts.Positivo += 1;
                                else if (neg_k.some(k => text.includes(k))) counts.Negativo += 1;
                                else counts.Neutral += 1;
                            }
                            const totalMsgs = Math.max(1, counts.Positivo + counts.Negativo + counts.Neutral);
                            enrichedStats.sentiment_breakdown = [
                                { name: 'Positivo', value: Math.round(counts.Positivo * 1000.0 / totalMsgs) / 10 },
                                { name: 'Negativo', value: Math.round(counts.Negativo * 1000.0 / totalMsgs) / 10 },
                                { name: 'Neutral', value: Math.round(counts.Neutral * 1000.0 / totalMsgs) / 10 },
                            ];
                            enrichedStats.sentiment_counts = counts;
                        }
                    }
                } catch (e) {
                    console.warn('Sentiment client-side fallback failed', e);
                }

                setStats(enrichedStats);
                setClients(clientsData);
            } catch (e) {
                console.error('Error loading dashboard data', e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [auth, period, clientPage]);

    const totalClients = loading ? null : (stats && typeof stats.total_clients !== 'undefined' ? stats.total_clients : clients.length);
    const activeClients = loading
        ? null
        : (stats && typeof stats.active_clients !== 'undefined'
            ? stats.active_clients
            : clients.filter(c => ((c.estado || 'Activo').toString().toLowerCase() !== 'cerrado')).length);
    const newToday = loading
        ? null
        : (stats && typeof stats.new_today !== 'undefined'
            ? stats.new_today
            : clients.filter(c => {
                if (!c.fecha_registro) return false;
                try {
                    const d = new Date(c.fecha_registro);
                    const now = new Date();
                    return d.toDateString() === now.toDateString();
                } catch (e) {
                    return false;
                }
            }).length);

    return (
        <div className="p-6 dashboard-charts">
            <style>{LOCAL_CHART_CSS}</style>
            <header className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-pink-500 rounded-md flex items-center justify-center text-white font-bold">V</div>
                    <div>
                        <h2 className="text-lg font-semibold">Lista de Clientes</h2>
                        <div className="text-sm text-gray-500">Resumen y actividad reciente</div>
                    </div>
                </div>
            </header>

            <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <StatCard title="Total de Clientes" value={totalClients === null ? '...' : (totalClients || 0)} note={loading ? null : (stats && stats.total_clients_change ? stats.total_clients_change : null)} />
                <StatCard title="Clientes Activos" value={activeClients === null ? '...' : (activeClients || 0)} note={loading ? null : (totalClients ? `${Math.round((activeClients/Math.max(1,totalClients))*100)}% del total` : null)} />
                <StatCard title="Nuevos Hoy" value={newToday === null ? '...' : (newToday || 0)} note={loading ? null : 'Últimas 24 horas'} />
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                <div className="bg-white rounded-lg shadow-sm p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-medium">Conversaciones (Últimos 30 días)</h3>
                        <div className="text-sm text-gray-500">Últimos 30 días</div>
                    </div>

                    {(() => {
                        const barSeries = (() => {
                            if (stats && Array.isArray(stats.conversations_by_day) && stats.conversations_by_day.length > 0) {
                                return stats.conversations_by_day.map(r => ({ label: r.day, count: r.count }));
                            }
                            if (stats && Array.isArray(stats.conversations_by_month) && stats.conversations_by_month.length > 0) {
                                return stats.conversations_by_month.map(r => ({ label: r.month, count: r.count }));
                            }
                            if (stats && typeof stats.conversations_total === 'number' && stats.conversations_total > 0) {
                                const label = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
                                return [{ label: label, count: stats.conversations_total }];
                            }
                            if (clients && clients.length > 0) {
                                return clients.slice(0, 6).map((c, i) => ({ label: (c.nombre || `C${i+1}`).slice(0, 12), count: Math.max(1, Math.round(Number(c.tasa_conversion || 1))) }));
                            }
                            return [
                                { label: 'demo-1', count: 3 },
                                { label: 'demo-2', count: 7 },
                                { label: 'demo-3', count: 5 },
                            ];
                        })();

                            return (
                                <div style={{ width: '100%', height: 260, paddingBottom: 8 }}>
                                    <ResponsiveContainer width="100%" height={260}>
                                        <BarChart data={barSeries} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="label" />
                                            <YAxis />
                                            <Tooltip formatter={(value) => [value, 'Conversaciones']} />
                                            <Bar dataKey="count" name="Conversaciones">
                                                {barSeries.map((entry, idx) => (
                                                    <Cell key={`bar-${idx}`} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                    {}
                                    <div className="mt-3 flex items-center justify-between">
                                        <div className="text-sm text-gray-600">{(() => {
                                            if (stats && Array.isArray(stats.conversations_by_day) && stats.conversations_by_day.length > 0) {
                                                return `Período: Últimos 30 días`;
                                            }

                                            if (stats && Array.isArray(stats.conversations_by_month) && stats.conversations_by_month.length > 1) {
                                                const months = stats.conversations_by_month.map(r => r.month);
                                                return `Período: ${months[0]} → ${months[months.length - 1]} (últimos ${months.length} meses)`;
                                            }
                                            return `Mes: ${new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(new Date(selectedYear, selectedMonth - 1))}`;
                                        })()}</div>
                                        <div className="text-sm font-medium text-gray-900">{(() => {
                                            if (stats && typeof stats.conversations_total === 'number') return `Total: ${stats.conversations_total}`;
                                            const s = barSeries.reduce((acc, it) => acc + (Number(it.count) || 0), 0);
                                            return `Total: ${s}`;
                                        })()}</div>
                                    </div>
                                </div>
                            );
                    })()}
                </div>

                <div className="bg-white rounded-lg shadow-sm p-4">
                    <h3 className="text-base font-medium mb-4">Análisis de Seguimiento</h3>
                    {(() => {
                        const pieSeries = (stats && Array.isArray(stats.status_breakdown) && stats.status_breakdown.length > 0)
                            ? stats.status_breakdown
                            : (stats && Array.isArray(stats.sentiment_breakdown) && stats.sentiment_breakdown.length > 0)
                                ? stats.sentiment_breakdown
                                : (stats && typeof stats.conversations_total === 'number' && stats.conversations_total > 0)
                                    ? [{ name: 'Sin análisis', value: 100 }]
                                    : [ { name: 'Nuevo', value: 50 }, { name: 'En gestión', value: 30 }, { name: 'Cliente', value: 20 } ];

                        const COLOR_MAP = {
                            'Nuevo': '#3b82f6', 
                            'En gestión': '#f59e0b', 
                            'Cliente': '#10b981', 
                            'Otros': '#94a3b8', 
                            'Sin análisis': '#a4b0be',
                        };
                        const fallbackColors = ['#3b82f6', '#f59e0b', '#10b981', '#94a3b8'];

                        const normalised = pieSeries.map(p => ({ name: String(p.name), value: Number(p.value) || 0 })).filter(x => x.value > 0);
                        const pieSum = normalised.reduce((s, it) => s + (isNaN(it.value) ? 0 : it.value), 0);

                        const CustomLegend = () => (
                            <div className="flex justify-center space-x-4 mt-2">
                                {normalised.map((item, i) => (
                                    <div key={`${item.name}-${i}`} className="flex items-center space-x-2 text-sm text-gray-600">
                                        <span style={{ width: 12, height: 12, background: COLOR_MAP[item.name] || fallbackColors[i % fallbackColors.length], display: 'inline-block' }} />
                                        <span>{item.name}</span>
                                    </div>
                                ))}
                            </div>
                        );

                        if (pieSum <= 0) {
                            const emptySeries = [{ name: 'Sin datos', value: 1 }];
                            return (
                                <div style={{ width: '100%', height: 260, paddingBottom: 8 }} className="relative">
                                    <ResponsiveContainer width="100%" height={260}>
                                        <PieChart>
                                            <Pie
                                                data={emptySeries}
                                                dataKey="value"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={90}
                                                startAngle={90}
                                                endAngle={-270}
                                                paddingAngle={2}
                                                stroke="#ffffff"
                                                strokeWidth={1}
                                                labelLine={false}
                                                label={() => null}
                                                isAnimationActive={false}
                                            >
                                                <Cell fill="#e6e9ee" />
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div className="text-sm text-gray-500">No hay datos de estado</div>
                                    </div>
                                    <CustomLegend />
                                </div>
                            );
                        }

                        return (
                            <div style={{ width: '100%', height: 360, paddingBottom: 110 }} className="relative">
                                <ResponsiveContainer width="100%" height={340}>
                                    <PieChart>
                                        <Tooltip formatter={(value) => [`${value}%`, 'Porcentaje']} />
                                        <Pie
                                            data={normalised}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="46%"
                                            innerRadius={48}
                                            outerRadius={88}
                                            startAngle={90}
                                            endAngle={-270}
                                            paddingAngle={2}
                                            labelLine={false}
                                            label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}
                                            stroke="#ffffff"
                                            strokeWidth={1}
                                            fillOpacity={1}
                                        >
                                            {normalised.map((entry, idx) => (
                                                <Cell
                                                    key={`cell-${idx}`}
                                                    fill={COLOR_MAP[entry.name] || fallbackColors[idx % fallbackColors.length]}
                                                    stroke="#ffffff"
                                                    strokeWidth={1}
                                                    style={{ fill: COLOR_MAP[entry.name] || fallbackColors[idx % fallbackColors.length], fillOpacity: 1 }}
                                                />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                {}
                                <div style={{ position: 'absolute', left: '50%', bottom: 18, transform: 'translateX(-50%)' }} className="flex items-center justify-center space-x-6">
                                    {normalised.map((item, idx) => {
                                        const color = COLOR_MAP[item.name] || fallbackColors[idx % fallbackColors.length];
                                        return (
                                            <div key={`stat-${idx}`} className="flex items-center space-x-2">
                                                <span style={{ width: 12, height: 12, background: color, display: 'inline-block', borderRadius: 3 }} />
                                                <div className="text-sm text-center">
                                                    <div className="font-semibold text-gray-900">{item.name}</div>
                                                    <div className="text-xs text-gray-500">{Number(item.value).toFixed(1)}%</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}
                </div>

            </section>

            <section className="bg-white rounded-lg shadow-sm p-4">
                <h3 className="text-base font-medium mb-4">Clientes</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full table-auto">
                        <thead>
                            <tr className="text-left text-sm text-gray-500 border-b">
                                <th className="py-3">Usuario</th>
                                <th className="py-3">Total mensajes</th>
                                <th className="py-3">Última interacción</th>
                                <th className="py-3">Estado</th>
                                <th className="py-3">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading && (
                                <tr><td colSpan={5} className="py-8 text-center">Cargando...</td></tr>
                            )}
                            {!loading && clients.length === 0 && (
                                <tr><td colSpan={5} className="py-8 text-center">No hay clientes.</td></tr>
                            )}
                            {!loading && clients.map((client) => (
                                <tr key={client.id} className="align-top border-b hover:bg-gray-50">
                                    <td className="py-3 flex items-center space-x-3">
                                        <div className="w-8 h-8 bg-purple-200 rounded-full flex items-center justify-center text-purple-800">{(client.nombre||'')[0]||'U'}</div>
                                        <div>
                                            <div className="text-sm font-medium">{client.nombre}</div>
                                            <div className="text-sm text-gray-500">{client.email}</div>
                                        </div>
                                    </td>
                                    <td className="py-3 text-sm text-gray-700">{client.tasa_conversion ? Math.round(client.tasa_conversion) : '—'} mensajes</td>
                                    <td className="py-3 text-sm text-gray-700">{client.fecha_registro ? new Date(client.fecha_registro).toLocaleString() : 'Hace X horas'}</td>
                                    <td className="py-3"><StatusPill>{client.estado || 'Activo'}</StatusPill></td>
                                    <td className="py-3">
                                        <button onClick={() => setSelectedClient(client)} className="text-sm text-pink-600 hover:underline">Ver detalles</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {(() => {
    
                    const hasMore = (clients.length === CLIENT_PAGE_SIZE || clientPage > 0);
                    if (!hasMore) return null;

                    const renderRange = (from, to) => {
                        const nodes = [];
                        for (let i = from; i <= to; i++) {
                            nodes.push(
                                <button key={i} onClick={() => setClientPage(i)} className={`px-3 py-1 rounded ${i === clientPage ? 'bg-pink-500 text-white' : 'bg-white border text-gray-700'}`}>
                                    {i + 1}
                                </button>
                            );
                        }
                        return nodes;
                    };

                    return (
                        <div className="mt-4 flex items-center justify-between">
                            <div />
                            <div className="space-x-2 flex items-center">
                                <button
                                    onClick={() => setClientPage(p => Math.max(0, p - 1))}
                                    disabled={clientPage === 0}
                                    className={`px-3 py-1 rounded ${clientPage === 0 ? 'bg-gray-200 text-gray-500' : 'bg-white border'}`}>
                                    Anterior
                                </button>

                                {(() => {
                                    const start = Math.max(0, clientPage - 2);
                                    const end = start + 4;
                                    return renderRange(start, end);
                                })()}

                                <button
                                    onClick={() => setClientPage(p => p + 1)}
                                    disabled={clients.length < CLIENT_PAGE_SIZE}
                                    className={`px-3 py-1 rounded ${clients.length < CLIENT_PAGE_SIZE ? 'bg-gray-200 text-gray-500' : 'bg-white border'}`}>
                                    Siguiente
                                </button>
                            </div>
                        </div>
                    );
                })()}
            </section>
            {selectedClient && (
                <ClientModal client={selectedClient} onClose={() => setSelectedClient(null)} />
            )}
        </div>
    );
};

export default Dashboard;
