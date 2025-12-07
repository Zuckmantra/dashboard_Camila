import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AreaRoute = ({ allowedAreas = [], children }) => {
    const { auth } = useAuth();
    const user = auth && auth.user;

    if (!user) return <Navigate to="/login" replace />;

    const area = (user.area || user.area === 0) ? String(user.area).toUpperCase() : '';
    const allowed = allowedAreas.map(a => String(a).toUpperCase());

    if (!allowed.includes(area)) {
        return <Navigate to="/clients" replace />;
    }

    return children;
};

export default AreaRoute;
