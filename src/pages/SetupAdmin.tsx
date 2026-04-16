import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../db/firebase';
import { ShieldCheck, UserPlus, AlertCircle } from 'lucide-react';

const SetupAdmin = () => {
    const [status, setStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error', message: string }>({ type: 'idle', message: '' });

    const handleCreateAdmin = async () => {
        setStatus({ type: 'loading', message: 'Criando conta no Firebase...' });
        try {
            // 1. Criar na Auth
            const userCredential = await createUserWithEmailAndPassword(auth, 'fabioxavier@hotmail.com', 'admin1234');

            // 2. Definir Role no Firestore
            await setDoc(doc(db, 'users', userCredential.user.uid), {
                email: 'fabioxavier@hotmail.com',
                role: 'admin',
                createdAt: new Date().toISOString()
            });

            setStatus({ type: 'success', message: 'Usuário Admin criado com sucesso! Você já pode fazer login.' });
        } catch (error: any) {
            if (error.code === 'auth/email-already-in-use') {
                setStatus({ type: 'error', message: 'Este usuário já existe no sistema Auth.' });
            } else {
                setStatus({ type: 'error', message: 'Erro: ' + error.message });
            }
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 font-sans">
            <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl text-center">
                <div className="flex justify-center mb-6">
                    <div className="p-4 bg-emerald-500/10 rounded-full">
                        <ShieldCheck size={48} className="text-emerald-500" />
                    </div>
                </div>

                <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Setup Admin Inicial</h1>
                <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm">Crie o primeiro acesso administrativo ao seu sistema de estoque.</p>

                <div className="bg-slate-100/50 dark:bg-slate-800/50 rounded-2xl p-6 mb-8 text-left border border-slate-300 dark:border-slate-700">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-2">Informações</p>
                    <p className="text-slate-900 dark:text-white text-sm font-mono truncate">E-mail: fabioxavier@hotmail.com</p>
                    <p className="text-slate-900 dark:text-white text-sm font-mono mt-1">Senha: admin1234</p>
                </div>

                {status.type === 'error' && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-left">
                        <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                        <p className="text-red-400 text-sm">{status.message}</p>
                    </div>
                )}

                {status.type === 'success' && (
                    <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3 text-left animate-in fade-in zoom-in duration-300">
                        <ShieldCheck size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                        <p className="text-emerald-400 text-sm">{status.message}</p>
                    </div>
                )}

                <button
                    onClick={handleCreateAdmin}
                    disabled={status.type === 'loading' || status.type === 'success'}
                    className={`w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 ${status.type === 'success'
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-default'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/20 active:scale-95'
                        }`}
                >
                    {status.type === 'loading' ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                        <UserPlus size={20} />
                    )}
                    {status.type === 'success' ? 'Conta Criada' : 'Criar Conta Admin'}
                </button>

                <a
                    href="/login"
                    className="inline-block mt-6 text-slate-500 hover:text-slate-900 dark:text-white text-sm font-medium transition-colors"
                >
                    Ir para o Login
                </a>
            </div>
        </div>
    );
};

export default SetupAdmin;
