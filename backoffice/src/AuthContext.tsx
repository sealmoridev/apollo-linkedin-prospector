import React, { createContext, useContext, useState, useEffect } from 'react';
import { getMe, getToken, setToken as saveToken, removeToken as deleteToken, AdminJwtPayload } from './lib/api';

interface AuthContextType {
    user: AdminJwtPayload | null;
    loading: boolean;
    loginUser: (token: string, userData: AdminJwtPayload) => void;
    logoutUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<AdminJwtPayload | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = getToken();
        if (token) {
            getMe()
                .then(data => {
                    setUser(data.user);
                })
                .catch(() => {
                    deleteToken();
                })
                .finally(() => {
                    setLoading(false);
                });
        } else {
            setLoading(false);
        }
    }, []);

    const loginUser = (token: string, userData: AdminJwtPayload) => {
        saveToken(token);
        setUser(userData);
    };

    const logoutUser = () => {
        deleteToken();
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, loginUser, logoutUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
