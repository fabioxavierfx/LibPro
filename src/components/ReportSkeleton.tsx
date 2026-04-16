export const ReportSkeleton = () => {
    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-200 dark:bg-slate-800 rounded-2xl animate-pulse" />
                        <div className="space-y-2">
                            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                            <div className="h-3 w-48 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="text-right space-y-2 hidden md:block">
                            <div className="h-4 w-16 bg-slate-200 dark:bg-slate-800 rounded animate-pulse ml-auto" />
                            <div className="h-3 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse ml-auto" />
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
                            <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
