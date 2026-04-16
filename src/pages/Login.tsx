import { useState, useEffect, type FormEvent } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, collection, query, limit, getDocs } from 'firebase/firestore';
import { auth, db } from '../db/firebase';
import { Package, UserPlus, LogIn, Mail, Lock, Loader2, ShieldAlert, Eye, EyeOff, Check } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const Login = () => {
    const navigate = useNavigate();
    const { allowRegistration } = useAuth();
    const [isRegistering, setIsRegistering] = useState(false);
    const [isFirstSetup, setIsFirstSetup] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    useEffect(() => {
        const checkFirstSetup = async () => {
            try {
                const q = query(collection(db, 'users'), limit(1));
                const snap = await getDocs(q);
                if (snap.empty) {
                    setIsFirstSetup(true);
                    setIsRegistering(true);
                } else {
                    setIsFirstSetup(false);
                }
            } catch (err) {
                console.error('Erro ao checar primeiro setup:', err);
            }
        };
        const savedEmail = localStorage.getItem('rememberedEmail');
        if (savedEmail) {
            setEmail(savedEmail);
            setRememberMe(true);
        }
        checkFirstSetup();
    }, []);

    const handleAuth = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setLoading(true);

        try {
            if (isRegistering) {
                if (password !== confirmPassword) {
                    throw new Error('As senhas não coincidem.');
                }

                // 1. Criar na Auth
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);

                // 2. Criar Perfil no Firestore (Admin se First Setup)
                await setDoc(doc(db, 'users', userCredential.user.uid), {
                    email: email,
                    role: isFirstSetup ? 'admin' : 'user',
                    approved: isFirstSetup ? true : false,
                    createdAt: new Date().toISOString()
                });

                if (isFirstSetup) {
                    setSuccess('Administrador criado com sucesso! Inicializando painel...');
                    setTimeout(() => navigate('/'), 1500);
                } else {
                    setSuccess('Cadastro realizado! Aguarde a aprovação de um administrador.');
                    setIsRegistering(false);
                    setEmail('');
                    setPassword('');
                    setConfirmPassword('');
                }
            } else {
                await signInWithEmailAndPassword(auth, email, password);
                if (rememberMe) {
                    localStorage.setItem('rememberedEmail', email);
                } else {
                    localStorage.removeItem('rememberedEmail');
                }
                navigate('/');
            }
        } catch (err: any) {
            console.error('Erro na autenticação:', err);
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
                setError('E-mail ou senha incorretos.');
            } else if (err.code === 'auth/email-already-in-use') {
                setError('Este e-mail já está em uso.');
            } else if (err.code === 'auth/weak-password') {
                setError('A senha deve ter pelo menos 6 caracteres.');
            } else if (err.code === 'auth/too-many-requests') {
                setError('Muitas tentativas falhas. Tente novamente mais tarde.');
            } else {
                setError(err.message || 'Ocorreu um erro inesperado.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 font-sans">
            <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
                <div className="flex flex-col items-center mb-8">
                    <div className="p-4 bg-blue-600/10 rounded-full mb-4">
                        <Package size={48} className="text-blue-500" />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">StockReport</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">Gestão de Inventário Inteligente</p>
                </div>

                <div className="flex bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-xl mb-8">
                    {!isFirstSetup && (
                        <button
                            onClick={() => { setIsRegistering(false); setError(''); setSuccess(''); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${!isRegistering ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:text-white'}`}
                        >
                            <LogIn size={16} /> Login
                        </button>
                    )}
                    {(allowRegistration || isFirstSetup) && (
                        <button
                            onClick={() => { setIsRegistering(true); setError(''); setSuccess(''); }}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${isRegistering ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:text-white'}`}
                        >
                            {isFirstSetup ? <ShieldAlert size={16} /> : <UserPlus size={16} />} 
                            {isFirstSetup ? 'Setup Administrativo' : 'Cadastro'}
                        </button>
                    )}
                </div>

                <form onSubmit={handleAuth} className="space-y-5">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">E-mail</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input
                                id="email"
                                name="email"
                                type="email"
                                value={email}
                                autoComplete="username email"
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-12 pr-4 py-3.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-600"
                                placeholder="seu@email.com"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Senha</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input
                                id="password"
                                name="password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                autoComplete={isRegistering ? "new-password" : "current-password"}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-12 pr-12 py-3.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-600"
                                placeholder="••••••••"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500 transition-colors"
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    </div>

                    {isRegistering && (
                        <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                            <label className="text-xs font-bold text-slate-500 uppercase ml-1">Confirmar Senha</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                <input
                                    id="confirm-password"
                                    name="confirm-password"
                                    type={showConfirmPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    autoComplete="new-password"
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full pl-12 pr-12 py-3.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-600"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500 transition-colors"
                                >
                                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>
                    )}

                    {!isRegistering && (
                        <div className="flex items-center justify-between px-1">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="sr-only"
                                    />
                                    <div className={`w-5 h-5 rounded-md border-2 transition-all ${rememberMe ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-700 bg-transparent'}`}>
                                        {rememberMe && <Check className="text-white w-full h-full p-0.5" />}
                                    </div>
                                </div>
                                <span className="text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-blue-500 transition-colors">Lembrar meu acesso</span>
                            </label>
                        </div>
                    )}

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm animate-shake">
                            <Package size={16} className="shrink-0" />
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3 text-emerald-400 text-sm">
                            <Package size={16} className="shrink-0" />
                            {success}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            isRegistering ? 'Criar Conta' : 'Entrar'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
