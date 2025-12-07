import React from 'react';
import { Outlet, Link } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import logoImg from '../img/logo_verum_header.webp';

const Layout = () => {
    const { logout, auth } = useAuth();
    const user = auth && auth.user;
    const hideForComercial = user && String(user.area || '').toUpperCase() === 'COMERCIAL';

    return (
        <div className="min-h-screen bg-gray-100">
            <nav style={{ backgroundColor: '#AEADAD' }} className="shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex">
                                <div className="shrink-0 flex items-center">
                                    <img src={logoImg} alt="Verum App" className="h-8" />
                                </div>
                                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                                    <Link to="/dashboard" className="border-transparent text-gray-800 hover:border-gray-300 hover:text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                                    Dashboard
                                </Link>
                                    <Link to="/clients" className="border-transparent text-gray-800 hover:border-gray-300 hover:text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                                    Clientes
                                </Link>
                                    {!hideForComercial && (
                                        <Link to="/chat-history" className="border-transparent text-gray-800 hover:border-gray-300 hover:text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                                            Historial de Chat
                                        </Link>
                                    )}
                            </div>
                        </div>
                        <div className="flex items-center">
                                <button onClick={logout} className="text-gray-800 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                                Cerrar Sesión
                            </button>
                        </div>
                    </div>
                </div>
            </nav>
            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
