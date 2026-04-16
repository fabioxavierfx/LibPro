import { useState, useRef } from 'react';
import { Search, X, ScanBarcode, StopCircle } from 'lucide-react';
import { useProducts } from '../../contexts/ProductsContext';
import { ScannerModal } from '../ScannerModal';

interface ProductPickerProps {
    selectedProduct: any | null;
    onSelectProduct: (product: any | null) => void;
    themeColor?: 'emerald' | 'purple' | 'blue';
    inputRef?: React.RefObject<HTMLInputElement | null>;
    searchTerm?: string;
    onSearchChange?: (term: string) => void;
}

export const ProductPicker = ({ 
    selectedProduct, 
    onSelectProduct, 
    themeColor = 'emerald', 
    inputRef,
    searchTerm: externalSearchTerm,
    onSearchChange
}: ProductPickerProps) => {
    const { products: allProducts } = useProducts();
    const [internalSearchTerm, setInternalSearchTerm] = useState('');
    const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    
    // Default ref if none provided
    const defaultRef = useRef<HTMLInputElement>(null);
    const resolvedRef = inputRef || defaultRef;

    const searchTerm = externalSearchTerm !== undefined ? externalSearchTerm : internalSearchTerm;

    const handleTermChange = (term: string) => {
        if (onSearchChange) onSearchChange(term);
        else setInternalSearchTerm(term);
    };

    const ringColorClass = {
        'emerald': 'focus:ring-emerald-500',
        'purple': 'focus:ring-purple-500',
        'blue': 'focus:ring-blue-500'
    }[themeColor];

    const textColorClass = {
        'emerald': 'text-emerald-400',
        'purple': 'text-purple-400',
        'blue': 'text-blue-400'
    }[themeColor];

    const hoverTextColorClass = {
        'emerald': 'hover:text-emerald-500 dark:hover:text-emerald-400',
        'purple': 'hover:text-purple-500 dark:hover:text-purple-400',
        'blue': 'hover:text-blue-500 dark:hover:text-blue-400'
    }[themeColor];

    const handleSearchProduct = (term: string) => {
        handleTermChange(term);
        if (term.length < 1) {
            setFilteredProducts([]);
            return;
        }

        const results = allProducts.filter((p: any) =>
            p.status !== 'inactive' && // exclude inactive mostly
            (p.sku.toLowerCase().includes(term.toLowerCase()) ||
            p.description?.toLowerCase().includes(term.toLowerCase()) ||
            p.ean?.toLowerCase().includes(term.toLowerCase()) ||
            p.title?.toLowerCase().includes(term.toLowerCase()))
        ).slice(0, 10);

        setFilteredProducts(results);
    };

    const handleScan = (decodedText: string) => {
        const found = allProducts.find(p => p.sku.toLowerCase() === decodedText.toLowerCase() || (p.ean && p.ean.toLowerCase() === decodedText.toLowerCase()));
        if (found) {
            onSelectProduct(found);
            handleTermChange('');
            setFilteredProducts([]);
        } else {
            handleSearchProduct(decodedText);
        }
    };

    const handleClear = () => {
        onSelectProduct(null);
        handleTermChange('');
        setFilteredProducts([]);
        resolvedRef.current?.focus();
    };

    const handleSelect = (p: any) => {
        onSelectProduct(p);
        setFilteredProducts([]);
    };

    return (
        <div className="relative w-full">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                    type="text"
                    ref={resolvedRef}
                    autoFocus
                    placeholder="Inserir SKU, ISBN ou Título"
                    className={`w-full pl-10 pr-20 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 ${ringColorClass} outline-none transition-all`}
                    value={selectedProduct ? `${selectedProduct.sku} - ${selectedProduct.description}` : searchTerm}
                    onChange={(e) => !selectedProduct && handleSearchProduct(e.target.value)}
                    readOnly={!!selectedProduct}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {(selectedProduct || searchTerm) && (
                        <button
                            onClick={handleClear}
                            className="text-slate-500 hover:text-slate-900 dark:text-white p-1"
                            type="button"
                        >
                            <X size={18} />
                        </button>
                    )}
                    <button
                        onClick={() => setIsScanning(!isScanning)}
                        className={`text-slate-500 p-1 bg-white dark:bg-slate-800 rounded-lg shadow-sm ml-1 ${hoverTextColorClass}`}
                        title={isScanning ? "Parar Scanner" : "Ler Código"}
                        type="button"
                    >
                        {isScanning ? <StopCircle size={20} /> : <ScanBarcode size={20} />}
                    </button>
                </div>
            </div>

            <ScannerModal
                isOpen={isScanning}
                onClose={() => setIsScanning(false)}
                onScan={handleScan}
            />

            {filteredProducts.length > 0 && !selectedProduct && (
                <div className="absolute z-10 w-full mt-1 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto border-t-0 rounded-t-none">
                    {filteredProducts.map(p => (
                        <div
                            key={p.id}
                            onClick={() => handleSelect(p)}
                            className="p-3 hover:bg-slate-200 dark:bg-slate-700 cursor-pointer border-b border-slate-300 dark:border-slate-700 last:border-0"
                        >
                            <p className={`font-mono text-sm font-bold ${textColorClass}`}>
                                {p.ean || p.sku}
                            </p>
                            <p className="text-slate-700 dark:text-slate-300 text-xs truncate mt-0.5">
                                {p.title || p.description}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
