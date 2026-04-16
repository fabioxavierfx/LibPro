import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, User, Shield, Bell, Info, Database as DatabaseIcon, Sliders, Tags, Package, Layers, X, Check, MapPin } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../db/firebase';
import { useTheme } from '../contexts/ThemeContext';

import { UserManagement } from '../components/settings/UserManagement';
import { CategorySettings } from '../components/settings/CategorySettings';
import { ConservationSettings } from '../components/settings/ConservationSettings';
import { TypeSettings } from '../components/settings/TypeSettings';
import { LocationSettings } from '../components/settings/LocationSettings';
import { DatabaseTools } from '../components/settings/DatabaseTools';



interface GeneralSettings {
    disableDecimals: boolean;
    autoGenerateSku?: boolean;
    skuPrefix?: string;
    skuSuffix?: string;
    googleApiKey?: string;
}

const Configuracoes = () => {
    const { user, isAdmin, allowRegistration } = useAuth();
    const { theme, setTheme } = useTheme();
    const [activeTab, setActiveTab] = useState('Geral');
    const [cadastrosTab, setCadastrosTab] = useState('Categorias');



    const [generalOptions, setGeneralOptions] = useState<GeneralSettings>({
        disableDecimals: false,
        autoGenerateSku: false,
        skuPrefix: '',
        skuSuffix: '',
        googleApiKey: ''
    });

    const [showApiKeyInfo, setShowApiKeyInfo] = useState(false);
    const [tempApiKey, setTempApiKey] = useState('');
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        if (user) {

            const loadGeneralOptions = async () => {
                const optionsDoc = await getDoc(doc(db, 'users', user.uid, 'settings', 'general'));
                if (optionsDoc.exists()) {
                    const data = optionsDoc.data() as GeneralSettings;
                    setGeneralOptions(prev => ({ ...prev, ...data }));
                    if (data.googleApiKey) setTempApiKey(data.googleApiKey);
                }
            };

            loadGeneralOptions();
        }
    }, [user]);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);



    const updateGeneralOption = async (key: string, value: any) => {
        if (!user) return;
        const newOptions = { ...generalOptions, [key]: value };
        setGeneralOptions(newOptions);
        try {
            await setDoc(doc(db, 'users', user.uid, 'settings', 'general'), newOptions, { merge: true });
            setToast({ message: 'Opções salvas com sucesso!', type: 'success' });
        } catch (error) {
            console.error('Erro ao salvar opções:', error);
        }
    };

    const sections = [
        { id: 'Geral', title: 'Conta', icon: User, description: 'Gerencie suas informações de perfil e senha' },
        { id: 'Opções', title: 'Opções', icon: Sliders, description: 'Configure o comportamento de campos e regras do sistema' },
        { id: 'Notificações', title: 'Notificações', icon: Bell, description: 'Configure alertas de estoque baixo e novos relatórios' },
        { id: 'Cadastros', title: 'Cadastros', icon: Layers, description: 'Gerencie Categorias, Conservação e Tipos de Registro' },
        { id: 'Database', title: 'Banco de Dados', icon: DatabaseIcon, description: 'Exportar dados, limpar cache e backups', adminOnly: true },
        { id: 'Acessos', title: 'Segurança e Acessos', icon: Shield, description: 'Gerenciar permissões e novos cadastros', adminOnly: true },
        { id: 'Sobre', title: 'Sobre o Sistema', icon: Info, description: 'Versão 3.0.0 - LibProV3.0' },
    ];

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto font-sans">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <SettingsIcon size={32} className="text-blue-500" />
                    Configurações
                </h1>
                <p className="text-slate-500 dark:text-slate-400">Personalize sua experiência e gerencie o sistema</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Sidebar de Abas */}
                <div className="lg:col-span-1 space-y-2">
                    {sections.map((section) => (
                        (!section.adminOnly || isAdmin) && (
                            <button
                                key={section.id}
                                onClick={() => setActiveTab(section.id)}
                                className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left group ${activeTab === section.id
                                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100/50 dark:bg-slate-800/50 hover:border-slate-300 dark:border-slate-700'
                                    }`}
                            >
                                <section.icon size={22} className={activeTab === section.id ? 'text-white' : 'group-hover:text-blue-400'} />
                                <span className={`font-bold ${activeTab === section.id ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>{section.title}</span>
                            </button>
                        )
                    ))}
                </div>

                {/* Conteúdo da Aba */}
                <div className="lg:col-span-3 space-y-6">
                    {activeTab === 'Geral' && (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex items-center gap-6 mb-8">
                                <div className="w-24 h-24 bg-blue-600 rounded-2xl flex items-center justify-center text-4xl font-bold text-white uppercase shadow-xl rotate-3 transform transition-transform hover:rotate-0">
                                    {user?.email?.charAt(0)}
                                </div>
                                <div>
                                    <p className="text-slate-900 dark:text-white font-bold text-2xl tracking-tight">{user?.email}</p>
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase mt-2 ${isAdmin ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                        <Shield size={12} />
                                        {isAdmin ? 'Administrador' : 'Usuário Padrão'}
                                    </span>
                                </div>
                            </div>
                            <div className="grid gap-4 max-w-md">
                                <div className="p-4 bg-slate-100/30 dark:bg-slate-800/30 border border-slate-300 dark:border-slate-700 rounded-2xl mb-2">
                                    <h3 className="text-slate-900 dark:text-white font-bold mb-3 flex items-center gap-2">
                                        Tema do Sistema
                                    </h3>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button onClick={() => setTheme('light')} className={`py-2 rounded-xl text-sm font-bold border transition-all ${theme === 'light' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-white hover:bg-slate-200 dark:bg-slate-700'}`}>Claro</button>
                                        <button onClick={() => setTheme('dark')} className={`py-2 rounded-xl text-sm font-bold border transition-all ${theme === 'dark' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-white hover:bg-slate-200 dark:bg-slate-700'}`}>Escuro</button>
                                        <button onClick={() => setTheme('system')} className={`py-2 rounded-xl text-sm font-bold border transition-all ${theme === 'system' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-white hover:bg-slate-200 dark:bg-slate-700'}`}>Sistema</button>
                                    </div>
                                </div>
                                <button className="w-full py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl font-bold transition-all border border-slate-300 dark:border-slate-700">Alterar Senha</button>
                                <button
                                    onClick={() => auth.signOut()}
                                    className="w-full py-3.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl font-bold transition-all border border-red-500/20"
                                >
                                    Sair da Conta
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'Opções' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                                    <Sliders className="text-blue-500" size={24} />
                                    Opções do Sistema
                                </h2>
                                <div className="space-y-8">
                                    {/* Auto-Generate SKU */}
                                    <div className="flex flex-col gap-4 p-4 bg-slate-100/30 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-800">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                                                    <Package size={20} />
                                                </div>
                                                <div>
                                                    <h3 className="text-slate-900 dark:text-white font-bold">Gerar SKU Automaticamente</h3>
                                                    <p className="text-slate-500 dark:text-slate-400 text-sm">Criar códigos únicos aleatórios ao cadastrar novos produtos</p>
                                                </div>
                                            </div>
                                            <div
                                                onClick={() => updateGeneralOption('autoGenerateSku', !generalOptions.autoGenerateSku)}
                                                className={`w-12 h-6 rounded-full p-1 transition-all duration-300 flex items-center cursor-pointer shrink-0 ${generalOptions.autoGenerateSku ? 'bg-blue-600 justify-end' : 'bg-slate-200 dark:bg-slate-700 justify-start'}`}
                                            >
                                                <div className="w-4 h-4 bg-white rounded-full shadow-md" />
                                            </div>
                                        </div>

                                        {generalOptions.autoGenerateSku && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 animate-in slide-in-from-top-2 duration-200">
                                                <div>
                                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Prefixo</label>
                                                    <input
                                                        type="text"
                                                        value={generalOptions.skuPrefix || ''}
                                                        onChange={(e) => updateGeneralOption('skuPrefix', e.target.value.toUpperCase())}
                                                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 mt-1 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                        placeholder="Ex: LIV-"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">Sufixo</label>
                                                    <input
                                                        type="text"
                                                        value={generalOptions.skuSuffix || ''}
                                                        onChange={(e) => updateGeneralOption('skuSuffix', e.target.value.toUpperCase())}
                                                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 mt-1 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                        placeholder="Ex: -BR"
                                                    />
                                                </div>
                                                <div className="col-span-1 md:col-span-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                                                    <p className="text-sm text-slate-500">
                                                        Exemplo final: <span className="font-bold font-mono text-slate-700 dark:text-slate-300 ml-1 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded">{generalOptions.skuPrefix || ''}123456{generalOptions.skuSuffix || ''}</span>
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Google API Key */}
                                    <div className="flex flex-col gap-4 p-4 bg-slate-100/30 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-slate-800">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500">
                                                <DatabaseIcon size={20} />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-slate-900 dark:text-white font-bold">Google Books API Key</h3>
                                                <button 
                                                    onClick={() => setShowApiKeyInfo(true)}
                                                    className="text-slate-400 hover:text-blue-500 transition-colors"
                                                    title="Como criar uma chave?"
                                                >
                                                    <Info size={16} />
                                                </button>
                                            </div>
                                            <p className="text-slate-500 dark:text-slate-400 text-sm">Chave opcional para evitar limites na busca de ISBN (429)</p>
                                        </div>
                                        <div className="mt-2 flex gap-2">
                                            <input
                                                type="password"
                                                value={tempApiKey}
                                                onChange={(e) => setTempApiKey(e.target.value)}
                                                className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-sm transition-all"
                                                placeholder="Insira sua API Key do Google Cloud Console"
                                            />
                                            <button 
                                                onClick={() => updateGeneralOption('googleApiKey', tempApiKey)}
                                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm transition-all shadow-md active:scale-95"
                                            >
                                                Salvar
                                            </button>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">Sua chave é salva apenas nas suas configurações pessoais.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'Notificações' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                                    <Bell className="text-blue-500" size={24} />
                                    Alertas do Sistema
                                </h2>

                                <div className="p-12 text-center text-slate-500 dark:text-slate-400 animate-in fade-in duration-500 border border-slate-200 dark:border-slate-800/50 rounded-2xl bg-slate-50/50 dark:bg-slate-800/20">
                                    <div className="w-16 h-16 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Bell size={28} />
                                    </div>
                                    <h3 className="text-lg font-bold mb-2 text-slate-900 dark:text-white">Recurso em Desenvolvimento</h3>
                                    <p>O painel de notificações será integrado em futuras atualizações para trazer a melhor experiência.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'Cadastros' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="flex bg-slate-200/60 dark:bg-slate-800/50 p-1.5 rounded-2xl relative mb-8 isolate overflow-hidden shadow-inner">
                                {/* Sliding Background Indicator */}
                                <div 
                                    className="absolute inset-y-1.5 w-[calc(25%-4px)] bg-white dark:bg-slate-700 shadow-md rounded-xl transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-0 border border-slate-100 dark:border-slate-600"
                                    style={{ 
                                        left: '6px',
                                        transform: `translateX(calc(${['Categorias', 'Local', 'Conservação', 'Tipo'].indexOf(cadastrosTab) * 100}% + ${['Categorias', 'Local', 'Conservação', 'Tipo'].indexOf(cadastrosTab) * 6}px))` 
                                    }}
                                />
                                
                                {[
                                    { id: 'Categorias', label: 'Categorias', icon: Tags },
                                    { id: 'Local', label: 'ID Local', icon: MapPin },
                                    { id: 'Conservação', label: 'Conservação', icon: Package },
                                    { id: 'Tipo', label: 'Tipos', icon: Layers }
                                ].map((tab) => {
                                    const isActive = cadastrosTab === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => setCadastrosTab(tab.id)}
                                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-2 font-bold text-sm rounded-xl transition-colors duration-300 relative z-10 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                                        >
                                            <tab.icon size={18} className={`transition-all duration-500 ${isActive ? 'scale-110 opacity-100' : 'opacity-70 scale-100 group-hover:opacity-100'}`} />
                                            {tab.label}
                                        </button>
                                    );
                                })}
                            </div>
                            
                            <div className="mt-2 min-h-[400px]">
                                {cadastrosTab === 'Categorias' && (
                                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <CategorySettings />
                                    </div>
                                )}
                                {cadastrosTab === 'Local' && (
                                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <LocationSettings />
                                    </div>
                                )}
                                {cadastrosTab === 'Conservação' && (
                                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <ConservationSettings />
                                    </div>
                                )}
                                {cadastrosTab === 'Tipo' && (
                                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <TypeSettings />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'Acessos' && isAdmin && (
                        <UserManagement initialAllowReg={allowRegistration} />
                    )}

                    {activeTab === 'Database' && isAdmin && (
                        <DatabaseTools />
                    )}

                    {activeTab === 'Sobre' && (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center animate-in fade-in slide-in-from-right-4 duration-300">
                            <Info size={48} className="text-blue-500 mx-auto mb-4 opacity-20" />
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">LibProV3.0</h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-6 font-medium">Versão 1.1.0 (PRO)</p>
                            <div className="max-w-md mx-auto space-y-4">
                                <div className="p-4 bg-slate-100/50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 text-left text-sm text-slate-500 dark:text-slate-400">
                                    Sistema avançado de gestão de estoque e auditoria desenvolvido com React e Firebase.
                                </div>
                                <div className="space-y-1">
                                    <p className="text-xs text-slate-500 italic">© 2026 Todos os direitos reservados.</p>
                                    <p className="text-xs text-slate-500 italic">Idealizado e desenvolvido por Fabio Xavier</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {/* Modal de Ajuda da API Key */}
            {showApiKeyInfo && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 max-w-lg w-full shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                                    <Info size={24} />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Como criar sua API Key?</h3>
                            </div>
                            <button onClick={() => setShowApiKeyInfo(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4 text-slate-600 dark:text-slate-400">
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-full flex items-center justify-center font-bold text-slate-900 dark:text-white">1</div>
                                <p>Acesse o <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">Google Cloud Console</a> e crie um novo projeto.</p>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-full flex items-center justify-center font-bold text-slate-900 dark:text-white">2</div>
                                <p>No menu Lateral, vá em APIs e Serviços &gt; Biblioteca e procure por "Google Books API" e clique em Ativar.</p>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-full flex items-center justify-center font-bold text-slate-900 dark:text-white">3</div>
                                <p>Vá em APIs e Serviços &gt; Credenciais, clique em "+ Criar Credenciais" e escolha "Chave de API".</p>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-full flex items-center justify-center font-bold text-slate-900 dark:text-white">4</div>
                                <p>Copie a chave gerada e cole no campo de configuração do LibPro.</p>
                            </div>
                        </div>

                        <button 
                            onClick={() => setShowApiKeyInfo(false)}
                            className="w-full mt-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20"
                        >
                            Entendi
                        </button>
                    </div>
                </div>
            )}
            {/* Toast de Confirmação */}
            {toast && (
                <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className={`flex items-center gap-3 px-6 py-3 rounded-2xl border shadow-2xl backdrop-blur-md ${
                        toast.type === 'success' 
                        ? 'bg-blue-600/90 border-blue-500 text-white shadow-blue-500/20' 
                        : 'bg-red-600/90 border-red-500 text-white shadow-red-500/20'
                    }`}>
                        <div className="bg-white/20 p-1 rounded-full">
                            {toast.type === 'success' ? <Check size={14} /> : <X size={14} />}
                        </div>
                        <span className="font-bold tracking-tight">{toast.message}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Configuracoes;
