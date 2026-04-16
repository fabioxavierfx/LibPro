import { useState, useEffect } from 'react';
import {
    collection,
    onSnapshot,
    query,
    orderBy,
    limit,
    where
} from 'firebase/firestore';
import { db } from '../db/firebase';
import {
    Package,
    ClipboardList,
    Truck,
    TrendingUp,
    Activity,
    CheckCircle
} from 'lucide-react';
import { useProducts } from '../contexts/ProductsContext';

const Dashboard = () => {
    const { products } = useProducts();
    const [stats, setStats] = useState({
        products: 0,
        inventories: 0,
        tested: 0,
        deliveries: 0
    });

    const [recentReports, setRecentReports] = useState<any[]>([]);

    useEffect(() => {
        // Query param para Relatórios Recentes
        const qReports = query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(5));
        const unsubReports = onSnapshot(qReports, (s) => {
            const reps = s.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
            setRecentReports(reps);
        });

        // Query param para Estatísticas dos Últimos 30 Dias
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const qStats = query(
            collection(db, 'reports'),
            where('createdAt', '>=', thirtyDaysAgo)
        );

        const unsubStats = onSnapshot(qStats, (s) => {
            let inventories = 0;
            let tested = 0;
            let deliveries = 0;

            s.docs.forEach(doc => {
                const data = doc.data() as any;
                const type = data.type;
                if (type === 'inventory') inventories++;
                else if (type === 'tested') tested++;
                else if (type === 'delivery') deliveries++;
            });

            setStats(prev => ({ ...prev, inventories, tested, deliveries }));
        });

        return () => {
            unsubReports();
            unsubStats();
        };
    }, []);

    const cards = [
        { title: 'Total de Produtos', value: products.length, icon: Package, color: 'text-blue-500', bg: 'bg-gradient-to-br from-blue-500/20 to-blue-600/5' },
        { title: 'Inventários (30d)', value: stats.inventories, icon: ClipboardList, color: 'text-emerald-500', bg: 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/5' },
        { title: 'Testados (30d)', value: stats.tested, icon: CheckCircle, color: 'text-sky-500', bg: 'bg-gradient-to-br from-sky-500/20 to-sky-600/5' },
        { title: 'Entregas (30d)', value: stats.deliveries, icon: Truck, color: 'text-purple-500', bg: 'bg-gradient-to-br from-purple-500/20 to-purple-600/5' },
    ];

    return (
        <div className="p-4 md:p-8 max-w-full mx-auto relative overflow-hidden">
            {/* Elemento de iluminação de fundo suave para aspecto "premium" */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] -z-10 pointer-events-none"></div>
            <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] -z-10 pointer-events-none"></div>

            <div className="mb-10">
                <h1 className="text-3xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 dark:from-white dark:via-slate-300 dark:to-white tracking-tight">
                    Dashboard
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Resumo dinâmico e inteligente das operações</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                {cards.map((card, idx) => (
                    <div 
                        key={idx} 
                        className="group bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/50 dark:border-slate-800/50 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-300 ease-out"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-3.5 ${card.bg} rounded-2xl ${card.color} shadow-inner`}>
                                <card.icon size={26} strokeWidth={2.5} />
                            </div>
                            <Activity size={20} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold tracking-wide">{card.title}</p>
                        <h2 className="text-4xl font-extrabold text-slate-900 dark:text-white mt-2 font-mono tracking-tighter">
                            {card.value}
                        </h2>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/50 dark:border-slate-800/50 rounded-3xl p-6 md:p-8 shadow-xl">
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                        <span className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
                            <TrendingUp size={20} strokeWidth={3} />
                        </span>
                        <span>Relatórios Recentes</span>
                    </h2>
                    <div className="space-y-4">
                        {recentReports.map(report => (
                            <div key={report.id} className="group relative flex items-center justify-between p-5 bg-slate-50/50 hover:bg-white dark:bg-slate-800/30 dark:hover:bg-slate-800 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 transition-all duration-300 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600">
                                <div className="flex items-center gap-5">
                                    <div className={`p-3 rounded-xl transition-all duration-300 group-hover:scale-110 ${
                                        report.type === 'inventory' ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/5 text-emerald-500 border border-emerald-500/20' :
                                        report.type === 'tested' ? 'bg-gradient-to-br from-sky-500/20 to-sky-600/5 text-sky-500 border border-sky-500/20' : 
                                        'bg-gradient-to-br from-purple-500/20 to-purple-600/5 text-purple-500 border border-purple-500/20'
                                    }`}>
                                        {report.type === 'inventory' ? <ClipboardList size={22} strokeWidth={2.5} /> :
                                         report.type === 'tested' ? <CheckCircle size={22} strokeWidth={2.5} /> : 
                                         <Truck size={22} strokeWidth={2.5} />}
                                    </div>
                                    <div>
                                        <p className="text-slate-900 dark:text-white font-bold text-base capitalize tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                            {report.type === 'inventory' ? 'Inventário' : report.type === 'tested' ? 'Testado' : 'Entrega'}
                                        </p>
                                        <p className="text-xs text-slate-500 font-medium tracking-wide mt-1">
                                            {report.createdAt?.toDate?.().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) || 'Agora'}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                    <span className="inline-block px-3 py-1 bg-slate-200/50 dark:bg-slate-700/50 rounded-lg text-slate-900 dark:text-white font-extrabold font-mono">
                                        {report.totalItems}
                                    </span>
                                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold mt-1.5 ml-1">itens</span>
                                </div>
                            </div>
                        ))}
                        {recentReports.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                                <Activity size={32} className="opacity-20 mb-3" />
                                <span className="font-semibold italic">Nenhum relatório gerado recentemente.</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border border-white/50 dark:border-slate-800/50 rounded-3xl p-6 md:p-8 shadow-xl flex flex-col h-full">
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                        <span className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg">
                            <Activity size={20} strokeWidth={3} />
                        </span>
                        <span>Status do Sistema</span>
                    </h2>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-emerald-500/10 rounded-lg">
                            <span className="text-emerald-400 text-sm font-medium">Offline Ready</span>
                            <CheckCircle size={18} className="text-emerald-400" />
                        </div>
                        <div className="p-4 bg-slate-100/50 dark:bg-slate-800/50 rounded-xl text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                            Sistema pronto para uso em campo. Os dados serão sincronizados automaticamente assim que houver conexão.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
