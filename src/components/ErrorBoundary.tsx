import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RefreshCcw, Home } from 'lucide-react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error in application:', error, errorInfo);
    }

    private handleReset = () => {
        window.location.reload();
    };

    private handleGoHome = () => {
        window.location.href = '/';
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 font-sans">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center">
                        <div className="w-24 h-24 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertOctagon size={48} />
                        </div>

                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                            Ops! Algo deu errado.
                        </h1>

                        <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm leading-relaxed">
                            Ocorreu um erro inesperado na interface do sistema.
                            {this.state.error?.message ? (
                                <span className="block mt-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg font-mono text-xs text-slate-600 dark:text-slate-300 break-words">
                                    {this.state.error.message}
                                </span>
                            ) : ''}
                        </p>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={this.handleReset}
                                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                            >
                                <RefreshCcw size={20} />
                                Tentar Novamente
                            </button>

                            <button
                                onClick={this.handleGoHome}
                                className="w-full py-3 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                <Home size={20} />
                                Voltar ao Início
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
