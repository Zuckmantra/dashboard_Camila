import React from 'react';

const ClientModal = ({ client, onClose }) => {

    if (!client) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black opacity-40" onClick={onClose} />
            <div className="relative w-[90%] md:w-3/4 lg:w-2/3 bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b">
                    <div>
                        <div className="text-lg font-semibold">{client.nombre || client.name || client.celular || 'Cliente'}</div>
                        <div className="text-sm text-gray-500">{client.email || client.celular || ''}</div>
                    </div>
                    <div>
                        <button onClick={onClose} className="px-3 py-1 bg-gray-100 rounded">Cerrar</button>
                    </div>
                </div>

                <div className="px-4 pt-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <div className="text-sm text-gray-500">Nombre</div>
                            <div className="font-medium">{client.nombre || client.name || '—'}</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-500">Contacto</div>
                            <div className="font-medium">{client.celular || client.phone || client.email || '—'}</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-500">Estado</div>
                            <div className="font-medium">{client.estado || client.status || '—'}</div>
                        </div>
                        <div>
                            <div className="text-sm text-gray-500">Registrado</div>
                            <div className="font-medium">{client.fecha_registro ? new Date(client.fecha_registro).toLocaleString() : (client.creacion_cliente ? new Date(client.creacion_cliente).toLocaleString() : '—')}</div>
                        </div>
                        <div className="md:col-span-2">
                            <div className="text-sm text-gray-500">Notas</div>
                            <div className="font-medium whitespace-pre-wrap">{client.notas || client.notes || '—'}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClientModal;
