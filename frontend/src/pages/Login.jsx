import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import loginBg from '../img/login_img.png';
import logoImg from '../img/logo_verum_header.webp';

const Login = () => {
    const { login } = useAuth();
    const navigate = useNavigate();

    const [error, setError] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    const toggleShowPassword = () => {
        setShowPassword((s) => !s);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        const correo = e.target.email.value;
        const contrasena = e.target.password.value;

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ correo, contrasena }),
                credentials: 'include'
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                setError(data.detail || 'Login failed');
                return;
            }

            const data = await res.json();
            console.log('Login response', { status: res.status, data });
            try {
                if (data && data.refresh_token) {
                    const existing = JSON.parse(localStorage.getItem('auth') || 'null') || {};
                    existing.refresh_token = data.refresh_token;
                    localStorage.setItem('auth', JSON.stringify(existing));
                }
            } catch (e) {
            }
            login(data);

            const area = ((data.user && data.user.area) || '').toString().toUpperCase();
            if (area === 'TI' || area === 'ADMIN' || area === 'ADMINISTRADOR') {
                navigate('/dashboard');
            } else {
                navigate('/clients');
            }
        } catch (err) {
            setError('Error connecting to server');
            console.error(err);
        }
    };

    return (
        <div 
            className="flex items-center justify-center h-screen bg-gray-100"
            style={{
                backgroundImage: `url(${loginBg})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
            }}
        >
            <div className="bg-gray-300 shadow-lg rounded-lg p-8 w-96">
                <div className="flex justify-center mb-4">
                    <img src={logoImg} alt="Verum" className="h-12" />
                </div>

                <form className="space-y-5" onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label htmlFor="email" className="block text-gray-700">
                            Correo Electrónico
                        </label>
                        <input
                            id="email-address"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                            placeholder="usuario@correo.com"
                        />
                    </div>

                    <div className="mb-4">
                        <label htmlFor="password" className="block text-gray-700">
                            Contraseña
                        </label>
                        <div className="relative">
                            <input
                                id="password"
                                name="password"
                                type={showPassword ? 'text' : 'password'}
                                autoComplete="current-password"
                                required
                                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                                placeholder="****************"
                            />
                            <button
                                type="button"
                                onClick={toggleShowPassword}
                                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                className="absolute inset-y-0 right-0 flex items-center px-4 text-gray-500"
                            >
                                {showPassword ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9-3.5-10-7 1-2.5 3.5-4.5 6.5-5.5M6.5 6.5L17.5 17.5M9.879 9.879A3 3 0 0114.121 14.12" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                    {error && <div className="text-sm text-red-600 text-center bg-red-50 py-2 rounded-lg">{error}</div>}

                    <div>
                        <button 
                            type="submit" 
                            className="w-full bg-pink-500 text-white py-2 px-4 rounded-lg hover:bg-pink-600"
                        >
                            Iniciar Sesión
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Login;
