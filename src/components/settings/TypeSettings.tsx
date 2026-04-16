import { useState, useEffect } from 'react';
import { Layers, Plus, Edit2, Trash2, X, Check, Loader2 } from 'lucide-react';
import { collection, query, onSnapshot, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../db/firebase';

interface TypeRecord {
    id: string;
    name: string;
    createdAt?: any;
}

export const TypeSettings = () => {
    const [types, setTypes] = useState<TypeRecord[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState<TypeRecord | null>(null);
    const [itemName, setItemName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const qItems = query(collection(db, 'types'));
        const unsubscribe = onSnapshot(qItems, (snapshot) => {
            const items = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as TypeRecord[];
            items.sort((a, b) => a.name.localeCompare(b.name));
            setTypes(items);
        });

        return () => unsubscribe();
    }, []);

    const handleSave = async () => {
        if (!itemName.trim()) return;
        setIsSaving(true);
        try {
            if (editingItem) {
                await updateDoc(doc(db, 'types', editingItem.id), {
                    name: itemName.trim()
                });
            } else {
                await setDoc(doc(collection(db, 'types')), {
                    name: itemName.trim(),
                    createdAt: new Date()
                });
            }
            setShowModal(false);
            setEditingItem(null);
            setItemName('');
        } catch (error) {
            console.error('Erro ao salvar tipo:', error);
            alert('Erro ao salvar tipo. Tente novamente.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Tem certeza que deseja excluir este tipo?')) {
            try {
                await deleteDoc(doc(db, 'types', id));
            } catch (error) {
                console.error('Erro ao deletar tipo:', error);
            }
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="text-slate-900 dark:text-white font-bold text-lg flex items-center gap-2">
                        <Layers size={24} className="text-blue-500" />
                        Tipo
                    </h3>
                    <button
                        onClick={() => {
                            setEditingItem(null);
                            setItemName('');
                            setShowModal(true);
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-md active:scale-95"
                    >
                        <Plus size={18} /> Novo Tipo
                    </button>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60 p-2">
                    {types.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-500">
                                <Layers size={32} />
                            </div>
                            <p className="text-slate-500 font-medium">Nenhum tipo cadastrado.</p>
                        </div>
                    ) : (
                        types.map((item) => (
                            <div key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-2xl transition-colors group">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 font-bold group-hover:scale-110 transition-transform">
                                        <Layers size={20} />
                                    </div>
                                    <div>
                                        <p className="text-slate-900 dark:text-white font-bold">{item.name}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => {
                                            setEditingItem(item);
                                            setItemName(item.name);
                                            setShowModal(true);
                                        }}
                                        className="p-2 text-slate-400 hover:text-blue-500 bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-all shadow-sm border border-slate-200 dark:border-slate-700"
                                        title="Editar"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        className="p-2 text-slate-400 hover:text-red-500 bg-white dark:bg-slate-900 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all shadow-sm border border-slate-200 dark:border-slate-700"
                                        title="Excluir"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Layers className="text-blue-500" size={24} />
                                    {editingItem ? 'Editar Tipo' : 'Novo Tipo'}
                                </h2>
                                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded-full transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Nome do Tipo</label>
                                    <input
                                        type="text"
                                        value={itemName}
                                        onChange={(e) => setItemName(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                        placeholder="Ex: Livro, Revista..."
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="mt-8">
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving || !itemName.trim()}
                                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20 active:scale-95"
                                >
                                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Check size={20} />}
                                    {isSaving ? 'Salvando...' : 'Salvar Tipo'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
