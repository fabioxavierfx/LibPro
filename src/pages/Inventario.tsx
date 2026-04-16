import { useState, useEffect, useRef } from 'react';
// FORCE_VITE_RELOAD_PATCH_01

import {
    collection,
    addDoc,
    query,
    updateDoc,
    doc,
    arrayUnion,
    serverTimestamp,
    deleteDoc,
    getDoc,
    onSnapshot,
    Timestamp
} from 'firebase/firestore';
import { db } from '../db/firebase';
import { Plus, Trash2, MapPin, Calculator, ClipboardList, X, AlertTriangle, Share2, Printer, Layers, Edit2 } from 'lucide-react';
import { shareReport, printWebReport } from '../utils/reportUtils';
import { ProductPicker } from '../components/operational/ProductPicker';
import toast from 'react-hot-toast';
import { useReports } from '../hooks/useReports';
import { useAuth } from '../hooks/useAuth';
import { useProducts } from '../contexts/ProductsContext';
import { ReportSkeleton } from '../components/ReportSkeleton';

interface ReportItem {
    productId: string;
    sku: string;
    description: string;
    currentCount: number;
    previousCount: number;
}

interface Location {
    id: string;
    name: string;
}


interface Report {
    id: string;
    type: 'inventory' | 'tested' | 'delivery';
    createdAt: any;
    updatedAt: any;
    totalItems: number;
    items: ReportItem[];
    userName?: string;
    title?: string;
    locationId?: string;
    locationName?: string;
    sequentialId?: number;
}

