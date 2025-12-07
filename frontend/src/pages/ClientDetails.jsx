import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ClientDetails = () => {
    const { id } = useParams();
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const { auth, fetchWithAuth } = useAuth();

    useEffect(() => {
        const fetchMessages = async () => {
            try {
                setLoading(true);
                const res = await fetchWithAuth(`/api/chats/${encodeURIComponent(id)}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                const normalized = (data || []).map((row) => {
                    let msg = row.message;
                    if (typeof msg === 'string') {
                        try {
                            msg = JSON.parse(msg);
                        } catch (e) {}
                    }
                    return {
                        id: row.id,
                        session_id: row.session_id,
                        message: msg,
                    };
                });
                setMessages(normalized);
            } catch (err) {
                console.error(err);
                setError(err.message || 'Error fetching');
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchMessages();
    }, [id]);

    return (
        <div className="max-w-3xl mx-auto p-4">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl font-semibold">Chat details</h1>
                <Link to="/clients" className="text-sm text-blue-600">Back</Link>
            </div>

            {!id && <p>No session id provided.</p>}

            {loading && <p>Loading...</p>}
            {error && <p className="text-red-600">Error: {error}</p>}

            <div className="space-y-4 mt-4">
                {messages.map((entry) => {
                    const messageObj = entry.message;
                    const type = messageObj && typeof messageObj === 'object' ? (messageObj.type || '') : '';
                    const content = messageObj && typeof messageObj === 'object' ? (messageObj.content || JSON.stringify(messageObj)) : (messageObj || '');

                    const isAI = type === 'ai' || type === 'assistant';
                    const isHuman = type === 'human' || type === 'user';

                    if (isAI) {
                        return (
                            <div key={entry.id} className="flex">
                                <div className="w-10/12">
                                    <div className="bg-gray-100 p-3 rounded-lg text-gray-800">
                                        <div className="text-sm">{content}</div>
                                    </div>
                                </div>
                                <div className="w-2/12 flex items-start justify-end pl-2 text-xs text-gray-500">AI</div>
                            </div>
                        );
                    }

                    return (
                        <div key={entry.id} className="flex justify-end">
                            <div className="w-2/12 flex items-start text-xs text-gray-500 pr-2">Human</div>
                            <div className="w-10/12">
                                <div className="bg-blue-100 p-3 rounded-lg text-gray-900 text-right">
                                    <div className="text-sm">{content}</div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ClientDetails;
