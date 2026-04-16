import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../db/firebase';

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

    useEffect(() => {
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
            console.error("Error fetching products context:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

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
