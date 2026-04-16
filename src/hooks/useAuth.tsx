import { createContext, useContext, useEffect, useState, type ReactNode, type FC } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../db/firebase';

interface UserPermissions {
    inventory: boolean;
    tested: boolean;
    delivery: boolean;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isAdmin: boolean;
    isApproved: boolean;
    userStatus: 'active' | 'blocked';
    permissions: UserPermissions | null;
    allowRegistration: boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    isAdmin: false,
    isApproved: false,
    userStatus: 'active',
    permissions: null,
    allowRegistration: true
});

export const AuthProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isApproved, setIsApproved] = useState(false);
    const [userStatus, setUserStatus] = useState<'active' | 'blocked'>('active');
    const [permissions, setPermissions] = useState<UserPermissions | null>(null);
    const [allowRegistration, setAllowRegistration] = useState(true);

    useEffect(() => {
        // Listener real-time para configuração global de registro
        const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'auth'), (snapshot) => {
            if (snapshot.exists()) {
                setAllowRegistration(snapshot.data().allowRegistration !== false);
            }
        }, (error) => {
            console.error('Erro ao ouvir configurações:', error);
        });

        const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);
            if (firebaseUser) {
                const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    setIsAdmin(data.role === 'admin');
                    setIsApproved(data.approved === true || data.role === 'admin');
                    setUserStatus(data.status === 'blocked' ? 'blocked' : 'active');
                    setPermissions(data.permissions || {
                        inventory: true,
                        tested: true,
                        delivery: true
                    });
                } else {
                    setIsAdmin(false);
                    setIsApproved(false);
                    setUserStatus('active');
                    setPermissions(null);
                }
            } else {
                setIsAdmin(false);
                setIsApproved(false);
                setUserStatus('active');
                setPermissions(null);
            }
            setLoading(false);
        });

        return () => {
            unsubscribeSettings();
            unsubscribeAuth();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, isAdmin, isApproved, userStatus, permissions, allowRegistration }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
