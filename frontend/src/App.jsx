import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AreaRoute from './components/AreaRoute';
import NonComercialRoute from './components/NonComercialRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ClientList from './pages/ClientList';
import ClientDetails from './pages/ClientDetails';
import ChatHistory from './pages/ChatHistory';

function App() {
    return (
        <AuthProvider>
            <Router>
                <Routes>
                    <Route path="/login" element={<Login />} />

                    <Route element={<ProtectedRoute />}>
                        <Route path="/" element={<Layout />}>
                            <Route index element={<Navigate to="/dashboard" replace />} />
                            <Route path="dashboard" element={<AreaRoute allowedAreas={["TI","Admin"]}><Dashboard /></AreaRoute>} />
                            <Route path="clients" element={<ClientList />} />
                            <Route path="clients/:id" element={<ClientDetails />} />
                            <Route path="chat-history" element={<NonComercialRoute><ChatHistory /></NonComercialRoute>} />
                        </Route>
                    </Route>
                </Routes>
            </Router>
        </AuthProvider>
    );
}

export default App;
