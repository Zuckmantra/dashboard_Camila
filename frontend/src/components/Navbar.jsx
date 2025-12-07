import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import logoImg from '../img/logo_verum_header.webp';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
    const location = useLocation();
    const isActive = (path) => location.pathname.startsWith(path);

    const { auth } = useAuth();
    const user = auth && auth.user ? auth.user : null;

    return (
        <nav className="text-gray-800 p-4 flex justify-between items-center shadow-md">
            <div className="flex items-center space-x-8">
                <div className="flex items-center space-x-2">
                    <div className="flex items-center">
                        <img src={logoImg} alt="Verum App" className="h-8" />
                    </div>
                </div>

                    <div className="flex space-x-6">
                        {(!user || (user && (user.area || '').toString().toUpperCase() !== 'COMERCIAL')) && (
                            <Link
                                to="/dashboard"
                                className={`hover:text-cyan-600 transition-colors ${isActive('/dashboard') ? 'text-cyan-600 font-semibold' : 'text-gray-800'}`}
                            >
                                Dashboard
                            </Link>
                        )}
                        <Link
                            to="/clients"
                            className={`hover:text-cyan-600 transition-colors ${isActive('/clients') ? 'text-cyan-600 font-semibold' : 'text-gray-800'}`}
                        >
                            Clientes
                        </Link>
                        {(!user || (user && (user.area || '').toString().toUpperCase() !== 'COMERCIAL')) && (
                            <Link
                                to="/chat-history"
                                className={`hover:text-cyan-600 transition-colors ${isActive('/chat-history') ? 'text-cyan-600 font-semibold' : 'text-gray-800'}`}
                            >
                                Historial Chats
                            </Link>
                        )}
                    </div>
            </div>

            <div className="flex items-center space-x-4">
                    <div className="bg-cyan-500/20 px-4 py-2 rounded-lg flex items-center space-x-2 border border-cyan-500/30">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                    <span className="font-medium text-gray-900">Hola, {user ? user.nombre : 'Usuario'}</span>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
