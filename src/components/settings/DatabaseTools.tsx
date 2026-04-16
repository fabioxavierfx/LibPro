import { useState } from 'react';
import { Database, Download, Upload, Trash2, Loader2, AlertCircle, History as HistoryIcon } from 'lucide-react';
import { collection, getDocs, doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../db/firebase';

export const DatabaseTools = () => {
    const [isExporting, setIsExporting] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [isPurging, setIsPurging] = useState(false);
    const [purgeDays, setPurgeDays] = useState(90);
    const [showImportConfirm, setShowImportConfirm] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
    const [purgeType, setPurgeType] = useState<'reports' | 'history' | null>(null);

    const handleExportBackup = async () => {
        setIsExporting(true);
        try {
            const collections = ['products', 'reports', 'users', 'settings'];
            const backupData: any = {};

            for (const colName of collections) {
                const snapshot = await getDocs(collection(db, colName));
                backupData[colName] = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
            }

            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_stockreport_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Erro ao exportar backup:', error);
            alert('Erro ao exportar backup.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleImportBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setImportFile(file);
        setShowImportConfirm(true);
        event.target.value = '';
    };

    const confirmImportBackup = async () => {
        if (!importFile) return;
        setIsImporting(true);
        setShowImportConfirm(false);
        try {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const json = JSON.parse(e.target?.result as string);

                for (const colName in json) {
                    const docs = json[colName];
                    for (const docData of docs) {
                        const { id, ...data } = docData;
                        await setDoc(doc(db, colName, id), data, { merge: true });
                    }
                }
                alert('Importação concluída com sucesso!');
                window.location.reload();
            };
            if (importFile) {
                reader.readAsText(importFile);
            }
        } catch (error) {
            console.error('Erro ao importar backup:', error);
            alert('Erro ao importar backup. Verifique o formato do arquivo.');
        } finally {
            setIsImporting(false);
        }
    };

    const handlePurgeData = async (type: 'reports' | 'history') => {
        setPurgeType(type);
        setShowPurgeConfirm(true);
    };

    const confirmPurgeData = async () => {
        if (!purgeType) return;
        setShowPurgeConfirm(false);
        setIsPurging(true);
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - purgeDays);

            let deletedCount = 0;
            let updatedCount = 0;

            if (purgeType === 'reports') {
                const snapshot = await getDocs(collection(db, 'reports'));

                // Firestore batches handle up to 500 operations
                let batch = writeBatch(db);
                let opsCount = 0;

                for (const docSnap of snapshot.docs) {
                    const data = docSnap.data();
                    const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : null;

                    if (createdAt && createdAt < cutoffDate) {
                        batch.delete(doc(db, 'reports', docSnap.id));
                        opsCount++;
                        deletedCount++;

                        if (opsCount === 500) {
                            await batch.commit();
                            batch = writeBatch(db);
                            opsCount = 0;
                        }
                    }
                }

                if (opsCount > 0) {
                    await batch.commit();
                }

                alert(`${deletedCount} relatórios antigos foram removidos com segurança via batch.`);
            } else {
                const snapshot = await getDocs(collection(db, 'products'));

                let batch = writeBatch(db);
                let opsCount = 0;

                for (const docSnap of snapshot.docs) {
                    const data = docSnap.data();
                    if (!data.history || !Array.isArray(data.history)) continue;

                    const originalLength = data.history.length;
                    const newHistory = data.history.filter((entry: any) => {
                        const entryDate = new Date(entry.date);
                        return entryDate >= cutoffDate;
                    });

                    if (newHistory.length < originalLength) {
                        batch.update(doc(db, 'products', docSnap.id), {
                            history: newHistory
                        });
                        opsCount++;
                        updatedCount++;

                        if (opsCount === 500) {
                            await batch.commit();
                            batch = writeBatch(db);
                            opsCount = 0;
                        }
                    }
                }

                if (opsCount > 0) {
                    await batch.commit();
                }

                alert(`Histórico limpo eficientemente em ${updatedCount} produtos.`);
            }
        } catch (error) {
            console.error('Erro na limpeza de dados:', error);
            alert('Erro ao processar limpeza. Operação cancelada ou processada parcialmente.');
        } finally {
            setIsPurging(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Backup Section */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <Database className="text-blue-500" size={24} />
                    Backup do Sistema
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-6 bg-slate-100/30 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-blue-500/30 transition-all group">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500 group-hover:scale-110 transition-transform">
                                <Download size={24} />
                            </div>
                            <div>
                                <h3 className="text-slate-900 dark:text-white font-bold">Exportar Dados</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-xs">Baixar backup completo em JSON</p>
                            </div>
                        </div>
                        <button
                            onClick={handleExportBackup}
                            disabled={isExporting}
                            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                            {isExporting ? 'Exportando...' : 'Fazer Download'}
                        </button>
                    </div>

                    <div className="p-6 bg-slate-100/30 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/30 transition-all group">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500 group-hover:scale-110 transition-transform">
                                <Upload size={24} />
                            </div>
                            <div>
                                <h3 className="text-slate-900 dark:text-white font-bold">Importar Dados</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-xs">Restaurar de um arquivo JSON</p>
                            </div>
                        </div>
                        <label className="cursor-pointer">
                            <div className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95 text-center flex items-center justify-center gap-2">
                                {isImporting ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                                {isImporting ? 'Processando...' : 'Selecionar Arquivo'}
                            </div>
                            <input
                                type="file"
                                accept=".json"
                                className="hidden"
                                onChange={handleImportBackup}
                                disabled={isImporting}
                            />
                        </label>
                    </div>
                </div>
            </div>

            {/* Storage Policy */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8">
                <div className="flex items-center gap-2 mb-6">
                    <Trash2 className="text-red-500" size={24} />
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Política de Retenção</h2>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl mb-8 flex items-start gap-4 text-amber-500">
                    <AlertCircle size={24} className="shrink-0" />
                    <p className="text-sm">
                        Estas ações deletam permanentemente registros antigos para liberar espaço e melhorar a performance. Recomenda-se fazer um backup (usando a ferramenta acima) antes de prosseguir.
                    </p>
                </div>

                <div className="grid gap-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-slate-100/30 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <div>
                            <h3 className="text-slate-900 dark:text-white font-bold">Período de Retenção</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">Manter dados dos últimos:</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={purgeDays}
                                onChange={(e) => setPurgeDays(Number(e.target.value))}
                                className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 min-w-[120px]"
                            >
                                <option value={7}>7 Dias</option>
                                <option value={15}>15 Dias</option>
                                <option value={30}>30 Dias</option>
                                <option value={90}>90 Dias</option>
                                <option value={180}>180 Dias</option>
                                <option value={365}>1 Ano</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button
                            onClick={() => handlePurgeData('reports')}
                            disabled={isPurging}
                            className="p-4 bg-slate-100 dark:bg-slate-800 hover:bg-red-500/10 border border-slate-300 dark:border-slate-700 hover:border-red-500/30 text-slate-700 dark:text-slate-300 hover:text-red-400 rounded-2xl transition-all flex flex-col items-center gap-2 text-center group disabled:opacity-50"
                        >
                            <Trash2 size={24} className="group-hover:scale-110 transition-transform" />
                            <div>
                                <p className="font-bold text-sm">Limpar Relatórios</p>
                                <p className="text-[10px] opacity-60">Filtra coleções de Inventário/Testados/Entregas</p>
                            </div>
                        </button>

                        <button
                            onClick={() => handlePurgeData('history')}
                            disabled={isPurging}
                            className="p-4 bg-slate-100 dark:bg-slate-800 hover:bg-red-500/10 border border-slate-300 dark:border-slate-700 hover:border-red-500/30 text-slate-700 dark:text-slate-300 hover:text-red-400 rounded-2xl transition-all flex flex-col items-center gap-2 text-center group disabled:opacity-50"
                        >
                            <HistoryIcon size={24} className="group-hover:scale-110 transition-transform" />
                            <div>
                                <p className="font-bold text-sm">Limpar Histórico</p>
                                <p className="text-[10px] opacity-60">Remove logs antigos dentro dos produtos</p>
                            </div>
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal de Confirmação de Importação */}
            {showImportConfirm && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <AlertCircle size={32} />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Importar Backup?</h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
                                Atenção: A importação pode sobrescrever dados existentes. Deseja continuar com o arquivo <strong>{importFile?.name}</strong>?
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowImportConfirm(false);
                                        setImportFile(null);
                                    }}
                                    className="flex-1 py-3 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white font-semibold transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmImportBackup}
                                    className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg active:scale-95"
                                >
                                    Importar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Confirmação de Limpeza de Dados */}
            {showPurgeConfirm && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Trash2 size={32} />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Limpar Dados?</h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
                                Tem certeza que deseja deletar {purgeType === 'reports' ? 'RELATÓRIOS' : 'HISTÓRICOS'} com mais de {purgeDays} dias? Esta ação é irreversível.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowPurgeConfirm(false);
                                        setPurgeType(null);
                                    }}
                                    className="flex-1 py-3 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white font-semibold transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmPurgeData}
                                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg active:scale-95"
                                >
                                    Limpar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
