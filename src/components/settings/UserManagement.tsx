import { useState, useEffect } from 'react';
import { UserPlus, ShieldCheck, UserCheck, Check, X, Loader2, Trash2, Mail, Users, Ban, LockKeyhole, Edit3, Crown } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, setDoc, getDoc } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import toast from 'react-hot-toast';
import { db, auth } from '../../db/firebase';

interface PendingUser {
    id: string;
    email: string;
    createdAt: string;
}

interface UserPermissions {
    inventory: boolean;
    tested: boolean;
    delivery: boolean;
}

interface ActiveUser {
    id: string;
    email: string;
    role: string;
    status: 'active' | 'blocked';
    permissions?: UserPermissions;
    createdAt: string;
}

export const UserManagement = ({ initialAllowReg }: { initialAllowReg: boolean }) => {
    const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
    const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
    const [allowRegistration, setAllowRegistration] = useState(initialAllowReg);
    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const [showUserDeleteConfirm, setShowUserDeleteConfirm] = useState(false);
    const [userIdToDelete, setUserIdToDelete] = useState<string | null>(null);
    const [deleteType, setDeleteType] = useState<'pending' | 'active'>('pending');

    // Controles de Permissão
    const [selectedUserForPermissions, setSelectedUserForPermissions] = useState<ActiveUser | null>(null);
    const [tempPermissions, setTempPermissions] = useState<UserPermissions>({ inventory: true, tested: true, delivery: true });

    useEffect(() => {
        const qPending = query(collection(db, 'users'), where('approved', '==', false));
        const unsubscribePending = onSnapshot(qPending, (snapshot) => {
            const users = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as PendingUser[];
            setPendingUsers(users);
        });

        const qActive = query(collection(db, 'users'), where('approved', '==', true));
        const unsubscribeActive = onSnapshot(qActive, (snapshot) => {
            const users = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ActiveUser[];
            setActiveUsers(users);
        });

        const loadSettings = async () => {
            const settingsDoc = await getDoc(doc(db, 'settings', 'auth'));
            if (settingsDoc.exists()) {
                setAllowRegistration(settingsDoc.data().allowRegistration !== false);
            }
        };
        loadSettings();

        return () => {
            unsubscribePending();
            unsubscribeActive();
        };
    }, []);

    const handleToggleRegistration = async () => {
        const newValue = !allowRegistration;
        setAllowRegistration(newValue);
        try {
            await setDoc(doc(db, 'settings', 'auth'), { allowRegistration: newValue }, { merge: true });
        } catch (error) {
            console.error('Erro ao atualizar configuração:', error);
            setAllowRegistration(!newValue);
        }
    };

    const handleApprove = async (userId: string) => {
        setLoadingAction(userId);
        try {
            await updateDoc(doc(db, 'users', userId), { approved: true });
        } catch (error) {
            console.error('Erro ao aprovar usuário:', error);
        } finally {
            setLoadingAction(null);
        }
    };

    const handleReject = async (userId: string, type: 'pending' | 'active' = 'pending') => {
        setDeleteType(type);
        setUserIdToDelete(userId);
        setShowUserDeleteConfirm(true);
    };

    const confirmRejectUser = async () => {
        if (!userIdToDelete) return;
        setLoadingAction(userIdToDelete);
        try {
            await deleteDoc(doc(db, 'users', userIdToDelete));
            setShowUserDeleteConfirm(false);
            setUserIdToDelete(null);
        } catch (error) {
            console.error('Erro ao excluir usuário:', error);
        } finally {
            setLoadingAction(null);
        }
    };

    const handleToggleStatus = async (user: ActiveUser) => {
        if (user.role === 'admin') {
            toast.error('Não é possível bloquear um administrador.');
            return;
        }

        const newStatus = user.status === 'blocked' ? 'active' : 'blocked';
        setLoadingAction(user.id + '-status');
        try {
            await updateDoc(doc(db, 'users', user.id), { status: newStatus });
            toast.success(`Usuário ${newStatus === 'blocked' ? 'bloqueado' : 'desbloqueado'} com sucesso!`);
        } catch (error) {
            console.error('Erro ao atualizar status:', error);
            toast.error('Erro ao atualizar status do usuário.');
        } finally {
            setLoadingAction(null);
        }
    };

    const handleToggleRole = async (user: ActiveUser) => {
        if (user.id === auth.currentUser?.uid) {
            toast.error('Você não pode alterar seu próprio nível de acesso.');
            return;
        }

        const newRole = user.role === 'admin' ? 'user' : 'admin';
        setLoadingAction(user.id + '-role');
        try {
            await updateDoc(doc(db, 'users', user.id), { role: newRole });
            toast.success(`Usuário agora é ${newRole === 'admin' ? 'Administrador' : 'Padrão'}.`);
        } catch (error) {
            console.error('Erro ao atualizar papel:', error);
            toast.error('Erro ao alterar nível de acesso.');
        } finally {
            setLoadingAction(null);
        }
    };

    const handleSendResetEmail = async (email: string, id: string) => {
        setLoadingAction(id + '-email');
        try {
            await sendPasswordResetEmail(auth, email);
            toast.success('E-mail de redefinição enviado com sucesso!');
        } catch (error) {
            console.error('Erro ao enviar email reset:', error);
            toast.error('Erro ao enviar e-mail de redefinição.');
        } finally {
            setLoadingAction(null);
        }
    };

    const openPermissionsModal = (user: ActiveUser) => {
        if (user.role === 'admin') {
            toast('Administradores possuem acesso total por padrão.', { icon: 'ℹ️' });
            return;
        }
        setSelectedUserForPermissions(user);
        setTempPermissions(user.permissions || { inventory: true, tested: true, delivery: true });
    };

    const savePermissions = async () => {
        if (!selectedUserForPermissions) return;
        setLoadingAction(selectedUserForPermissions.id + '-perms');
        try {
            await updateDoc(doc(db, 'users', selectedUserForPermissions.id), { permissions: tempPermissions });
            toast.success('Permissões salvas com sucesso!');
            setSelectedUserForPermissions(null);
        } catch (error) {
            console.error('Erro ao salvar permissões:', error);
            toast.error('Erro ao salvar permissões.');
        } finally {
            setLoadingAction(null);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Toggle de Registro */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500">
                        <UserPlus size={24} />
                    </div>
                    <div>
                        <h3 className="text-slate-900 dark:text-white font-bold text-lg">Novos Cadastros</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Permitir que novos usuários se cadastrem na tela de login</p>
                    </div>
                </div>
                <button
                    onClick={handleToggleRegistration}
                    className={`w-14 h-8 rounded-full p-1 transition-all duration-300 flex items-center ${allowRegistration ? 'bg-blue-600 justify-end' : 'bg-slate-100 dark:bg-slate-800 justify-start'}`}
                >
                    <div className="w-6 h-6 bg-white rounded-full shadow-md" />
                </button>
            </div>

            {/* Lista de Espera */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="text-slate-900 dark:text-white font-bold text-lg flex items-center gap-2">
                        <ShieldCheck size={20} className="text-amber-500" />
                        Aprovações Pendentes
                    </h3>
                    <span className="bg-amber-500/20 text-amber-500 px-3 py-1 rounded-full text-xs font-bold uppercase">{pendingUsers.length} Aguardando</span>
                </div>
                <div className="divide-y divide-slate-800">
                    {pendingUsers.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-500">
                                <UserCheck size={32} />
                            </div>
                            <p className="text-slate-500 font-medium">Nenhum usuário aguardando aprovação.</p>
                        </div>
                    ) : (
                        pendingUsers.map((u: PendingUser) => (
                            <div key={u.id} className="p-6 flex items-center justify-between hover:bg-slate-100/20 dark:bg-slate-800/20 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold">
                                        {u.email.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-slate-900 dark:text-white font-bold">{u.email}</p>
                                        <p className="text-slate-500 text-xs">Cadastrado em {new Date(u.createdAt).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleApprove(u.id)}
                                        disabled={loadingAction === u.id}
                                        className="p-2 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-xl transition-all border border-emerald-500/20 disabled:opacity-50"
                                        title="Aprovar"
                                    >
                                        {loadingAction === u.id ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                                    </button>
                                    <button
                                        onClick={() => handleReject(u.id)}
                                        disabled={loadingAction === u.id}
                                        className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all border border-red-500/20 disabled:opacity-50"
                                        title="Recusar"
                                    >
                                        {loadingAction === u.id ? <Loader2 size={20} className="animate-spin" /> : <X size={20} />}
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Usuários Ativos (RBAC) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <h3 className="text-slate-900 dark:text-white font-bold text-lg flex items-center gap-2">
                        <Users size={20} className="text-blue-500" />
                        Usuários Ativos
                    </h3>
                    <span className="bg-blue-500/10 text-blue-500 px-3 py-1 rounded-full text-xs font-bold uppercase">{activeUsers.length} Ativos</span>
                </div>
                <div className="divide-y divide-slate-800">
                    {activeUsers.length === 0 ? (
                        <div className="p-12 text-center text-slate-500">
                            Nenhum usuário ativo encontrado.
                        </div>
                    ) : (
                        activeUsers.map((u) => (
                            <div key={u.id} className={`p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${u.status === 'blocked' ? 'bg-red-500/5 dark:bg-red-500/5' : 'hover:bg-slate-100/20 dark:bg-slate-800/20'}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white shadow-sm ${u.status === 'blocked' ? 'bg-red-400 dark:bg-red-500/50' : 'bg-slate-800 dark:bg-slate-700'}`}>
                                        {u.email.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className={`font-bold ${u.status === 'blocked' ? 'text-red-600 dark:text-red-400 strikethrough' : 'text-slate-900 dark:text-white'}`}>{u.email}</p>
                                            {u.role === 'admin' && <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded-full uppercase font-bold tracking-wider shadow-sm">Admin</span>}
                                            {u.status === 'blocked' && <span className="text-[10px] bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">Bloqueado</span>}
                                        </div>
                                        <p className="text-slate-500 text-xs">Criação: {new Date(u.createdAt).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                    {/* Toggle Role (Admin/User) */}
                                    <button
                                        onClick={() => handleToggleRole(u)}
                                        disabled={loadingAction === u.id + '-role'}
                                        className={`p-2 rounded-xl transition-all border disabled:opacity-50 ${u.role === 'admin'
                                            ? 'bg-amber-500/10 hover:bg-amber-500 text-amber-600 dark:text-amber-400 hover:text-white border-amber-500/20'
                                            : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white border-slate-200 dark:border-slate-700'
                                            }`}
                                        title={u.role === 'admin' ? 'Remover privilégios de Administrador' : 'Tornar Administrador'}
                                    >
                                        {loadingAction === u.id + '-role' ? <Loader2 size={18} className="animate-spin" /> : <Crown size={18} />}
                                    </button>

                                    {/* Edit Permissions */}
                                    <button
                                        onClick={() => openPermissionsModal(u)}
                                        disabled={u.role === 'admin'}
                                        className="p-2 bg-blue-500/10 hover:bg-blue-500 text-blue-600 dark:text-blue-400 hover:text-white rounded-xl transition-all border border-blue-500/20 disabled:opacity-30 disabled:hover:bg-blue-500/10 disabled:hover:text-blue-600 dark:disabled:hover:text-blue-400"
                                        title="Editar Permissões"
                                    >
                                        <Edit3 size={18} />
                                    </button>

                                    {/* Send Pass Reset */}
                                    <button
                                        onClick={() => handleSendResetEmail(u.email, u.id)}
                                        disabled={loadingAction === u.id + '-email'}
                                        className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition-all border border-slate-200 dark:border-slate-700 disabled:opacity-50"
                                        title="Enviar link de reset de senha"
                                    >
                                        {loadingAction === u.id + '-email' ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
                                    </button>

                                    {/* Block/Unblock */}
                                    <button
                                        onClick={() => handleToggleStatus(u)}
                                        disabled={u.role === 'admin' || loadingAction === u.id + '-status'}
                                        className={`p-2 rounded-xl transition-all border disabled:opacity-30 ${u.status === 'blocked'
                                            ? 'bg-emerald-500/10 hover:bg-emerald-500 text-emerald-600 dark:text-emerald-400 hover:text-white border-emerald-500/20'
                                            : 'bg-amber-500/10 hover:bg-amber-500 text-amber-600 dark:text-amber-400 hover:text-white border-amber-500/20'
                                            }`}
                                        title={u.status === 'blocked' ? 'Desbloquear Conta' : 'Bloquear Conta'}
                                    >
                                        {loadingAction === u.id + '-status' ? <Loader2 size={18} className="animate-spin" /> : (
                                            u.status === 'blocked' ? <Check size={18} /> : <Ban size={18} />
                                        )}
                                    </button>

                                    {/* Delete User */}
                                    <button
                                        onClick={() => handleReject(u.id, 'active')}
                                        disabled={u.role === 'admin' && activeUsers.filter(a => a.role === 'admin').length <= 1}
                                        className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all border border-red-500/20 disabled:opacity-30"
                                        title="Excluir Usuário"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Modal de Rejeição / Exclusão de Usuário */}
            {showUserDeleteConfirm && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Trash2 size={32} />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                                {deleteType === 'pending' ? 'Rejeitar Acesso?' : 'Excluir Usuário?'}
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
                                {deleteType === 'pending'
                                    ? 'Tem certeza que deseja excluir permanentemente este pedido de acesso?'
                                    : 'Atenção: Ao excluir o documento do usuário, ele perderá acesso ao sistema (via bloqueio de sessão) imediatamente.'}
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowUserDeleteConfirm(false);
                                        setUserIdToDelete(null);
                                    }}
                                    className="flex-1 py-3 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white font-semibold transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmRejectUser}
                                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg active:scale-95"
                                >
                                    Excluir
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Permissões */}
            {selectedUserForPermissions && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-blue-500/5">
                            <h3 className="text-slate-900 dark:text-white font-bold text-lg flex items-center gap-2">
                                <LockKeyhole size={20} className="text-blue-500" />
                                Permissões de Acesso
                            </h3>
                            <button onClick={() => setSelectedUserForPermissions(null)} className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-full transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">Editando permissões para:</p>
                                <p className="font-bold text-slate-900 dark:text-white">{selectedUserForPermissions.email}</p>
                            </div>

                            <div className="space-y-4">
                                <label className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl cursor-pointer hover:border-blue-500/50 transition-colors group">
                                    <div>
                                        <p className="font-bold text-slate-900 dark:text-white">Inventário</p>
                                        <p className="text-xs text-slate-500">Acesso à gestão de Inventários</p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        checked={tempPermissions.inventory}
                                        onChange={(e) => setTempPermissions({ ...tempPermissions, inventory: e.target.checked })}
                                    />
                                </label>

                                <label className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl cursor-pointer hover:border-blue-500/50 transition-colors group">
                                    <div>
                                        <p className="font-bold text-slate-900 dark:text-white">Itens Testados</p>
                                        <p className="text-xs text-slate-500">Acesso aos relatórios de Testes</p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        checked={tempPermissions.tested}
                                        onChange={(e) => setTempPermissions({ ...tempPermissions, tested: e.target.checked })}
                                    />
                                </label>

                                <label className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl cursor-pointer hover:border-blue-500/50 transition-colors group">
                                    <div>
                                        <p className="font-bold text-slate-900 dark:text-white">Entregas Rápidas</p>
                                        <p className="text-xs text-slate-500">Acesso a relatórios de Entrega</p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        checked={tempPermissions.delivery}
                                        onChange={(e) => setTempPermissions({ ...tempPermissions, delivery: e.target.checked })}
                                    />
                                </label>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    onClick={() => setSelectedUserForPermissions(null)}
                                    className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={savePermissions}
                                    disabled={loadingAction === selectedUserForPermissions.id + '-perms'}
                                    className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    {loadingAction === selectedUserForPermissions.id + '-perms' ? <Loader2 size={20} className="animate-spin" /> : 'Salvar Alterações'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
