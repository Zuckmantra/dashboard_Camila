import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import ChatBubble from '../components/ChatBubble';

const formatTimeShort = (t) => {
    if (!t) return '';
    const d = new Date(t);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const ChatHistory = () => {
    const { fetchWithAuth } = useAuth();
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const scrollRef = useRef(null);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const sessionsRes = await fetchWithAuth('/api/n8n_chats?limit=1000');
                if (!sessionsRes.ok) throw new Error(`HTTP ${sessionsRes.status}`);
                const sessionsData = await sessionsRes.json();
                const rows = [];
                for (const s of sessionsData) {
                    try {
                        const r = await fetchWithAuth(`/api/chats/${encodeURIComponent(s.session_id)}?limit=1000`);
                        if (!r.ok) continue;
                        const msgs = await r.json();
                        for (const m of msgs) {
                            rows.push({ ...m, session_id: s.session_id, _session_count: s.count, _last_id: s.last_id });
                        }
                    } catch (e) {

                    }
                }

                const groups = {};
                const phoneRe = /\+?\d[\d\s\-]{6,}\d/;
                for (const r of rows) {
                    const session = r.session_id || r.session || r.id_chat || r.phone || r.celular || r.from || r.to || (r.row ? String(r.row) : null) || 'unknown';
                    if (!groups[session]) groups[session] = { sessionId: session, messages: [], lastTime: null, title: r.nombre || r.name || r.celular || session, phones: {}, count: r._session_count || 0 };
                    const msgRaw = r.message || r.text || r.body || r.content || r.msg || '';
                    let parsed = msgRaw;
                    if (typeof parsed === 'string') {
                        try { parsed = JSON.parse(parsed); } catch (e) { }
                    }
                    const time = r.timestamp || r.fecha || r.created_at || (parsed && parsed.time) || null;
                    const msgType = (parsed && typeof parsed === 'object' && parsed.type) ? parsed.type : (r.type || null);
                    const text = (parsed && typeof parsed === 'object') ? (parsed.content || parsed.text || JSON.stringify(parsed)) : (parsed || '');
                    const obj = {
                        id: r.id || Math.random().toString(36).slice(2),
                        from_raw: r.from || (parsed && parsed.from) || null,
                        to_raw: r.to || r.to_number || null,
                        from: (r.from || (parsed && parsed.from) || '').toString(),
                        text,
                        time,
                        type: msgType,
                        raw: r
                    };
                    groups[session].messages.push(obj);
                    groups[session].count = r._session_count || groups[session].count || 0;

                    const candidates = [r.from, r.to, r.celular, r.phone, r.to_number, r.from_number];
                    for (const c of candidates) {
                        if (!c) continue;
                        try {
                            const s = String(c);
                            if (phoneRe.test(s)) {
                                groups[session].phones[s] = (groups[session].phones[s] || 0) + 1;
                            }
                        } catch (e) {}
                    }

                    const tnum = time ? new Date(time).getTime() : 0;
                    if (!groups[session].lastTime || tnum > groups[session].lastTime) groups[session].lastTime = tnum;
                    groups[session].title = groups[session].title || (r.nombre || r.name || r.celular || session);
                }

                const normalizeDigits = (s) => {
                    if (!s && s !== 0) return '';
                    try { return String(s).replace(/[^0-9]/g, ''); } catch (e) { return '' }
                };
                const lastN = (numStr, n = 8) => {
                    if (!numStr) return '';
                    return numStr.slice(-n);
                };

                const convs = Object.values(groups).map(g => {
                    const phones = Object.entries(g.phones || {});
                    phones.sort((a,b) => b[1] - a[1]);
                    const repPhone = phones.length > 0 ? phones[0][0] : null;
                    const repNorm = normalizeDigits(repPhone || g.sessionId || '');
                    const repTail = lastN(repNorm, 8);

                    const msgs = g.messages.map(m => {
                        let isFromClient = false;
                        const raw = m.raw || {};

                        try {
                            const t = (m.type || '').toString().toLowerCase();
                            if (t) {
                                if (t === 'human' || t === 'user' || t === 'client') {
                                    isFromClient = true;
                                    return { ...m, isFromClient };
                                }
                                if (t === 'ai' || t === 'bot' || t === 'assistant' || t === 'system') {
                                    isFromClient = false;
                                    return { ...m, isFromClient };
                                }
                            }
                        } catch (e) {}

                        const dir = (raw.direction || raw.type || raw.role || raw.sender_type || raw.message_type || '').toString().toLowerCase();
                        if (dir) {
                            if (['in', 'inbound', 'received', 'incoming'].some(d => dir.includes(d))) isFromClient = true;
                            else if (['out', 'outbound', 'sent', 'response'].some(d => dir.includes(d))) isFromClient = false;
                        }

                        if (!isFromClient && repTail) {
                            try {
                                const f = normalizeDigits(m.from_raw || m.from || '');
                                const t = normalizeDigits(m.to_raw || m.to || '');
                                const fTail = lastN(f, 8);
                                const tTail = lastN(t, 8);
                                if (fTail && repTail && fTail === repTail) isFromClient = true;
                                else if (tTail && repTail && tTail === repTail) isFromClient = false;
                            } catch (e) { }
                        }

                        if (!isFromClient && dir) {
                            if (['in', 'inbound', 'received', 'incoming'].some(d => dir.includes(d))) isFromClient = true;
                            else if (['out', 'outbound', 'sent', 'response'].some(d => dir.includes(d))) isFromClient = false;
                        }

                        if (!isFromClient) {
                            const fromLower = (m.from || '').toString().toLowerCase();
                            if (['user', 'human', 'cliente', 'client', 'customer'].some(t => fromLower.includes(t))) isFromClient = true;
                            else if (['bot', 'ai', 'assistant', 'system', 'camila'].some(t => fromLower.includes(t))) isFromClient = false;
                        }

                        if (!isFromClient) {
                            try {
                                const textSample = (m.text || '').toString().toLowerCase();
                                if (textSample.includes('soy camila') || textSample.includes('política de tratamiento') || textSample.includes('verum')) {
                                    isFromClient = false;
                                }
                            } catch (e) {}
                        }

                        if (!isFromClient) {
                            try { if (/\d/.test((m.from || '').toString())) isFromClient = true; } catch (e) {}
                        }

                        return { ...m, isFromClient };
                    });

                    return { ...g, repPhone, count: g.count || msgs.length, messages: msgs.sort((a,b)=> (new Date(a.time||0)) - (new Date(b.time||0)) ) };
                });
                convs.sort((a,b) => (b.lastTime || 0) - (a.lastTime || 0));

                for (const cv of convs) {
                    if (!cv.repPhone || cv.repPhone === 'unknown') cv.repPhone = cv.sessionId || cv.repPhone;
                }

                try {
                    const clientsRes = await fetchWithAuth('/api/clientes?limit=2000');
                    if (clientsRes.ok) {
                        const clientsData = await clientsRes.json();
                        const phoneMap = {};
                        const normalize = (s) => (s || '').toString().replace(/[^0-9]/g, '');
                        for (const c of (clientsData || [])) {
                            const raw = c.telefono || c.celular || c.phone || c.numero || c.numero_telefono || '';
                            const p = normalize(raw);
                            if (p) phoneMap[p] = c;
                        }
                        for (const cv of convs) {
                            const rep = (cv.repPhone || '') + '';
                            const repNorm = normalize(rep);
                            const matched = phoneMap[repNorm];
                            cv.displayName = matched ? (matched.nombre || matched.name || matched.razon_social || rep) : (cv.title || rep);
                            cv.displayPhone = rep || cv.sessionId || '';
                        }
                    } else {
                        for (const cv of convs) {
                            cv.displayName = cv.title || (cv.repPhone || cv.sessionId || '');
                            cv.displayPhone = cv.repPhone || cv.sessionId || '';
                        }
                    }
                } catch (e) {
                    for (const cv of convs) {
                        cv.displayName = cv.title || (cv.repPhone || cv.sessionId || '');
                        cv.displayPhone = cv.repPhone || cv.sessionId || '';
                    }
                }

                setConversations(convs);
                if (convs.length > 0) setSelected(convs[0]);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [fetchWithAuth]);

    useEffect(() => {
        setTimeout(() => {
            if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }, 80);
    }, [selected]);

    return (
        <div className="h-[80vh] bg-white rounded shadow flex overflow-hidden">
            <aside className="w-80 border-r overflow-auto bg-gray-50">
                <div className="p-4 border-b">
                    <div className="text-lg font-semibold">Chats</div>
                    <div className="text-sm text-gray-500">Conversaciones recientes</div>
                </div>
                
                <div>
                    {loading && <div className="p-4 text-center text-sm text-gray-500">Cargando conversaciones...</div>}
                    {!loading && conversations.length === 0 && <div className="p-4 text-sm text-gray-500">No hay conversaciones.</div>}
                    {!loading && conversations.map(conv => (
                        <div key={conv.sessionId} onClick={() => setSelected(conv)} className={`p-3 flex items-start space-x-3 hover:bg-white hover:shadow cursor-pointer ${selected && selected.sessionId === conv.sessionId ? 'bg-white shadow-sm' : ''}`}>
                            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-700">
                                    {}
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#065f46" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center">
                                    <div className="text-sm font-medium truncate">{conv.displayName || conv.title || conv.repPhone}</div>
                                    <div className="text-xs text-gray-400 ml-2">{conv.displayPhone || (typeof conv.count !== 'undefined' ? conv.count : (conv.messages.length))}</div>
                                </div>
                                <div className="text-sm text-gray-500 truncate mt-1">{conv.messages.length ? conv.messages[conv.messages.length-1].text.slice(0, 60) : ''}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </aside>

            <main className="flex-1 flex flex-col">
                {!selected && (
                    <div className="p-8 text-center text-gray-500">Seleccione una conversación a la izquierda</div>
                )}

                {selected && (
                    <>
                                <div className="flex items-center justify-between p-4 border-b">
                                    <div className="flex items-center space-x-4">
                                        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#065f46" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                        </div>
                                        <div>
                                            <div className="text-lg font-semibold">{selected.displayName || selected.title || selected.sessionId}</div>
                                            <div className="text-sm text-gray-500">{selected.displayPhone || selected.sessionId}</div>
                                        </div>
                                    </div>
                                </div>

                        <div ref={scrollRef} className="flex-1 overflow-auto p-6" style={{ background: '#f2f6f8' }}>
                            <div className="w-full">
                                {selected.messages.map(m => (
                                    <ChatBubble key={m.id} message={m} isOutbound={!m.isFromClient} />
                                ))}
                            </div>
                        </div>

                        <div className="p-4 border-t">
                            <div className="max-w-3xl mx-auto flex items-center space-x-3">
                                <input className="flex-1 px-3 py-2 rounded border" placeholder="Escribe un mensaje" disabled />
                                <button className="px-4 py-2 bg-pink-500 text-white rounded" disabled>Enviar</button>
                            </div>
                        </div>
                    </>
                )}
            </main>
        </div>
    );
};

export default ChatHistory;
