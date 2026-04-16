import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Book,
    ClipboardList,
    Settings,
    LogOut,
    ChevronRight,
    Menu,
    X,
    Pin,
    PinOff
} from 'lucide-react';
import { auth } from '../db/firebase';
import { useAuth } from '../hooks/useAuth';

const Sidebar = () => {
    const location = useLocation();
    const [isOpen, setIsOpen] = useState(false);
    const [isPinned, setIsPinned] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const { isAdmin, permissions } = useAuth();

    const isExpanded = isPinned || isHovered;

    const menuItems = [
        { name: 'Dashboard', path: '/', icon: LayoutDashboard },
        { name: 'Títulos', path: '/produtos', icon: Book },
        ...(isAdmin || permissions?.inventory ? [{ name: 'Picking List', path: '/inventario', icon: ClipboardList }] : []),
        { name: 'Configurações', path: '/configuracoes', icon: Settings },
    ];

    return (
        <>
            {/* Overlay para mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <button
                className="fixed top-4 right-4 z-50 p-2 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-md lg:hidden shadow-lg border border-slate-300 dark:border-slate-700"
                onClick={() => setIsOpen(!isOpen)}
            >
                {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            <div
                className={`fixed inset-y-0 right-0 z-40 bg-slate-50 dark:bg-slate-950 border-l lg:border-r lg:border-l-0 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white transform transition-all duration-300 ease-in-out lg:static lg:inset-0 shadow-2xl lg:shadow-none flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'} lg:translate-x-0 ${isExpanded ? 'w-64' : 'w-64 lg:w-20'}`}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <div className="flex flex-col h-full overflow-hidden">
                    <div className={`p-8 flex items-center ${isExpanded ? 'justify-between' : 'justify-center lg:px-0 lg:py-8 justify-between relative'}`}>
                        <h1 className={`text-2xl font-black bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 bg-clip-text text-transparent tracking-tight ${!isExpanded ? 'lg:hidden' : ''}`}>
                            LIB<span className="text-slate-900/50 dark:text-white/50 font-light text-lg ml-0.5">PRO</span>
                        </h1>
                        <h1 className={`text-2xl font-black bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 bg-clip-text text-transparent tracking-tight hidden ${!isExpanded ? 'lg:block' : ''} text-center w-full`}>
                            LP
                        </h1>
                        {isExpanded && (
                            <button onClick={() => setIsPinned(!isPinned)} className="hidden lg:block text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors shrink-0 ml-2" title={isPinned ? "Ocultar menu" : "Fixar menu"}>
                                {isPinned ? <PinOff size={20} /> : <Pin size={20} />}
                            </button>
                        )}
                    </div>

                    <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto overflow-x-hidden">
                        {menuItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                title={!isExpanded ? item.name : undefined}
                                onClick={() => window.innerWidth < 1024 && setIsOpen(false)}
                                className={`flex items-center p-3.5 rounded-xl transition-all duration-200 group ${location.pathname === item.path
                                    ? 'bg-blue-600/90 text-white shadow-lg shadow-blue-900/40 ring-1 ring-blue-400/30'
                                    : 'hover:bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-white'
                                    } ${isExpanded ? 'space-x-3' : 'space-x-3 lg:space-x-0 lg:justify-center'}`}
                            >
                                <item.icon size={20} className={`shrink-0 ${location.pathname === item.path ? 'text-white' : 'text-slate-500 group-hover:text-blue-400 transition-colors'}`} />
                                <span className={`font-bold text-sm tracking-wide whitespace-nowrap ${!isExpanded ? 'lg:hidden' : ''}`}>{item.name}</span>
                                {location.pathname === item.path && <ChevronRight size={16} className={`ml-auto opacity-70 shrink-0 ${!isExpanded ? 'lg:hidden' : ''}`} />}
                            </Link>
                        ))}
                        <button
                            onClick={() => auth.signOut()}
                            title={!isExpanded ? "Sair do Sistema" : undefined}
                            className={`flex items-center p-3.5 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 hover:text-red-500 transition-all group mt-4 border border-red-500/20 ${isExpanded ? 'space-x-3 w-full' : 'space-x-3 w-full lg:space-x-0 lg:justify-center lg:w-auto'}`}
                        >
                            <LogOut size={20} className={`shrink-0 ${isExpanded ? 'group-hover:translate-x-0.5' : ''} transition-transform`} />
                            <span className={`font-bold text-sm whitespace-nowrap ${!isExpanded ? 'lg:hidden' : ''}`}>Sair do Sistema</span>
                        </button>
                    </nav>
                </div>
            </div>
        </>
    );
};

export default Sidebar;
