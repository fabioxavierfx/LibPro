import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../db/firebase';
import { useAuth } from '../hooks/useAuth';

interface Product {
    id: string;
    sku: string;
    description: string;
    ean?: string;
    category?: string;
    createdAt?: any;
    updatedAt?: any;
    [key: string]: any;
}

interface ProductsContextType {
    products: Product[];
    loading: boolean;
}

const ProductsContext = createContext<ProductsContextType | undefined>(undefined);

export const ProductsProvider = ({ children }: { children: ReactNode }) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);

    const { isApproved, loading: authLoading } = useAuth();

    useEffect(() => {
        if (authLoading || !isApproved) {
            setProducts([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        // Query all products globally to save reads
        const q = query(collection(db, 'products'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const prods = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Product[];
            setProducts(prods);
            setLoading(false);
        }, (error) => {
            // Se for erro de permissão, apenas silenciamos pois as regras estão fazendo o trabalho delas
            if (error.code !== 'permission-denied') {
                console.error("Error fetching products context:", error);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isApproved, authLoading]);

    return (
        <ProductsContext.Provider value={{ products, loading }}>
            {children}
        </ProductsContext.Provider>
    );
};

export const useProducts = () => {
    const context = useContext(ProductsContext);
    if (context === undefined) {
        throw new Error('useProducts must be used within a ProductsProvider');
    }
    return context;
};
