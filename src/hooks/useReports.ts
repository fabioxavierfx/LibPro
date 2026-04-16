import { useState, useEffect } from 'react';
// FORCE_VITE_RELOAD_PATCH_01

import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '../db/firebase';

interface UseReportsResult<T> {
    reports: T[];
    loading: boolean;
}

export const useReports = <T extends { id: string; type: string; createdAt: any; locationId?: string; }>(
    type: string,
    filterDate: string,
    filterLocation?: string,
    queryLimit: number = 50
): UseReportsResult<T> => {
    const [reports, setReports] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        // Utilizando filtro nativo por tipo e limite para reduzir uso de banda e memória.
        // Necessário criar índice composto no Firebase: type (ASC) + createdAt (DESC)
        const q = query(
            collection(db, 'reports'),
            where('type', '==', type),
            orderBy('createdAt', 'desc'),
            limit(queryLimit)
        );

        const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
            const allReps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as T));

            // Filtramos no cliente apenas data e localização para manter flexibilidade sem precisar de múltiplos indíces complexos
            const filteredReports = allReps.filter(r => {
                if (filterDate) {
                    const reportDate = r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString('en-CA') : '';
                    if (reportDate !== filterDate) return false;
                }

                if (filterLocation && r.locationId !== filterLocation) {
                    return false;
                }

                return true;
            });

            setReports(filteredReports);
            setLoading(false);
        }, (error) => {
            console.error('Erro na query de reports:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [type, filterDate, filterLocation, queryLimit]);

    return { reports, loading };
};