const Inventario = () => {
    const [selectedReports, setSelectedReports] = useState<string[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [selectedLocationId, setSelectedLocationId] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [reportItems, setReportItems] = useState<ReportItem[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [quantity, setQuantity] = useState<number | string>('');
    const [title, setTitle] = useState('');
    const [currentReport, setCurrentReport] = useState<Report | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [missingSkus, setMissingSkus] = useState<ReportItem[]>([]);
    const [showMissingModal, setShowMissingModal] = useState(false);
    const [duplicateItemIndex, setDuplicateItemIndex] = useState<number | null>(null);
    const [filterDate, setFilterDate] = useState('');
    const [summingIndex, setSummingIndex] = useState<number | null>(null);
    const [sumValue, setSumValue] = useState<number | string>('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [itemIndexToDelete, setItemIndexToDelete] = useState<number | null>(null);
    const [showReportDeleteConfirm, setShowReportDeleteConfirm] = useState(false);
    const [reportIdToDelete, setReportIdToDelete] = useState<string | null>(null);

    const { reports, loading } = useReports<Report>('inventory', filterDate);
    const { user } = useAuth();
    const { products: allProducts } = useProducts() as any;
    const [disableDecimals, setDisableDecimals] = useState(false);

    useEffect(() => {
        if (user) {
            const loadOptions = async () => {
                const optionsDoc = await getDoc(doc(db, 'users', user.uid, 'settings', 'general'));
                if (optionsDoc.exists()) {
                    setDisableDecimals(optionsDoc.data().disableDecimals || false);
                }
            };
            loadOptions();
        }
    }, [user]);

    const skuInputRef = useRef<HTMLInputElement>(null);
    const quantityInputRef = useRef<HTMLInputElement>(null);
    const sumInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const qLocs = query(collection(db, 'locations'));
        const unsubscribeLocs = onSnapshot(qLocs, (snapshot: any) => {
            const locs = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as Location[];
            locs.sort((a, b) => a.name.localeCompare(b.name));
            setLocations(locs);
        });

        return () => {
            unsubscribeLocs();
        };
    }, []);

    // Helper functions removed as they are now handled by ProductPicker

    const addItemToReport = async () => {
        if (!selectedProduct) return;

        const existingIndex = reportItems.findIndex(i => i.productId === selectedProduct.id);
        if (existingIndex !== -1) {
            const updatedItems = [...reportItems];
            updatedItems[existingIndex].currentCount += 1;
            setReportItems(updatedItems);
            setSelectedProduct(null);
            setSearchTerm('');
            skuInputRef.current?.focus();
            return;
        }

        // Buscar contagem anterior usando o array local de reports
        let previousCount = 0;
        let previousReport = null;

        if (currentReport) {
            // Editando: procurar o primeiro relatório do mesmo local que seja mais antigo que o atual
            const currentReportCreatedAt = currentReport.createdAt?.toDate ? currentReport.createdAt.toDate().getTime() : Date.now();
            previousReport = reports.find(r =>
                r.locationId === selectedLocationId &&
                r.id !== currentReport.id &&
                (r.createdAt?.toDate ? r.createdAt.toDate().getTime() : 0) < currentReportCreatedAt
            );
        } else {
            // Novo: o mais recente (primeiro do array) com o mesmo local
            previousReport = reports.find(r => r.locationId === selectedLocationId);
        }

        if (previousReport) {
            const prevItem = previousReport.items.find((i: any) => i.productId === selectedProduct.id);
            previousCount = prevItem ? prevItem.currentCount : 0;
        }

        const newItem: ReportItem = {
            productId: selectedProduct.id,
            sku: selectedProduct.sku,
            description: selectedProduct.description,
            currentCount: 1,
            previousCount: previousCount
        };

        setReportItems([...reportItems, newItem]);
        setSelectedProduct(null);
        setSearchTerm('');
        skuInputRef.current?.focus();
    };

    const handleSum = () => {
        if (summingIndex !== null && sumValue !== '') {
            const updatedItems = [...reportItems];
            updatedItems[summingIndex].currentCount += Number(sumValue);
            setReportItems(updatedItems);
            setSummingIndex(null);
            setSumValue('');
        }
    };

    const confirmUpdate = () => {
        if (duplicateItemIndex !== null) {
            const updatedItems = [...reportItems];
            updatedItems[duplicateItemIndex].currentCount = Number(quantity) || 0;
            setReportItems(updatedItems);
            setSelectedProduct(null);
            setSearchTerm('');
            setQuantity('');
            setShowConfirmModal(false);
            setDuplicateItemIndex(null);
            skuInputRef.current?.focus();
        }
    };

    const checkMissingItems = async () => {
        // Apenas na criação de novo relatório
        if (currentReport) {
            await executeFinalSave(reportItems);
            return;
        }

        // Buscar o último inventário do array local
        const lastReport = reports.find(r => r.locationId === selectedLocationId);

        if (!lastReport) {
            await executeFinalSave(reportItems);
            return;
        }

        // Identificar SKUs que tinham >0 no anterior e não estão no atual
        const currentSkus = new Set(reportItems.map(i => i.sku));
        const missing = lastReport.items.filter(item =>
            item.currentCount > 0 && !currentSkus.has(item.sku)
        );

        if (missing.length > 0) {
            setMissingSkus(missing);
            setShowMissingModal(true);
        } else {
            await executeFinalSave(reportItems);
        }
    };

    const handleSaveWithMissing = async (addMissing: boolean) => {
        let itemsToSave = [...reportItems];
        if (addMissing) {
            const itemsWithZero = missingSkus.map(m => ({
                ...m,
                previousCount: m.currentCount,
                currentCount: 0
            }));
            itemsToSave = [...itemsToSave, ...itemsWithZero];
        }
        setShowMissingModal(false);
        await executeFinalSave(itemsToSave);
    };

    const executeFinalSave = async (itemsToSave: ReportItem[]) => {
        if (itemsToSave.length === 0) return;

        let reportRef;
        const locationObj = locations.find(l => l.id === selectedLocationId);

        let finalLocationName = locationObj?.name || '';
        if (currentReport?.id.startsWith('unified-') && currentReport.locationName) {
            finalLocationName = finalLocationName ? `${finalLocationName} (${currentReport.locationName})` : currentReport.locationName;
        }

        if (currentReport && !currentReport.id.startsWith('unified-')) {
            reportRef = doc(db, 'reports', currentReport.id);
            await updateDoc(reportRef, {
                title: title.trim(),
                items: itemsToSave,
                totalItems: itemsToSave.length,
                locationId: selectedLocationId,
                locationName: finalLocationName,
                updatedAt: Timestamp.now()
            });
        } else {
            // Calcular o próximo ID sequencial baseado nos relatórios existentes
            const nextSequentialId = reports.length > 0
                ? Math.max(reports.length, ...reports.map(r => r.sequentialId || 0)) + 1
                : 1;

            const newDoc = await addDoc(collection(db, 'reports'), {
                type: 'inventory',
                title: title.trim(),
                items: itemsToSave,
                totalItems: itemsToSave.length,
                locationId: selectedLocationId,
                locationName: finalLocationName,
                sequentialId: nextSequentialId,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            });
            reportRef = newDoc;
        }

        // Atualizar histórico de cada produto
        for (const item of itemsToSave) {
            const historyEntry = {
                action: 'Picking List',
                date: new Date().toISOString(),
                details: `Item separado/verificado: ${item.currentCount}`,
                reportId: currentReport ? currentReport.id : reportRef.id
            };

            await updateDoc(doc(db, 'products', item.productId), {
                history: arrayUnion(historyEntry),
                updatedAt: Timestamp.now()
            });
        }

        setIsModalOpen(false);
        setReportItems([]);
        setTitle('');
        setSelectedLocationId('');
        setCurrentReport(null);
        toast.success("Inventário salvo com sucesso!");
    };

    const saveReport = async () => {
        await checkMissingItems();
    };

    const deleteReport = async (id: string) => {
        setReportIdToDelete(id);
        setShowReportDeleteConfirm(true);
    };

    const confirmDeleteReport = async () => {
        if (!reportIdToDelete) return;
        try {
            await deleteDoc(doc(db, 'reports', reportIdToDelete));
            setShowReportDeleteConfirm(false);
            setReportIdToDelete(null);
            toast.success("Inventário excluído!");
        } catch (error) {
            toast.error('Erro ao excluir');
            console.error('Erro ao excluir:', error);
        }
    };

    const handleToggleSelectReport = (reportId: string) => {
        setSelectedReports(prev => {
            if (prev.includes(reportId)) return prev.filter(id => id !== reportId);
            if (prev.length >= 5) {
                toast.error('Você pode selecionar no máximo 5 relatórios para unificar.');
                return prev;
            }
            return [...prev, reportId];
        });
    };

    const handleMergeReports = () => {
        if (selectedReports.length < 2) return;

        const reportsToMerge = reports.filter(r => selectedReports.includes(r.id));
        const mergedItemsMap = new Map<string, ReportItem>();

        reportsToMerge.forEach(report => {
            report.items.forEach(item => {
                const existing = mergedItemsMap.get(item.sku);
                if (existing) {
                    existing.currentCount += item.currentCount;
                } else {
                    mergedItemsMap.set(item.sku, { ...item, previousCount: 0 });
                }
            });
        });

        const mergedItems = Array.from(mergedItemsMap.values());

        // Coletar locais únicos dos relatórios mesclados
        const uniqueLocations = Array.from(new Set(reportsToMerge.map(r => r.locationName).filter(Boolean)));

        setReportItems(mergedItems);
        setTitle(`Inventários Unificados (${selectedReports.length})`);
        setSelectedLocationId(''); // O usuário pode então selecionar um novo local ou deixar em branco

        // Passar os locais originais para o "locationName" temporariamente para sabermos durante a impressão ou salvamento
        setCurrentReport({
            id: 'unified-' + Date.now().toString(),
            type: 'inventory',
            title: `Inventários Unificados (${selectedReports.length})`,
            totalItems: mergedItems.length,
            items: mergedItems,
            createdAt: null as any,
            updatedAt: null as any,
            locationName: uniqueLocations.join(', ')
        });

        setIsModalOpen(true);
        setSelectedReports([]);
    };

    const handleShare = async (report: Report, printId: number) => {
        await shareReport(report, printId, false, false, allProducts);
    };

    const handlePrintReport = (report: Report, printId: number) => {
        printWebReport(report, printId, true, allProducts);
    };

    const handleLocationChange = (newLocationId: string) => {
        setSelectedLocationId(newLocationId);

        if (reportItems.length > 0) {
            let previousReport: Report | undefined;

            if (currentReport && !currentReport.id.startsWith('unified-')) {
                const currentReportCreatedAt = currentReport.createdAt?.toDate ? currentReport.createdAt.toDate().getTime() : Date.now();
                previousReport = reports.find(r =>
                    r.locationId === newLocationId &&
                    r.id !== currentReport.id &&
                    (r.createdAt?.toDate ? r.createdAt.toDate().getTime() : 0) < currentReportCreatedAt
                );
            } else {
                previousReport = reports.find(r => r.locationId === newLocationId);
            }

            const updatedItems = reportItems.map(item => {
                let previousCount = 0;
                if (previousReport) {
                    const prevItem = previousReport.items.find((i: any) => i.productId === item.productId || i.sku === item.sku);
                    previousCount = prevItem ? prevItem.currentCount : 0;
                }
                return { ...item, previousCount };
            });

            setReportItems(updatedItems);
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-full mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Picking List</h1>
                    <p className="text-slate-500 dark:text-slate-400">Relatórios de contagem e separação</p>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 items-end bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl mb-6 shadow-lg">
                <div className="flex-1 w-full">
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-2 ml-1">Filtrar por Dia</label>
                    <input
                        type="date"
                        className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                    />
                </div>
                <button
                    onClick={() => setFilterDate('')}
                    className="px-6 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white transition-colors text-sm font-medium h-[42px]"
                >
                    Limpar
                </button>
                <div className="hidden md:block h-10 w-px bg-slate-100 dark:bg-slate-800 mx-2"></div>
                {selectedReports.length > 1 && (
                    <button
                        onClick={handleMergeReports}
                        className="w-full md:w-auto flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-900/20 font-bold"
                    >
                        <Layers size={20} />
                        <span>Unificar ({selectedReports.length})</span>
                    </button>
                )}
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="w-full md:w-auto flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-900/20 font-bold"
                >
                    <Plus size={20} />
                    <span>Novo Relatório</span>
                </button>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                {loading ? (
                    <div className="p-4 md:p-6">
                        <ReportSkeleton />
                    </div>
                ) : (
                    <>
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-200/50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 text-sm">
                                        <th className="px-6 py-4 font-semibold w-12">
                                            <div className="w-4 h-4" /> {/* Spacer for alignment */}
                                        </th>
                                        <th className="px-6 py-4 font-semibold">ID</th>
                                        <th className="px-6 py-4 font-semibold">Título</th>
                                        <th className="px-6 py-4 font-semibold">Criação</th>
                                        <th className="px-6 py-4 font-semibold">Alteração</th>
                                        <th className="px-6 py-4 font-semibold text-center">Itens</th>
                                        <th className="px-6 py-4 font-semibold text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                    {reports.map((report, index) => {
                                        const displayId = report.sequentialId || (reports.length - index);
                                        const isSelected = selectedReports.includes(report.id);
                                        return (
                                            <tr key={report.id} className={`transition-colors ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : 'hover:bg-slate-100/30 dark:bg-slate-800/30'}`}>
                                                <td className="px-6 py-4">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => handleToggleSelectReport(report.id)}
                                                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 dark:border-slate-700 focus:ring-emerald-500 dark:bg-slate-800 cursor-pointer"
                                                    />
                                                </td>
                                                <td className="px-6 py-4 font-mono text-emerald-400">#{displayId}</td>
                                                <td className="px-6 py-4">
                                                    <div className="font-bold text-slate-900 dark:text-white">
                                                        {report.title || <span className="text-slate-400 font-normal">Picking List #{displayId}</span>}
                                                    </div>
                                                    {report.locationName && (
                                                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                                                            <MapPin size={12} className="text-emerald-500" />
                                                            {report.locationName}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-slate-700 dark:text-slate-300 text-sm">
                                                    {report.createdAt?.toDate ? (
                                                        <div className="flex flex-col">
                                                            <span>{report.createdAt.toDate().toLocaleDateString('pt-BR')}</span>
                                                            <span className="text-xs text-slate-500 font-normal mt-0.5">{report.createdAt.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                    ) : 'Processando...'}
                                                </td>
                                                <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-sm">
                                                    {report.updatedAt?.toDate ? (
                                                        <div className="flex flex-col">
                                                            <span>{report.updatedAt.toDate().toLocaleDateString('pt-BR')}</span>
                                                            <span className="text-xs font-normal mt-0.5">{report.updatedAt.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </div>
                                                    ) : '-'}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold">
                                                        {report.totalItems}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-2 text-nowrap">
                                                        <button
                                                            onClick={() => {
                                                                setCurrentReport(report);
                                                                setReportItems(report.items);
                                                                setTitle(report.title || '');
                                                                setSelectedLocationId(report.locationId || '');
                                                                setIsModalOpen(true);
                                                            }}
                                                            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-200 dark:bg-slate-700 rounded-lg transition-all"
                                                            title="Editar"
                                                        >
                                                            <Edit2 size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handlePrintReport(report, displayId)}
                                                            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-200 dark:bg-slate-700 rounded-lg transition-all"
                                                            title="Imprimir"
                                                        >
                                                            <Printer size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => deleteReport(report.id)}
                                                            className="p-2 text-slate-500 dark:text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                                                            title="Excluir"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile View (Cards) */}
                        <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
                            {reports.map((report, index) => {
                                const displayId = report.sequentialId || (reports.length - index);
                                const dateText = report.createdAt?.toDate ? report.createdAt.toDate().toLocaleString('pt-BR') : 'Processando...';
                                const isSelected = selectedReports.includes(report.id);
                                return (
                                    <div key={report.id} className={`p-4 space-y-4 transition-colors ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-900/20' : 'hover:bg-slate-100/20 dark:bg-slate-800/20'}`}>
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleToggleSelectReport(report.id)}
                                                    className="w-5 h-5 text-emerald-600 rounded border-slate-300 dark:border-slate-700 focus:ring-emerald-500 dark:bg-slate-800 cursor-pointer"
                                                />
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2 max-w-[200px] sm:max-w-[250px]">
                                                        <p className="font-mono text-emerald-400 font-bold shrink-0">#{displayId}</p>
                                                        <span className="text-slate-900 dark:text-white font-semibold text-sm truncate">
                                                            {report.title || `Picking List #${displayId}`}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-slate-500 text-[10px]">{dateText}</p>
                                                        {report.locationName && (
                                                            <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded truncate max-w-[100px]">
                                                                {report.locationName}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-full text-[10px] font-bold">
                                                {report.totalItems}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between pt-2 border-t border-slate-200/50 dark:border-slate-800/50">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        setCurrentReport(report);
                                                        setReportItems(report.items);
                                                        setTitle(report.title || '');
                                                        setSelectedLocationId(report.locationId || '');
                                                        setIsModalOpen(true);
                                                    }}
                                                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold border border-slate-300 dark:border-slate-700"
                                                >
                                                    <Edit2 size={14} />
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={() => handlePrintReport(report, displayId)}
                                                    className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-300 dark:border-slate-700"
                                                >
                                                    <Printer size={14} />
                                                </button>
                                                <button
                                                    onClick={() => deleteReport(report.id)}
                                                    className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-red-400 rounded-lg border border-slate-300 dark:border-slate-700"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                            <button
                                                onClick={() => handleShare(report, displayId)}
                                                className="p-2.5 bg-blue-600/10 text-blue-400 rounded-lg border border-blue-500/20"
                                            >
                                                <Share2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                            {reports.length === 0 && (
                                <div className="p-12 text-center text-slate-500 italic text-sm">
                                    Nenhum relatório cadastrado.
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-black/80 backdrop-blur-md">
                    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
                        <div className="p-4 md:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between md:items-center bg-white/50 dark:bg-slate-900/50 gap-4">
                            <div className="flex-1 flex flex-col md:flex-row gap-4 items-center">
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder={currentReport ? `Picking List #${reports.length - reports.findIndex(r => r.id === currentReport.id)}` : `Picking List #${reports.length + 1}`}
                                    className="w-full md:w-auto flex-1 text-xl md:text-2xl font-bold text-slate-900 dark:text-white bg-transparent border-none outline-none focus:ring-0 px-2 placeholder-slate-400 dark:placeholder-slate-600 truncate"
                                />
                            </div>
                            <button onClick={() => { setIsModalOpen(false); setReportItems([]); setTitle(''); setSelectedLocationId(''); setCurrentReport(null); }} className="absolute md:static top-4 right-4 md:top-auto md:right-auto text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white shrink-0">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white/50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                                <div className="md:col-span-2 relative">
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-2 ml-1">Produto (SKU, ISBN ou Título)</label>
                                    <ProductPicker
                                        selectedProduct={selectedProduct}
                                        onSelectProduct={(p) => {
                                            setSelectedProduct(p);
                                            if (p) {
                                                setTimeout(() => quantityInputRef.current?.focus(), 10);
                                            }
                                        }}
                                        searchTerm={searchTerm}
                                        onSearchChange={setSearchTerm}
                                        themeColor="emerald"
                                        inputRef={skuInputRef}
                                    />
                                </div>

                                <div className="md:w-32 flex items-end h-[74px]">
                                    <button
                                        onClick={addItemToReport}
                                        disabled={!selectedProduct}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg transition-all font-bold flex items-center justify-center gap-2"
                                    >
                                        <Plus size={20} />
                                        <span>Adicionar</span>
                                    </button>
                                </div>
                            </div>

                            {/* Lista de Itens do Relatório */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-2">
                                    <ClipboardList size={16} />
                                    Itens no Relatório ({reportItems.length})
                                </h3>
                                <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-white dark:bg-slate-900 text-slate-500 uppercase text-[10px] tracking-wider">
                                            <tr>
                                                <th className="px-6 py-3">SKU/ISBN</th>
                                                <th className="px-6 py-3">Título</th>
                                                <th className="px-6 py-3">Categoria</th>
                                                <th className="px-6 py-3">Conservação/Tipo</th>
                                                <th className="px-6 py-3">Local/ID</th>
                                                <th className="px-6 py-3"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white/30 dark:bg-slate-900/30">
                                            {reportItems
                                                .filter(i =>
                                                    i.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                    i.description.toLowerCase().includes(searchTerm.toLowerCase())
                                                )
                                                .map((item, idx) => {
                                                    const diff = item.currentCount - item.previousCount;
                                                    const originalIndex = reportItems.findIndex(ri => ri === item);
                                                    const fullProduct = allProducts?.find((p: any) => p.sku === item.sku || p.id === item.productId) || {};
                                                    return (
                                                        <tr key={idx}>
                                                            <td className="px-6 py-4">
                                                                <p className="font-mono text-emerald-400 font-bold whitespace-nowrap">{item.sku}{fullProduct.ean ? ` / ${fullProduct.ean}` : ''}</p>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <p className="text-slate-900 dark:text-white font-semibold line-clamp-2 max-w-[200px]">{fullProduct.title || item.description}</p>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <p className="text-slate-500 text-xs whitespace-nowrap">{fullProduct.category || '-'}</p>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <p className="text-slate-500 text-xs uppercase whitespace-nowrap">{fullProduct.conservation || '-'}/{fullProduct.type || '-'}</p>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <p className="text-slate-500 text-xs whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">{fullProduct.locationId || '-'} / {fullProduct.identifier || '-'}</p>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="flex justify-end gap-2">
                                                                    <button
                                                                        onClick={() => {
                                                                            setItemIndexToDelete(originalIndex);
                                                                            setShowDeleteConfirm(true);
                                                                        }}
                                                                        className="text-slate-600 hover:text-red-400 p-1"
                                                                        title="Excluir"
                                                                    >
                                                                        <Trash2 size={18} />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            {reportItems.length === 0 && (
                                                <tr>
                                                    <td colSpan={9} className="px-6 py-12 text-center text-slate-600 italic">
                                                        Nenhum item adicionado ainda.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile View dos itens no modal */}
                                <div className="md:hidden space-y-3">
                                    {reportItems
                                        .filter(i =>
                                            i.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                            i.description.toLowerCase().includes(searchTerm.toLowerCase())
                                        )
                                        .map((item, idx) => {
                                            const diff = item.currentCount - item.previousCount;
                                            const originalIndex = reportItems.findIndex(ri => ri === item);
                                            const fullProduct = allProducts?.find((p: any) => p.sku === item.sku || p.id === item.productId) || {};
                                            return (
                                                <div key={idx} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex justify-between items-center shadow-sm">
                                                    <div className="flex-1 min-w-0 pr-4">
                                                        <p className="font-mono text-emerald-400 font-bold text-sm truncate">{item.sku}{fullProduct.ean ? ` / ${fullProduct.ean}` : ''}</p>
                                                        <p className="text-slate-900 dark:text-white font-semibold text-sm line-clamp-2 mb-1">{fullProduct.title || item.description}</p>
                                                        <div className="flex flex-wrap gap-1 mb-2">
                                                            {fullProduct.category && <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] px-1.5 py-0.5 rounded">{fullProduct.category}</span>}
                                                            {fullProduct.conservation && <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] px-1.5 py-0.5 rounded uppercase">{fullProduct.conservation}</span>}
                                                            {fullProduct.type && <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] px-1.5 py-0.5 rounded uppercase">{fullProduct.type}</span>}
                                                            {fullProduct.locationId && <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] px-1.5 py-0.5 rounded font-bold">L:{fullProduct.locationId}</span>}
                                                            {fullProduct.identifier && <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] px-1.5 py-0.5 rounded font-bold">ID:{fullProduct.identifier}</span>}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setItemIndexToDelete(originalIndex);
                                                                setShowDeleteConfirm(true);
                                                            }}
                                                            className="p-3 bg-red-400/10 text-red-500 rounded-lg active:scale-95 transition-all"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    {reportItems.length === 0 && (
                                        <div className="py-8 text-center text-slate-500 italic text-sm border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                            Nenhum item adicionado
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 md:p-6 border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 flex flex-col md:flex-row justify-end gap-3 md:gap-4">
                            <button
                                onClick={() => { setIsModalOpen(false); setReportItems([]); setTitle(''); setCurrentReport(null); }}
                                className="order-2 md:order-1 px-6 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={saveReport}
                                disabled={reportItems.length === 0}
                                className="order-1 md:order-2 px-8 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all shadow-lg active:scale-95"
                            >
                                Finalizar Relatório
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmação de Duplicidade */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertTriangle size={32} />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Item Já Adicionado</h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
                                Este SKU já está na lista. Deseja atualizar a quantidade para o novo valor informado?
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowConfirmModal(false);
                                        setDuplicateItemIndex(null);
                                    }}
                                    className="flex-1 py-3 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white font-semibold transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmUpdate}
                                    className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg active:scale-95"
                                >
                                    Alterar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal de Itens Ausentes */}
            {showMissingModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
                            <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mb-4">
                                <AlertTriangle size={24} />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Itens Ausentes Detectados</h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">
                                Os seguintes SKUs tinham estoque no inventário anterior mas não foram bipados neste. Deseja adicioná-los com quantidade 0?
                            </p>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/50 dark:bg-slate-950/50">
                            {missingSkus.map(item => (
                                <div key={item.sku} className="p-3 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg border border-slate-300 dark:border-slate-700 flex justify-between items-center group">
                                    <div>
                                        <p className="font-mono text-blue-400 text-sm font-bold group-hover:text-blue-300 transition-colors">{item.sku}</p>
                                        <p className="text-slate-500 text-[10px] truncate max-w-[250px]">{item.description}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-slate-500 text-[8px] uppercase font-bold">Anterior</p>
                                        <p className="font-bold text-slate-700 dark:text-slate-300">{item.currentCount}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-6 bg-white/50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-3">
                            <button
                                onClick={() => handleSaveWithMissing(true)}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg active:scale-95 text-sm"
                            >
                                Sim, zerar itens e finalizar
                            </button>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => handleSaveWithMissing(false)}
                                    className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-xl transition-all border border-slate-300 dark:border-slate-700 text-xs"
                                >
                                    Não, apenas finalizar
                                </button>
                                <button
                                    onClick={() => setShowMissingModal(false)}
                                    className="bg-transparent hover:bg-slate-100/50 dark:bg-slate-800/50 text-slate-500 hover:text-slate-900 dark:text-white py-3 font-semibold transition-all text-xs"
                                >
                                    Revisar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal de Soma */}
            {summingIndex !== null && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Calculator size={32} />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Somar Quantidade</h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
                                Informe o valor para somar ao item <strong>{reportItems[summingIndex].sku}</strong>.
                                <br />
                                Atual: {reportItems[summingIndex].currentCount}
                            </p>
                            <input
                                type="number"
                                ref={sumInputRef}
                                autoFocus
                                placeholder="Valor a somar (ex: 10)"
                                className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white mb-6 focus:ring-2 focus:ring-emerald-500 outline-none no-spinner"
                                value={sumValue}
                                onKeyDown={(e) => {
                                    if (disableDecimals && (e.key === '.' || e.key === ',')) {
                                        e.preventDefault();
                                    }
                                    if (e.key === 'Enter') handleSum();
                                }}
                                onChange={(e) => setSumValue(e.target.value === '' ? '' : Number(e.target.value))}
                            />
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setSummingIndex(null);
                                        setSumValue('');
                                    }}
                                    className="flex-1 py-3 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white font-semibold transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSum}
                                    disabled={sumValue === ''}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg active:scale-95"
                                >
                                    Somar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmação de Exclusão de Item */}
            {
                showDeleteConfirm && (
                    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                            <div className="p-6 text-center">
                                <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Trash2 size={32} />
                                </div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Remover Item?</h2>
                                <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
                                    Tem certeza que deseja remover este item do relatório? Esta ação não pode ser desfeita.
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            setShowDeleteConfirm(false);
                                            setItemIndexToDelete(null);
                                        }}
                                        className="flex-1 py-3 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white font-semibold transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (itemIndexToDelete !== null) {
                                                setReportItems(reportItems.filter((_, i) => i !== itemIndexToDelete));
                                            }
                                            setShowDeleteConfirm(false);
                                            setItemIndexToDelete(null);
                                        }}
                                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg active:scale-95"
                                    >
                                        Excluir
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modal de Confirmação de Exclusão de Relatório */}
            {
                showReportDeleteConfirm && (
                    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                            <div className="p-6 text-center">
                                <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Trash2 size={32} />
                                </div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Excluir Relatório?</h2>
                                <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
                                    Tem certeza que deseja apagar este relatório permanentemente?
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            setShowReportDeleteConfirm(false);
                                            setReportIdToDelete(null);
                                        }}
                                        className="flex-1 py-3 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white font-semibold transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={confirmDeleteReport}
                                        className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg active:scale-95"
                                    >
                                        Excluir
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default Inventario;
