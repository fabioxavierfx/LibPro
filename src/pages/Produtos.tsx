import { useState, useEffect, useRef, type FormEvent } from 'react';
import {
    collection,
    addDoc,
    query,
    updateDoc,
    doc,
    serverTimestamp,
    arrayUnion,
    getDocs,
    where,
    onSnapshot,
    deleteDoc,
    writeBatch
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../db/firebase';
import { Plus, Search, Edit2, X, Printer, Filter, Info, ScanBarcode, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Share2, Link as LinkIcon, Loader2, ImagePlus, Trash2, Download, CheckSquare, Square, AlertTriangle, Play, Pause, SlidersHorizontal } from 'lucide-react';
import { compressImage } from '../utils/imageUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useProducts } from '../contexts/ProductsContext';
import { useAuth } from '../hooks/useAuth';
import { getDoc } from 'firebase/firestore';
import { ScannerModal } from '../components/ScannerModal';

interface Product {
    id: string;
    sku: string;
    ean: string;
    description: string;
    title?: string;
    pages?: number;
    category?: string;
    conservation?: string;
    type?: string;
    location?: string;
    locationId?: string;
    coverUrl?: string; // Depreciado na UI, mantido por retrocompatibilidade (imagens[0])
    images?: string[];
    publisher?: string;
    year?: string;
    author?: string;
    status: 'active' | 'inactive';
    history: any[];
    createdAt?: any;
    updatedAt?: any;
}

const Produtos = () => {
    const { products } = useProducts() as any;
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
    const [advAuthor, setAdvAuthor] = useState('');
    const [advPublisher, setAdvPublisher] = useState('');
    const [advCategory, setAdvCategory] = useState('');
    const [advConservation, setAdvConservation] = useState('');
    const [advType, setAdvType] = useState('');
    const [advLocation, setAdvLocation] = useState('');
    const [advLocationId, setAdvLocationId] = useState('');
    
    const clearAdvancedSearch = () => {
        setAdvAuthor('');
        setAdvPublisher('');
        setAdvCategory('');
        setAdvConservation('');
        setAdvType('');
        setAdvLocation('');
        setAdvLocationId('');
        setStartDate('');
        setEndDate('');
        setAppliedStartDate('');
        setAppliedEndDate('');
    };

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [appliedStartDate, setAppliedStartDate] = useState('');
    const [appliedEndDate, setAppliedEndDate] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
    const [currentPage, setCurrentPage] = useState(1);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isBulkUpdating, setIsBulkUpdating] = useState(false);
    const [currentProduct, setCurrentProduct] = useState<Product | null>(null);

    const [sku, setSku] = useState('');
    const [ean, setEan] = useState('');
    const [description, setDescription] = useState('');
    const [title, setTitle] = useState('');
    const [pages, setPages] = useState<number | ''>('');
    const [category, setCategory] = useState('');
    const [conservation, setConservation] = useState('');
    const [type, setType] = useState('');
    const [location, setLocation] = useState('');
    const [locationId, setLocationId] = useState('');
    const [coverUrls, setCoverUrls] = useState<string[]>([]);
    const [coverUrlInput, setCoverUrlInput] = useState('');
    const [publisher, setPublisher] = useState('');
    const [year, setYear] = useState('');
    const [author, setAuthor] = useState('');
    const [showUrlInput, setShowUrlInput] = useState(false);
    const [status, setStatus] = useState<'active' | 'inactive'>('active');
    const [error, setError] = useState<string | null>(null);
    const [sortColumn, setSortColumn] = useState<'sku' | 'description'>('sku');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    // Select options states
    const [categoriesList, setCategoriesList] = useState<any[]>([]);
    const [conservationsList, setConservationsList] = useState<any[]>([]);
    const [typesList, setTypesList] = useState<any[]>([]);
    const [locationsList, setLocationsList] = useState<any[]>([]);
    const [isSearchingEan, setIsSearchingEan] = useState(false);
    const [isUploadingCover, setIsUploadingCover] = useState<number | false>(false);
    const [autoSkuConfig, setAutoSkuConfig] = useState({ active: false, prefix: '', suffix: '' });
    const [googleApiKey, setGoogleApiKey] = useState('');
    const [isContinuousMode, setIsContinuousMode] = useState(false);
    const eanInputRef = useRef<HTMLInputElement>(null);

    // Scanner states
    const [activeScanner, setActiveScanner] = useState<'ean' | null>(null);

    // Modal states for layout refactoring
    const [expandedImages, setExpandedImages] = useState<string[] | null>(null);
    const [expandedImageIndex, setExpandedImageIndex] = useState(0);
    const [activeCoverSlot, setActiveCoverSlot] = useState(0);
    const [viewDescription, setViewDescription] = useState<string | null>(null);
    const [toast, setToast] = useState<{ show: boolean, message: string, type: 'success' | 'error' | 'info' }>({ show: false, message: '', type: 'success' });
    const [confirmModal, setConfirmModal] = useState<{
        show: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        confirmText: string;
        type: 'danger' | 'warning' | 'info';
    }>({ show: false, title: '', message: '', onConfirm: () => {}, confirmText: 'Confirmar', type: 'info' });

    useEffect(() => {
        const unsubCat = onSnapshot(collection(db, 'categories'), (snap) => setCategoriesList(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => a.name.localeCompare(b.name))));
        const unsubCons = onSnapshot(collection(db, 'conservations'), (snap) => setConservationsList(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => a.name.localeCompare(b.name))));
        const unsubTyp = onSnapshot(collection(db, 'types'), (snap) => setTypesList(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => a.name.localeCompare(b.name))));
        const unsubLoc = onSnapshot(collection(db, 'locations'), (snap) => setLocationsList(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => a.name.localeCompare(b.name))));
        return () => { unsubCat(); unsubCons(); unsubTyp(); unsubLoc(); };
    }, []);

    useEffect(() => {
        if (!user) return;
        const fetchSettings = async () => {
            try {
                const docSnap = await getDoc(doc(db, 'users', user.uid, 'settings', 'general'));
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setAutoSkuConfig({
                        active: data.autoGenerateSku || false,
                        prefix: data.skuPrefix || '',
                        suffix: data.skuSuffix || ''
                    });
                    if (data.googleApiKey) setGoogleApiKey(data.googleApiKey);
                }
            } catch (err) {
                console.error('Erro buscando configs de SKU:', err);
            }
        };
        fetchSettings();
    }, [user]);

    useEffect(() => {
        if (isModalOpen) {
            setTimeout(() => {
                eanInputRef.current?.focus();
            }, 300);
        }
    }, [isModalOpen]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, startIndex: number) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const filesToUpload = files.slice(0, 3 - startIndex); // Limite de 3 vagas a partir da atual
        setError(null);

        for (let i = 0; i < filesToUpload.length; i++) {
            const index = startIndex + i;
            if (index > 2) break;

            setActiveCoverSlot(index);
            setIsUploadingCover(index);

            try {
                const compressedFile = await compressImage(filesToUpload[i], 800, 0.85);
                const fileName = `covers/${Date.now()}_${compressedFile.name}`;
                const storageRef = ref(storage, fileName);
                await uploadBytes(storageRef, compressedFile);
                const downloadUrl = await getDownloadURL(storageRef);
                
                setCoverUrls(prev => {
                    const newUrls = [...prev];
                    newUrls[index] = downloadUrl;
                    return newUrls;
                });
            } catch (err) {
                console.error('Erro no upload da capa:', err);
                setError('Erro ao processar/enviar imagem. Verifique suas permissões no Storage.');
            }
        }
        
        setIsUploadingCover(false);
        e.target.value = '';
    };

    const searchGoogleBooks = async () => {
        const cleanEan = ean.trim();
        if (!cleanEan) {
            setError('Digite um EAN válido para buscar.');
            return;
        }

        const numericEan = cleanEan.replace(/[^0-9]/g, '');
        setIsSearchingEan(true);
        setError(null);
        
        console.group(`🔍 Diagnóstico de Busca ISBN: ${numericEan}`);
        
        const foundData = {
            title: '',
            description: '',
            pages: 0,
            publisher: '',
            year: '',
            coverUrl: '',
            author: ''
        };

        try {
            // Paralelizamos as buscas iniciais
            const results = await Promise.allSettled([
                fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${numericEan}${googleApiKey ? '&key=' + googleApiKey : ''}`).then(r => {
                    if (r.status === 429) throw new Error('QUOTA_EXCEEDED');
                    return r.json();
                }),
                fetch(`https://brasilapi.com.br/api/isbn/v1/${numericEan}`).then(r => r.ok ? r.json() : null),
                fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${numericEan}&jscmd=details&format=json`).then(r => r.json())
            ]);

            let [googleRes, brasilRes, openLibRes] = results as any;

            // 1. Diagnóstico BrasilAPI
            if (brasilRes.status === 'fulfilled' && brasilRes.value) {
                console.log('✅ BrasilAPI: Dados localizados');
                const b = brasilRes.value;
                foundData.title = b.title || foundData.title;
                foundData.description = b.synopsis || foundData.description;
                foundData.pages = Number(b.page_count) || foundData.pages;
                foundData.publisher = b.publisher || foundData.publisher;
                foundData.year = b.year?.toString() || foundData.year;
                if (b.authors) foundData.author = Array.isArray(b.authors) ? b.authors.join(', ') : b.authors;
            } else {
                console.warn('❌ BrasilAPI: Nenhum dado ou erro na requisição');
            }

            // 2. Diagnóstico Google Books (com Fallback)
            let gData = (googleRes.status === 'fulfilled' && googleRes.value?.items?.[0]?.volumeInfo) ? googleRes.value.items[0].volumeInfo : null;
            
            if (googleRes.status === 'rejected' && googleRes.reason?.message === 'QUOTA_EXCEEDED') {
                console.error('🚫 Google Books: Cota de buscas excedida (Erro 429).');
                setError('Limite de buscas do Google atingido. Aguarde alguns minutos ou verifique sua API Key.');
            } else if (!gData && googleRes.status === 'fulfilled') {
                console.log('⚠️ Google (Filtro ISBN): 0 resultados. Tentando busca textual (fallback)...');
                try {
                    const fallbackRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${numericEan}${googleApiKey ? '&key=' + googleApiKey : ''}`).then(r => {
                        if (r.status === 429) throw new Error('QUOTA_EXCEEDED');
                        return r.json();
                    });
                    if (fallbackRes.items?.[0]?.volumeInfo) {
                        gData = fallbackRes.items[0].volumeInfo;
                        console.log('✅ Google Fallback: Sucesso!');
                    }
                } catch (e: any) { 
                    if (e.message === 'QUOTA_EXCEEDED') {
                        console.error('🚫 Google Fallback: Cota excedida.');
                        setError('Limite de buscas do Google atingido.');
                    } else {
                        console.error('❌ Erro no fallback do Google');
                    }
                }
            }

            if (gData) {
                console.log('✅ Google Books: Dados extraídos', gData);
                if (!foundData.title) foundData.title = gData.title;
                if (!foundData.description) foundData.description = gData.description;
                if (!foundData.pages) foundData.pages = Number(gData.pageCount || gData.printedPageCount);
                if (!foundData.publisher) foundData.publisher = gData.publisher;
                if (!foundData.year && gData.publishedDate) foundData.year = gData.publishedDate.substring(0, 4);
                if (!foundData.author && gData.authors) foundData.author = gData.authors.join(', ');
                if (gData.imageLinks?.thumbnail) {
                    foundData.coverUrl = gData.imageLinks.thumbnail.replace('http:', 'https:').replace('&edge=curl', '');
                }
            } else if (!error) {
                console.warn('❌ Google Books: Nenhum item localizado mesmo após fallback');
                if (googleRes.value?.error) console.error('🚫 Erro API Google:', googleRes.value.error.message);
            }

            // 3. Diagnóstico OpenLibrary
            const olKey = `ISBN:${numericEan}`;
            if (openLibRes.status === 'fulfilled' && openLibRes.value?.[olKey]) {
                console.log('✅ OpenLibrary: Dados localizados');
                const o = openLibRes.value[olKey];
                const d = o.details || {};
                
                if (!foundData.title) foundData.title = d.title;
                if (!foundData.pages) foundData.pages = Number(d.number_of_pages || d.pagination?.toString().match(/\d+/)?.[0]);
                if (!foundData.publisher && d.publishers) foundData.publisher = typeof d.publishers[0] === 'string' ? d.publishers[0] : d.publishers[0].name;
                if (!foundData.year && d.publish_date) foundData.year = d.publish_date.match(/\d{4}/)?.[0];
                if (!foundData.author) {
                    if (d.authors) foundData.author = d.authors.map((a: any) => a.name || a.key).join(', ');
                    else if (d.by_statement) foundData.author = d.by_statement;
                }
                if (!foundData.description) {
                    foundData.description = typeof d.description === 'string' ? d.description : d.description?.value;
                }
                if (!foundData.coverUrl && o.thumbnail_url) {
                    foundData.coverUrl = o.thumbnail_url.replace('-S.jpg', '-L.jpg');
                }
            } else {
                console.warn('❌ OpenLibrary: Registro não encontrado');
            }

            // Aplicar os dados
            let updatedSomething = false;
            Object.keys(foundData).forEach(key => {
                const val = (foundData as any)[key];
                if (val && key !== 'coverUrl') {
                    if (key === 'title') { setTitle(val); updatedSomething = true; }
                    if (key === 'description') { setDescription(val); updatedSomething = true; }
                    if (key === 'pages') { setPages(val); updatedSomething = true; }
                    if (key === 'publisher') { setPublisher(val); updatedSomething = true; }
                    if (key === 'year') { setYear(val); updatedSomething = true; }
                    if (key === 'author') { setAuthor(val); updatedSomething = true; }
                }
            });

            if (foundData.coverUrl) {
                setCoverUrls(prev => {
                    const next = [...prev];
                    if (!next[0]) next[0] = foundData.coverUrl;
                    return next;
                });
                updatedSomething = true;
            }

            if (!updatedSomething) {
                setError('Nenhuma informação detalhada pôde ser extraída automaticamente.');
            } else {
                console.log('🏁 Resumo Final dos Dados:', foundData);
            }

        } catch (err) {
            console.error('💥 Erro Crítico na Busca:', err);
            setError('Falha ao processar metadados.');
        } finally {
            console.groupEnd();
            setIsSearchingEan(false);
        }
    };

    const saveProduct = async () => {
        const historyEntry = {
            action: currentProduct ? 'Update' : 'Creation',
            date: new Date().toISOString(),
            details: `Produto ${currentProduct ? 'alterado' : 'criado'} com SKU: ${sku}`
        };

        const payload = {
            sku,
            ean: ean.trim(),
            description,
            title,
            pages: pages === '' ? 0 : Number(pages),
            category,
            conservation,
            type,
            coverUrl: coverUrls[0] || '',
            images: coverUrls.filter(Boolean),
            publisher,
            year,
            author,
            location,
            locationId,
            status,
            updatedAt: serverTimestamp()
        };

        try {
            if (currentProduct) {
                await updateDoc(doc(db, 'products', currentProduct.id), {
                    ...payload,
                    history: arrayUnion(historyEntry)
                });
            } else {
                await addDoc(collection(db, 'products'), {
                    ...payload,
                    createdAt: serverTimestamp(),
                    history: [historyEntry]
                });
            }

            if (isContinuousMode && !currentProduct) {
                handleClearForm();
            } else {
                resetForm();
            }
        } catch (error) {
            console.error('Erro ao salvar produto:', error);
            setError('Falha ao gravar os dados no banco.');
        } finally {
            setConfirmModal(prev => ({ ...prev, show: false }));
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);

        // Check for duplicate SKU
        const skuQuery = query(collection(db, 'products'), where('sku', '==', sku));
        const skuSnapshot = await getDocs(skuQuery);
        const isSkuDuplicate = skuSnapshot.docs.some(doc => currentProduct ? doc.id !== currentProduct.id : true);

        if (isSkuDuplicate) {
            setError('Este SKU já está cadastrado em outro produto.');
            return;
        }

        // Check for duplicate EAN (only if EAN is provided)
        if (ean && ean.trim() !== '') {
            const cleanEan = ean.trim();
            const numericEan = cleanEan.replace(/[^0-9]/g, '');

            const [snap1, snap2] = await Promise.all([
                getDocs(query(collection(db, 'products'), where('ean', '==', cleanEan))),
                getDocs(query(collection(db, 'products'), where('ean', '==', numericEan)))
            ]);

            const allDocs = [...snap1.docs, ...snap2.docs];
            const isEanDuplicate = allDocs.some(doc => currentProduct ? doc.id !== currentProduct.id : true);

            if (isEanDuplicate) {
                setConfirmModal({
                    show: true,
                    title: 'Item Duplicado',
                    message: `Este ISBN/EAN (${allDocs[0].data().title || 'Item existente'}) já está cadastrado. Deseja continuar com o cadastro duplicado?`,
                    confirmText: 'Continuar Cadastro',
                    type: 'warning',
                    onConfirm: () => saveProduct()
                });
                return;
            }
        }

        saveProduct();
    };

    const handleScan = (decodedText: string) => {
        if (activeScanner === 'ean') {
            setEan(decodedText);
        }
        setActiveScanner(null);
    };

    const handleSort = (column: 'sku' | 'description') => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const getSortIcon = (column: 'sku' | 'description') => {
        if (sortColumn !== column) return <ChevronsUpDown size={14} className="text-slate-500" />;
        return sortDirection === 'asc' ? <ChevronUp size={14} className="text-blue-500" /> : <ChevronDown size={14} className="text-blue-500" />;
    };

    const resetForm = () => {
        setActiveScanner(null);
        setSku('');
        setEan('');
        setDescription('');
        setTitle('');
        setPages('');
        setCategory('');
        setConservation('');
        setType('');
        setLocation('');
        setLocationId('');
        setCoverUrls([]);
        setActiveCoverSlot(0);
        setPublisher('');
        setYear('');
        setAuthor('');
        setStatus('active');
        setError(null);
        setCurrentProduct(null);
        setIsModalOpen(false);
    };

    const handleClearForm = () => {
        setEan('');
        setDescription('');
        setTitle('');
        setPages('');
        setCategory('');
        setConservation('');
        setType('');
        setLocation('');
        setLocationId('');
        setCoverUrls([]);
        setActiveCoverSlot(0);
        setPublisher('');
        setYear('');
        setAuthor('');
        setError(null);
        if (!currentProduct) {
            if (autoSkuConfig?.active) {
                const randomCode = Math.floor(100000 + Math.random() * 900000);
                setSku(`${autoSkuConfig.prefix || ''}${randomCode}${autoSkuConfig.suffix || ''}`);
            } else {
                setSku('');
            }
        }
        // Focar no EAN após limpar
        setTimeout(() => eanInputRef.current?.focus(), 200);
    };

    const handleOpenNewProduct = () => {
        resetForm();
        if (autoSkuConfig?.active) {
            const randomCode = Math.floor(100000 + Math.random() * 900000);
            setSku(`${autoSkuConfig.prefix || ''}${randomCode}${autoSkuConfig.suffix || ''}`);
        }
        setIsModalOpen(true);
        // Focar no EAN após abrir o modal
        setTimeout(() => eanInputRef.current?.focus(), 200);
    };

    const handleDeleteProduct = (product: Product) => {
        setConfirmModal({
            show: true,
            title: 'Excluir Livro',
            message: `Tem certeza que deseja excluir o livro "${product.title || product.sku}"? Esta ação é irreversível.`,
            confirmText: 'Excluir permanentemente',
            type: 'danger',
            onConfirm: async () => {
                try {
                    await deleteDoc(doc(db, 'products', product.id));
                    setToast({ show: true, message: 'Produto excluído com sucesso!', type: 'success' });
                } catch (err) {
                    console.error('Erro ao excluir:', err);
                    setToast({ show: true, message: 'Falha ao excluir o produto. Verifique suas permissões.', type: 'error' });
                } finally {
                    setConfirmModal(prev => ({ ...prev, show: false }));
                }
            }
        });
    };

    const filteredProducts = products.filter((p: Product) => {
        const matchesSearch = p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.ean?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.title?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'all' || p.status === statusFilter;

        let matchesDate = true;
        if (appliedStartDate || appliedEndDate) {
            // Firestore date usually exposes toDate() or exists as an ISO string depending on how it's saved.
            // When created via serverTimestamp(), it comes back as { seconds, nanoseconds } and has .toDate() method
            if (p.createdAt && typeof p.createdAt.toDate === 'function') {
                const pDate = p.createdAt.toDate();
                if (appliedStartDate) {
                    const start = new Date(appliedStartDate + 'T00:00:00');
                    if (pDate < start) matchesDate = false;
                }
                if (appliedEndDate) {
                    const end = new Date(appliedEndDate + 'T23:59:59.999');
                    if (pDate > end) matchesDate = false;
                }
            } else if (p.createdAt && typeof p.createdAt === 'string') {
                const pDate = new Date(p.createdAt);
                if (appliedStartDate) {
                    const start = new Date(appliedStartDate + 'T00:00:00');
                    if (pDate < start) matchesDate = false;
                }
                if (appliedEndDate) {
                    const end = new Date(appliedEndDate + 'T23:59:59.999');
                    if (pDate > end) matchesDate = false;
                }
            } else {
                matchesDate = false; // Exclude products without date if filtering is active
            }
        }

        const matchesAdvSearch = (!showAdvancedSearch) || (
            (!advAuthor || p.author?.toLowerCase().includes(advAuthor.toLowerCase())) &&
            (!advPublisher || p.publisher?.toLowerCase().includes(advPublisher.toLowerCase())) &&
            (!advCategory || p.category === advCategory) &&
            (!advConservation || p.conservation === advConservation) &&
            (!advType || p.type === advType) &&
            (!advLocation || p.location === advLocation) &&
            (!advLocationId || p.locationId?.toLowerCase().includes(advLocationId.toLowerCase()))
        );

        return matchesSearch && matchesStatus && matchesDate && matchesAdvSearch;
    }).sort((a: Product, b: Product) => {
        const valA = (a as any)[sortColumn] || '';
        const valB = (b as any)[sortColumn] || '';

        return sortDirection === 'asc'
            ? valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' })
            : valB.localeCompare(valA, undefined, { numeric: true, sensitivity: 'base' });
    });

    // Reset pagination when modifying list criteria
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, sortColumn, sortDirection, appliedStartDate, appliedEndDate, advAuthor, advPublisher, advCategory, advConservation, advType, advLocation, advLocationId, showAdvancedSearch]);

    const itemsPerPage = 50;
    const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
    const paginatedProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const handleShare = async () => {
        const selectedProducts = filteredProducts.filter((p: Product) => selectedIds.includes(p.id));
        if (selectedProducts.length === 0) return;

        const dateText = new Date().toLocaleString('pt-BR');
        const doc = new jsPDF();

        doc.setFontSize(20);
        doc.text(`Catálogo de Produtos`, 15, 20);
        doc.setFontSize(10);
        doc.text(`Data: ${dateText}`, 15, 30);
        doc.text(`Itens Selecionados: ${selectedProducts.length}`, 150, 30);
        doc.line(15, 38, 195, 38);

        const tableData = selectedProducts.map((p: Product) => [
            p.sku,
            p.description,
            p.title || '-',
            p.ean || '-',
            p.status === 'active' ? 'Ativo' : 'Inativo'
        ]);

        autoTable(doc, {
            startY: 43,
            head: [['SKU', 'Descrição', 'Modelo', 'EAN', 'Status']],
            body: tableData,
            headStyles: { fillColor: [226, 232, 240], textColor: [51, 65, 85] },
            alternateRowStyles: { fillColor: [241, 245, 249] },
        });

        const pdfBlob = doc.output('blob');
        const pdfFile = new File([pdfBlob], `produtos_selecionados_${new Date().getTime()}.pdf`, { type: 'application/pdf' });

        const shareText = `📊 *Catálogo de Produtos Selecionados*\n📅 *Data:* ${dateText}\n📝 *Itens:* ${selectedProducts.length}`;

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
            try {
                await navigator.share({
                    files: [pdfFile],
                    title: `Catálogo de Produtos`,
                    text: shareText
                });
            } catch (error) {
                if ((error as any).name !== 'AbortError') {
                    console.error('Erro ao compartilhar:', error);
                }
            }
        } else if (navigator.share) {
            try {
                await navigator.share({
                    title: `Catálogo de Produtos`,
                    text: shareText
                });
            } catch (error) {
                console.error('Erro ao compartilhar texto:', error);
            }
        } else {
            navigator.clipboard.writeText(shareText);
            setToast({ show: true, message: 'Resumo copiado para a área de transferência!', type: 'info' });
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredProducts.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredProducts.map((p: Product) => p.id));
        }
    };

    const handleDownloadCSV = () => {
        const selectedProducts = filteredProducts.filter((p: Product) => selectedIds.includes(p.id));
        if (selectedProducts.length === 0) return;

        const headers = ["SKU", "EAN", "Titulo", "Autor", "Editora", "Ano", "Paginas", "Categoria", "Status", "Descricao"];
        const rows = selectedProducts.map((p: Product) => [
            p.sku,
            p.ean || "",
            `"${(p.title || "").replace(/"/g, '""')}"`,
            `"${(p.author || "").replace(/"/g, '""')}"`,
            `"${(p.publisher || "").replace(/"/g, '""')}"`,
            p.year || "",
            p.pages || 0,
            p.category || "",
            p.status,
            `"${(p.description || "").replace(/"/g, '""')}"`
        ]);

        const csvContent = [headers.join(","), ...rows.map((r: any[]) => r.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `produtos_selecionados_${new Date().getTime()}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleBulkStatusChange = async (newStatus: 'active' | 'inactive') => {
        if (selectedIds.length === 0) return;
        setIsBulkUpdating(true);
        try {
            const batch = writeBatch(db);
            selectedIds.forEach(id => {
                const docRef = doc(db, 'products', id);
                batch.update(docRef, { 
                    status: newStatus,
                    updatedAt: serverTimestamp()
                });
            });
            await batch.commit();
            setSelectedIds([]);
        } catch (err) {
            console.error('Erro na atualização em massa:', err);
            setToast({ show: true, message: 'Falha ao atualizar o status dos produtos.', type: 'error' });
        } finally {
            setIsBulkUpdating(false);
        }
    };

    const handleBulkDelete = () => {
        if (selectedIds.length === 0) return;
        
        setConfirmModal({
            show: true,
            title: 'Excluir em Massa',
            message: `ATENÇÃO: Você está prestes a excluir ${selectedIds.length} produtos permanentemente. Esta ação não pode ser desfeita. Deseja continuar?`,
            confirmText: 'Excluir Selecionados',
            type: 'danger',
            onConfirm: async () => {
                setIsBulkUpdating(true);
                try {
                    const batch = writeBatch(db);
                    selectedIds.forEach(id => {
                        const docRef = doc(db, 'products', id);
                        batch.delete(docRef);
                    });
                    await batch.commit();
                    setSelectedIds([]);
                    setToast({ show: true, message: `${selectedIds.length} produtos excluídos.`, type: 'success' });
                } catch (err) {
                    console.error('Erro na exclusão em massa:', err);
                    setToast({ show: true, message: 'Erro ao processar exclusão em massa.', type: 'error' });
                } finally {
                    setIsBulkUpdating(false);
                    setConfirmModal(prev => ({ ...prev, show: false }));
                }
            }
        });
    };

    const handlePrintLabel = (product: Product) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const html = `
            <html>
                <head>
                    <title>Etiqueta - ${product.sku}</title>
                    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
                    <style>
                        @page { 
                            size: 150mm 100mm; 
                            margin: 0; 
                        }
                        body { 
                            font-family: Arial, sans-serif; 
                            margin: 0; 
                            padding: 10mm;
                            width: 150mm;
                            height: 100mm;
                            display: flex;
                            flex-direction: column;
                            justify-content: center;
                            box-sizing: border-box;
                            position: relative;
                        }
                        .top-section {
                            display: flex;
                            align-items: baseline;
                            width: 100%;
                            position: relative;
                            margin-top: 15mm;
                        }
                        .sku-container {
                            width: 55%;
                            display: flex;
                            align-items: baseline;
                        }
                        .sku {
                            font-weight: 900;
                            line-height: 0.75;
                            letter-spacing: -0.03em;
                            color: #000;
                            white-space: nowrap;
                            transform-origin: left bottom;
                        }
                        .line-container {
                            width: 45%;
                            padding-left: 15px;
                            box-sizing: border-box;
                        }
                        .line {
                            width: 100%;
                            border-bottom: 5px solid black;
                        }
                        .description {
                            font-weight: 900;
                            text-align: left;
                            line-height: 1.1;
                            width: 100%;
                            white-space: nowrap;
                            overflow: hidden;
                            color: #000;
                            margin-top: 25px;
                        }
                        .qrcode-container {
                            position: absolute;
                            top: 5mm;
                            right: 5mm;
                        }
                        @media print {
                            * {
                                -webkit-print-color-adjust: exact !important;
                                print-color-adjust: exact !important;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="qrcode-container" id="qrcode"></div>
                    <div class="top-section">
                        <div class="sku-container" id="sku-container">
                            <span class="sku" id="sku">${product.sku}</span>
                        </div>
                        <div class="line-container">
                            <div class="line"></div>
                        </div>
                    </div>
                    <div class="description" id="desc">${product.description}</div>
                    <script>
                        // Generate QR Code
                        new QRCode(document.getElementById('qrcode'), {
                            text: "${product.sku}",
                            width: 90,
                            height: 90,
                            colorDark : "#000000",
                            colorLight : "#ffffff",
                            correctLevel : QRCode.CorrectLevel.M
                        });

                        // Auto-scale SKU to fit 55% container exactly
                        const sku = document.getElementById('sku');
                        const skuContainer = document.getElementById('sku-container');
                        let skuSize = 10;
                        sku.style.fontSize = skuSize + 'px';
                        while(sku.offsetWidth < skuContainer.clientWidth && skuSize < 800) {
                            skuSize += 2;
                            sku.style.fontSize = skuSize + 'px';
                        }
                        sku.style.fontSize = (skuSize - 2) + 'px';

                        // Auto-scale description to fit 100% width
                        const desc = document.getElementById('desc');
                        let descSize = 45;
                        desc.style.fontSize = descSize + 'px';
                        while(desc.scrollWidth > desc.clientWidth && descSize > 10) {
                            descSize--;
                            desc.style.fontSize = descSize + 'px';
                        }
                        
                        // Wait slightly longer for QR code to render before printing
                        setTimeout(() => window.print(), 500);
                    </script>
                </body>
            </html>
        `;
        printWindow.document.write(html);
        printWindow.document.close();
    };

    return (
        <div className="p-4 md:p-8 max-w-full mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Títulos</h1>
                    <p className="text-slate-500 dark:text-slate-400">Gerencie seu catálogo de obras</p>
                    <div className="flex gap-4 mt-2 text-sm font-bold uppercase tracking-wider">
                        <span className="text-slate-500">Total: <span className="text-slate-700 dark:text-slate-300">{products.length}</span></span>
                        <span className="text-slate-500">Ativos: <span className="text-emerald-500">{products.filter((p: Product) => p.status === 'active').length}</span></span>
                        <span className="text-slate-500">Inativos: <span className="text-red-500">{products.filter((p: Product) => p.status === 'inactive').length}</span></span>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-3">
                    <div className="flex items-center gap-3">
                        {/* Modo Contínuo Switch */}
                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 transition-all">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Modo Contínuo</span>
                            <button
                                onClick={() => setIsContinuousMode(!isContinuousMode)}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-all duration-300 focus:outline-none ${
                                    isContinuousMode ? 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.3)]' : 'bg-slate-300 dark:bg-slate-600'
                                }`}
                                title={isContinuousMode ? "Desativar Cadastro Contínuo" : "Ativar Cadastro Contínuo"}
                            >
                                <span
                                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-300 ${
                                        isContinuousMode ? 'translate-x-5' : 'translate-x-0.5'
                                    }`}
                                />
                            </button>
                        </div>

                        <button
                            onClick={handleOpenNewProduct}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-500/30 transition-all hover:scale-[1.02] active:scale-95"
                        >
                            <Plus size={20} />
                            <span className="hidden md:inline">Novo Título</span>
                        </button>
                        {/* Botão de Impressão (Desktop) */}
                    {/* Ações em Massa (Batch) - Movido para baixo conforme solicitado */}

                    <button
                        onClick={() => {
                            const selectedProducts = filteredProducts.filter((p: Product) => selectedIds.includes(p.id));
                            if (selectedProducts.length === 0) return;

                            const printWindow = window.open('', '_blank');
                            if (!printWindow) return;

                            const html = `
                                <html>
                                    <head>
                                        <title>Relatório de Títulos Selecionados</title>
                                        <style>
                                            body { font-family: sans-serif; padding: 20px; }
                                            table { width: 100%; border-collapse: collapse; margin-top: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                                            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                                            th { background-color: #e2e8f0 !important; }
                                            tbody tr:nth-child(even) { background-color: #f2f2f2 !important; }
                                            h1 { color: #333; }
                                            .status { font-size: 0.8em; font-weight: bold; padding: 4px 8px; border-radius: 4px; }
                                            .active { background-color: #dcfce7; color: #166534; }
                                            .inactive { background-color: #fee2e2; color: #991b1b; }
                                        </style>
                                    </head>
                                    <body>
                                        <h1>Relatório de Títulos Selecionados</h1>
                                        <p>Data: ${new Date().toLocaleString('pt-BR')}</p>
                                        <p>Total de itens: ${selectedProducts.length}</p>
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>SKU</th>
                                                    <th>Descrição</th>
                                                    <th>Título</th>
                                                    <th>EAN</th>
                                                    <th>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${selectedProducts.map((p: Product) => `
                                                    <tr>
                                                        <td>${p.sku}</td>
                                                        <td>${p.description}</td>
                                                        <td>${p.title || '-'}</td>
                                                        <td>${p.ean || '-'}</td>
                                                        <td>
                                                            <span class="status ${p.status}">
                                                                ${p.status === 'active' ? 'Ativo' : 'Inativo'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                        <script>window.print();</script>
                                    </body>
                                </html>
                            `;
                            printWindow.document.write(html);
                            printWindow.document.close();
                        }}
                        disabled={selectedIds.length === 0 || isBulkUpdating}
                        className="hidden md:flex p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl transition-all border border-slate-300 dark:border-slate-700 shadow-lg disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Imprimir Selecionados"
                    >
                        <Printer size={20} />
                    </button>
                    <button
                        onClick={handleDownloadCSV}
                        disabled={selectedIds.length === 0 || isBulkUpdating}
                        className="hidden md:flex p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white rounded-xl transition-all border border-slate-300 dark:border-slate-700 shadow-lg disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Exportar CSV"
                    >
                        <Download size={20} />
                    </button>
                    {/* Botão de Compartilhamento (Mobile) */}
                    <button
                        onClick={handleShare}
                        disabled={selectedIds.length === 0}
                        className="md:hidden p-3 bg-blue-600/10 text-blue-400 rounded-xl border border-blue-500/20 active:scale-95 transition-all disabled:opacity-30"
                        title="Compartilhar PDF"
                    >
                        <Share2 size={20} />
                    </button>
                    </div>

                    {/* Barra de Ações em Massa - Agora aparece abaixo se > 1 item for selecionado */}
                    {selectedIds.length > 1 && (
                        <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/10 border-l-4 border-blue-500 py-1.5 px-3 rounded-lg animate-in fade-in slide-in-from-top-2 duration-300 shadow-sm border border-blue-200 dark:border-blue-800/50">
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 mr-2 whitespace-nowrap">
                                {selectedIds.length} itens selecionados
                            </span>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => handleBulkStatusChange('active')}
                                    disabled={isBulkUpdating}
                                    className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-1 text-xs font-bold px-3"
                                >
                                    {isBulkUpdating ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />}
                                    <span className="hidden sm:inline">Ativar</span>
                                </button>
                                <button
                                    onClick={() => handleBulkStatusChange('inactive')}
                                    disabled={isBulkUpdating}
                                    className="p-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-1 text-xs font-bold px-3"
                                >
                                    {isBulkUpdating ? <Loader2 className="animate-spin" size={14} /> : <Pause size={14} />}
                                    <span className="hidden sm:inline">Inativar</span>
                                </button>
                                <button
                                    onClick={handleBulkDelete}
                                    disabled={isBulkUpdating}
                                    className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-all shadow-sm active:scale-95 disabled:opacity-50"
                                    title="Excluir Selecionados"
                                >
                                    {isBulkUpdating ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 flex flex-col xl:flex-row gap-4 items-center">
                    <div className="relative flex-1 w-full group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                        <input
                            type="text"
                            placeholder="Buscar por SKU, EAN ou descrição..."
                            className="w-full pl-10 pr-10 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 dark:text-white transition-colors p-1"
                                title="Limpar busca"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    
                    <div className="flex flex-col md:flex-row items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-300 dark:border-slate-700 w-full xl:w-auto">
                        <div className="flex items-center gap-1 w-full md:w-auto justify-center md:justify-start px-2 py-1">
                            <Filter size={16} className="text-slate-500 hidden md:block" />
                            <button
                                onClick={() => setStatusFilter('active')}
                                className={`flex-1 md:flex-none px-3 py-1.5 text-xs font-bold rounded-md transition-all ${statusFilter === 'active' ? 'bg-emerald-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                            >
                                Ativos
                            </button>
                            <button
                                onClick={() => setStatusFilter('inactive')}
                                className={`flex-1 md:flex-none px-3 py-1.5 text-xs font-bold rounded-md transition-all ${statusFilter === 'inactive' ? 'bg-red-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                            >
                                Inativos
                            </button>
                            <button
                                onClick={() => setStatusFilter('all')}
                                className={`flex-1 md:flex-none px-3 py-1.5 text-xs font-bold rounded-md transition-all ${statusFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                            >
                                Todos
                            </button>
                        </div>
                        
                        <button
                            onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md border transition-all ml-1 w-full md:w-auto justify-center md:justify-start ${showAdvancedSearch ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 border-blue-200 dark:border-blue-800' : 'bg-transparent text-slate-500 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                            title="Filtros Avançados"
                        >
                            <SlidersHorizontal size={14} />
                            Avançado
                        </button>
                    </div>
                </div>

                {/* Painel de Busca Avançada */}
                {showAdvancedSearch && (
                    <div className="bg-slate-50 dark:bg-slate-900/40 p-4 border-b border-slate-200 dark:border-slate-800 animate-in slide-in-from-top-2 duration-300 shadow-inner">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <SlidersHorizontal size={16} className="text-blue-500" />
                                Filtros Detalhados
                            </h3>
                            <button onClick={clearAdvancedSearch} className="text-xs font-bold text-slate-500 hover:text-red-500 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 active:scale-95 transition-all shadow-sm">
                                Limpar Todos
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Autor</label>
                                <input type="text" value={advAuthor} onChange={(e) => setAdvAuthor(e.target.value)} placeholder="Ex: Machado de Assis..." className="w-full text-sm px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Editora</label>
                                <input type="text" value={advPublisher} onChange={(e) => setAdvPublisher(e.target.value)} placeholder="Ex: Companhia das Letras..." className="w-full text-sm px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Categoria</label>
                                <select value={advCategory} onChange={(e) => setAdvCategory(e.target.value)} className="w-full text-sm px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium">
                                    <option value="">Todas</option>
                                    {categoriesList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Conservação</label>
                                <select value={advConservation} onChange={(e) => setAdvConservation(e.target.value)} className="w-full text-sm px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium">
                                    <option value="">Todas</option>
                                    {conservationsList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Tipo de Título</label>
                                <select value={advType} onChange={(e) => setAdvType(e.target.value)} className="w-full text-sm px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium">
                                    <option value="">Todos</option>
                                    {typesList.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Local (ID Local)</label>
                                <select value={advLocation} onChange={(e) => setAdvLocation(e.target.value)} className="w-full text-sm px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium">
                                    <option value="">Todos</option>
                                    {locationsList.map(l => <option key={l.id} value={l.name}>{l.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Identificador</label>
                                <input type="text" value={advLocationId} onChange={(e) => setAdvLocationId(e.target.value)} placeholder="Ex: P-01..." className="w-full text-sm font-mono px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Data Início (Cadastro)</label>
                                <input 
                                    type="date" 
                                    value={startDate}
                                    onChange={(e) => { setStartDate(e.target.value); setAppliedStartDate(e.target.value); }}
                                    className="w-full text-sm px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-slate-700 dark:text-slate-300"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Data Fim (Cadastro)</label>
                                <input 
                                    type="date" 
                                    value={endDate}
                                    onChange={(e) => { setEndDate(e.target.value); setAppliedEndDate(e.target.value); }}
                                    className="w-full text-sm px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-slate-700 dark:text-slate-300"
                                />
                            </div>
                        </div>
                    </div>
                )}

                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-200/50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 text-sm">
                                <th className="px-6 py-4 font-semibold w-10">
                                    <button 
                                        onClick={toggleSelectAll}
                                        className="text-slate-500 hover:text-blue-500 transition-colors"
                                    >
                                        {selectedIds.length === filteredProducts.length ? <CheckSquare size={20} className="text-blue-500" /> : <Square size={20} />}
                                    </button>
                                </th>
                                <th
                                    className="px-6 py-4 font-semibold text-nowrap cursor-pointer transition-colors group"
                                    onClick={() => handleSort('sku')}
                                >
                                    <div className="flex items-center gap-2">
                                        Capa / SKU
                                        {getSortIcon('sku')}
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-semibold w-full cursor-pointer transition-colors group" onClick={() => handleSort('description')}>
                                    <div className="flex items-center gap-2">
                                        Título
                                        {getSortIcon('description')}
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-semibold text-nowrap">Local (ID)</th>
                                <th className="px-6 py-4 font-semibold">Status</th>
                                <th className="px-6 py-4 font-semibold text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {paginatedProducts.map((product: Product) => (
                                <tr key={product.id} className={`hover:bg-slate-100/30 dark:bg-slate-800/30 transition-colors ${selectedIds.includes(product.id) ? 'bg-blue-500/5' : ''}`}>
                                    <td className="px-6 py-4">
                                        <button 
                                            onClick={() => toggleSelect(product.id)}
                                            className="text-slate-400 hover:text-blue-500 transition-colors"
                                        >
                                            {selectedIds.includes(product.id) ? <CheckSquare size={20} className="text-blue-500" /> : <Square size={20} />}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col items-center gap-2 w-max">
                                            {product.coverUrl ? (
                                                <div 
                                                    className="w-12 h-16 bg-slate-200 dark:bg-slate-800 rounded-md overflow-hidden shadow-sm cursor-pointer hover:ring-2 hover:ring-blue-500 active:scale-95 transition-all"
                                                    onClick={() => { setExpandedImages(product.images?.length ? product.images : [product.coverUrl!]); setExpandedImageIndex(0); }}
                                                >
                                                    <img src={product.coverUrl} alt="Capa" className="w-full h-full object-cover" />
                                                </div>
                                            ) : (
                                                <div className="w-12 h-16 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                                                    <ImagePlus size={16} className="text-slate-400" />
                                                </div>
                                            )}
                                            <span className="font-mono text-blue-500 text-[10px] font-bold">{product.sku}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 min-w-[150px]">
                                        <p className="text-slate-900 dark:text-white text-sm md:text-base font-bold line-clamp-2 leading-tight">
                                            {product.title || 'Sem Título'}
                                        </p>
                                        <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-1.5 font-semibold uppercase">
                                            EAN: <span className="font-mono">{product.ean || '-'}</span>
                                        </p>
                                        <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                                            <span className="font-semibold">Nº Pág.:</span> {product.pages || '-'}
                                        </p>
                                        <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                                            <span className="font-semibold">Categoria:</span> {product.category || '-'}
                                        </p>
                                        <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                                            {[product.type, product.conservation].filter(Boolean).join(', ') || '-'}
                                        </p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-slate-900 dark:text-white text-xs font-bold whitespace-nowrap">{product.location || '-'}</p>
                                        <p className="text-slate-500 dark:text-slate-400 text-[10px] font-mono">{product.locationId || '-'}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-[10px] uppercase font-bold text-nowrap ${product.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                                            }`}>
                                            {product.status === 'active' ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2 text-nowrap">
                                            <button
                                                onClick={() => setViewDescription(product.description)}
                                                className="flex items-center gap-1 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg text-xs font-bold transition-all"
                                                title="Ler Sinopse"
                                            >
                                                <Info size={16} /> Ler
                                            </button>
                                            <button
                                                onClick={() => handlePrintLabel(product)}
                                                className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-200 dark:bg-slate-700 rounded-lg transition-all"
                                                title="Imprimir Etiqueta"
                                            >
                                                <Printer size={18} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setCurrentProduct(product);
                                                    setSku(product.sku);
                                                    setEan(product.ean || '');
                                                    setDescription(product.description);
                                                    setTitle(product.title || '');
                                                    setPages(product.pages || '');
                                                    setCategory(product.category || '');
                                                    setConservation(product.conservation || '');
                                                    setType(product.type || '');
                                                    setLocation(product.location || '');
                                                    setLocationId(product.locationId || '');
                                                    setCoverUrls(product.images?.length ? product.images : (product.coverUrl ? [product.coverUrl] : []));
                                                    setPublisher(product.publisher || '');
                                                    setYear(product.year || '');
                                                    setAuthor(product.author || '');
                                                    setStatus(product.status);
                                                    setIsModalOpen(true);
                                                }}
                                                className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white hover:bg-slate-200 dark:bg-slate-700 rounded-lg transition-all"
                                                title="Editar"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteProduct(product)}
                                                className="p-2 text-red-400 hover:text-white hover:bg-red-500 rounded-lg transition-all"
                                                title="Excluir"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Layout Mobile (Cards) */}
                <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
                    {paginatedProducts.map((product: Product) => (
                        <div key={product.id} className={`p-4 flex flex-col gap-3 hover:bg-slate-100/20 dark:bg-slate-800/20 transition-colors relative ${selectedIds.includes(product.id) ? 'bg-blue-500/5' : ''}`}>
                            <div className="absolute top-4 right-4 z-10">
                                <button 
                                    onClick={() => toggleSelect(product.id)}
                                    className="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800"
                                >
                                    {selectedIds.includes(product.id) ? <CheckSquare size={20} className="text-blue-500" /> : <Square size={20} className="text-slate-400" />}
                                </button>
                            </div>
                            <div className="flex gap-4">
                                {/* Thumb */}
                                <div className="flex-shrink-0">
                                    {product.coverUrl ? (
                                        <div 
                                            className="w-20 h-28 bg-slate-200 dark:bg-slate-800 rounded-lg overflow-hidden shadow-md cursor-pointer active:scale-95 transition-transform"
                                            onClick={() => { setExpandedImages(product.images?.length ? product.images : [product.coverUrl!]); setExpandedImageIndex(0); }}
                                        >
                                            <img src={product.coverUrl} alt="Capa" className="w-full h-full object-cover" />
                                        </div>
                                    ) : (
                                        <div className="w-20 h-28 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm">
                                            <ImagePlus size={24} className="text-slate-400" />
                                        </div>
                                    )}
                                </div>
                                {/* Info Right */}
                                <div className="flex flex-col flex-1 justify-between">
                                    <div>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h3 className="font-bold text-slate-800 dark:text-white leading-tight line-clamp-2 text-sm">{product.title || 'Sem Título'}</h3>
                                                <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-1.5 font-semibold uppercase">
                                                    EAN: <span className="font-mono">{product.ean || '-'}</span>
                                                </p>
                                                <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-0.5">
                                                    <span className="font-semibold">Nº Pág.:</span> {product.pages || '-'}
                                                </p>
                                                <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-0.5">
                                                    <span className="font-semibold">Categoria:</span> {product.category || '-'}
                                                </p>
                                                <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-0.5">
                                                    <span className="font-semibold">Local:</span> {[product.location, product.locationId].filter(Boolean).join(' / ') || '-'}
                                                </p>
                                                <p className="text-slate-500 dark:text-slate-400 text-[10px] mt-0.5">
                                                    {[product.type, product.conservation].filter(Boolean).join(', ') || '-'}
                                                </p>
                                            </div>
                                            <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${product.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-500'}`}>
                                                {product.status === 'active' ? 'ON' : 'OFF'}
                                            </span>
                                        </div>
                                        <p className="font-mono text-blue-500 font-bold text-xs mt-1">{product.sku}</p>
                                    </div>
                                    <div className="flex justify-end mt-2">
                                        <button onClick={() => setViewDescription(product.description)} className="text-xs text-slate-50 dark:text-blue-900 bg-blue-500 dark:bg-blue-400 font-bold flex items-center gap-1 active:scale-95 px-3 py-1.5 rounded-lg">
                                            <Info size={14} /> Ler Sinopse
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between pt-2 border-t border-slate-200/50 dark:border-slate-800/50 overflow-x-auto gap-2 pb-1 hide-scrollbar">
                                <button
                                    onClick={() => handlePrintLabel(product)}
                                    className="flex items-center justify-center px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold border border-slate-300 dark:border-slate-700 active:scale-95 transition-all shrink-0"
                                >
                                    <Printer size={16} />
                                </button>
                                <button
                                    onClick={() => {
                                        setCurrentProduct(product);
                                        setSku(product.sku);
                                        setEan(product.ean || '');
                                        setDescription(product.description);
                                        setTitle(product.title || '');
                                        setPages(product.pages || '');
                                        setCategory(product.category || '');
                                        setConservation(product.conservation || '');
                                        setType(product.type || '');
                                        setLocation(product.location || '');
                                        setLocationId(product.locationId || '');
                                        setCoverUrls(product.images?.length ? product.images : (product.coverUrl ? [product.coverUrl] : []));
                                        setPublisher(product.publisher || '');
                                        setYear(product.year || '');
                                        setAuthor(product.author || '');
                                        setStatus(product.status);
                                        setIsModalOpen(true);
                                    }}
                                    className="flex items-center justify-center px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold border border-slate-300 dark:border-slate-700 active:scale-95 transition-all shrink-0"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    onClick={() => handleDeleteProduct(product)}
                                    className="flex items-center justify-center px-3 py-2 bg-red-100 dark:bg-red-900/20 text-red-600 dark:red-400 rounded-lg text-xs font-bold border border-red-200 dark:border-red-900/30 active:scale-95 transition-all shrink-0 ml-auto"
                                >
                                    <Trash2 size={16} /> 
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {filteredProducts.length === 0 && (
                    <div className="p-12 text-center text-slate-500 italic text-sm w-full">
                        Nenhum produto encontrado.
                    </div>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-800 mt-2 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl">
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                            Página <span className="font-bold text-slate-900 dark:text-white">{currentPage}</span> de <span className="font-bold text-slate-900 dark:text-white">{totalPages}</span>
                            <span className="hidden md:inline"> ({filteredProducts.length} itens)</span>
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 md:px-4 py-2 text-sm font-semibold border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-slate-700 dark:text-slate-300 shadow-sm"
                            >
                                Anterior
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 md:px-4 py-2 text-sm font-semibold border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-slate-700 dark:text-slate-300 shadow-sm"
                            >
                                Próxima
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal Cadastro/Edição */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl">
                        <div className="p-4 md:p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white/50 dark:bg-slate-900/50">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-1 mr-4">
                                {currentProduct ? (
                                    <>
                                        <Edit2 size={20} className="text-blue-500 shrink-0" />
                                        <span className="line-clamp-1">{currentProduct.title || 'Editar Título'}</span>
                                    </>
                                ) : (
                                    'Novo Título'
                                )}
                            </h2>
                            <button onClick={resetForm} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white shrink-0">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4 max-h-[85vh] overflow-y-auto">
                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-lg text-sm font-medium">
                                    {error}
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2 ml-1">SKU</label>
                                <input
                                    required
                                    autoFocus
                                    value={sku}
                                    onChange={(e) => setSku(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="Ex: PROD-123"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2 ml-1">EAN (Código de Barras)</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            ref={eanInputRef}
                                            type="text"
                                            id="ean"
                                            value={ean}
                                            onChange={(e) => setEan(e.target.value)}
                                            className="w-full pl-4 pr-12 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            placeholder="Ex: 978..."
                                        />
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
                                            <button
                                                type="button"
                                                onClick={() => setActiveScanner('ean')}
                                                className="text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm"
                                                title="Escanear EAN"
                                            >
                                                <ScanBarcode size={20} />
                                            </button>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => searchGoogleBooks()}
                                        disabled={isSearchingEan || !ean.trim()}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
                                        title="Buscar dados do livro na web"
                                    >
                                        {isSearchingEan ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
                                    </button>
                                </div>
                            </div>

                            {/* Capa e Detalhes Principais */}
                            <div className="flex flex-col md:flex-row gap-6 md:gap-8 mb-6">
                                {/* Esquerda: Capa */}
                                <div className="flex flex-col items-center w-full md:w-[280px] shrink-0 relative">
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Imagens da Obra (Até 3)</label>
                                    
                                    <div className="flex items-center justify-center gap-4 mb-3 w-full">
                                        <button 
                                            type="button"
                                            className="p-1.5 rounded-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed hidden sm:block"
                                            onClick={() => setActiveCoverSlot(s => Math.max(0, s - 1))}
                                            disabled={activeCoverSlot === 0}
                                        >
                                            <ChevronLeft size={20} className={activeCoverSlot === 0 ? 'text-slate-400' : 'text-slate-700 dark:text-slate-300'} />
                                        </button>

                                        <div className="flex flex-col items-center">
                                            <div 
                                                className="relative w-32 h-44 bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors flex flex-col items-center justify-center group shadow-sm shrink-0"
                                                onClick={() => document.getElementById(`cover-upload-${activeCoverSlot}`)?.click()}
                                            >
                                                {isUploadingCover === activeCoverSlot ? (
                                                    <Loader2 size={32} className="text-blue-500 animate-spin" />
                                                ) : coverUrls[activeCoverSlot] ? (
                                                    <>
                                                        <img src={coverUrls[activeCoverSlot]} alt={`Capa ${activeCoverSlot + 1}`} className="w-full h-full object-cover group-hover:opacity-50 transition-opacity" />
                                                        <button 
                                                            type="button"
                                                            className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white p-1 rounded-full shadow-md z-10 transition-colors"
                                                            onClick={(e) => { 
                                                                e.stopPropagation(); 
                                                                setCoverUrls(prev => {
                                                                    const n = [...prev];
                                                                    n.splice(activeCoverSlot, 1);
                                                                    return n;
                                                                });
                                                            }}
                                                            title="Remover Imagem"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                        
                                                        {/* Mobile navigation side overlays */}
                                                        <div className="absolute inset-y-0 left-0 w-8 flex items-center justify-center bg-gradient-to-r from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity sm:hidden" onClick={(e) => { e.stopPropagation(); setActiveCoverSlot(s => Math.max(0, s - 1)); }}>
                                                            {activeCoverSlot > 0 && <ChevronLeft size={20} className="text-white drop-shadow-md" />}
                                                        </div>
                                                        <div className="absolute inset-y-0 right-0 w-8 flex items-center justify-center bg-gradient-to-l from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity sm:hidden" onClick={(e) => { e.stopPropagation(); setActiveCoverSlot(s => Math.min(2, s + 1)); }}>
                                                            {activeCoverSlot < 2 && <ChevronRight size={20} className="text-white drop-shadow-md" />}
                                                        </div>
                                                        
                                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                                            <ImagePlus size={32} className="text-white drop-shadow-md" />
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <ImagePlus size={32} className="text-slate-400 mb-2 group-hover:text-blue-500 transition-colors" />
                                                        <span className="text-[10px] font-bold text-slate-500 group-hover:text-blue-500 text-center px-1 uppercase tracking-wider">{activeCoverSlot === 0 ? 'Capa Principal' : `Imagem ${activeCoverSlot + 1}`}</span>

                                                        {/* Mobile navigation side overlays for empty states too */}
                                                        <div className="absolute inset-y-0 left-0 w-8 flex items-center justify-center sm:hidden" onClick={(e) => { e.stopPropagation(); setActiveCoverSlot(s => Math.max(0, s - 1)); }}>
                                                            {activeCoverSlot > 0 && <ChevronLeft size={20} className="text-slate-400" />}
                                                        </div>
                                                        <div className="absolute inset-y-0 right-0 w-8 flex items-center justify-center sm:hidden" onClick={(e) => { e.stopPropagation(); setActiveCoverSlot(s => Math.min(2, s + 1)); }}>
                                                            {activeCoverSlot < 2 && <ChevronRight size={20} className="text-slate-400" />}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                            <input id={`cover-upload-${activeCoverSlot}`} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFileUpload(e, activeCoverSlot)} />
                                        </div>

                                        <button 
                                            type="button"
                                            className="p-1.5 rounded-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed hidden sm:block"
                                            onClick={() => setActiveCoverSlot(s => Math.min(2, s + 1))}
                                            disabled={activeCoverSlot === 2}
                                        >
                                            <ChevronRight size={20} className={activeCoverSlot === 2 ? 'text-slate-400' : 'text-slate-700 dark:text-slate-300'} />
                                        </button>
                                    </div>
                                    
                                    {/* Slot indicators */}
                                    <div className="flex gap-1.5 my-1">
                                        {[0, 1, 2].map(dotIndex => (
                                            <button 
                                                key={dotIndex}
                                                type="button"
                                                onClick={() => setActiveCoverSlot(dotIndex)}
                                                className={`w-2.5 h-2.5 rounded-full transition-all ${activeCoverSlot === dotIndex ? 'bg-blue-500 scale-125' : coverUrls[dotIndex] ? 'bg-blue-300 dark:bg-blue-800 hover:bg-blue-400' : 'bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'}`} 
                                            />
                                        ))}
                                    </div>
                                    
                                    <div className="w-full max-w-xs flex flex-col items-center mt-3">
                                        <button 
                                            type="button"
                                            onClick={() => setShowUrlInput(!showUrlInput)}
                                            className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors text-xs font-bold shadow-sm border border-slate-200 dark:border-slate-700"
                                        >
                                            <LinkIcon size={14} /> {showUrlInput ? 'Ocultar Link' : 'Colar na Posição Atual'}
                                        </button>
                                        
                                        {showUrlInput && (
                                            <div className="w-full mt-3 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                                                <input
                                                    type="url"
                                                    value={coverUrlInput}
                                                    onChange={(e) => setCoverUrlInput(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if(e.key === 'Enter') {
                                                            e.preventDefault();
                                                            if (coverUrlInput.trim() !== '') {
                                                                setCoverUrls(prev => {
                                                                    const n = [...prev];
                                                                    n[activeCoverSlot] = coverUrlInput;
                                                                    return n;
                                                                });
                                                                setCoverUrlInput('');
                                                                setShowUrlInput(false);
                                                            }
                                                        }
                                                    }}
                                                    placeholder="Cole e tecle Enter..."
                                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Direita: Detalhes */}
                                <div className="flex-1 flex flex-col gap-4 justify-center md:border-l md:border-slate-200 md:dark:border-slate-800 md:pl-8">
                                    <div className="grid grid-cols-1 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2 ml-1">Título da Obra</label>
                                            <input
                                                required
                                                value={title}
                                                onChange={(e) => setTitle(e.target.value)}
                                                className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                placeholder="Ex: O Senhor dos Anéis..."
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2 ml-1">Autor / Autora</label>
                                            <input
                                                value={author}
                                                onChange={(e) => setAuthor(e.target.value)}
                                                className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                placeholder="Ex: J.R.R. Tolkien"
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2 ml-1">Editora</label>
                                            <input
                                                value={publisher}
                                                onChange={(e) => setPublisher(e.target.value)}
                                                className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                placeholder="Nome da Editora..."
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2 ml-1">Ano</label>
                                            <input
                                                type="number"
                                                value={year}
                                                onChange={(e) => setYear(e.target.value)}
                                                className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                placeholder="Ex: 2024"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2 ml-1">Páginas</label>
                                            <input
                                                type="number"
                                                value={pages}
                                                onChange={(e) => setPages(e.target.value ? Number(e.target.value) : '')}
                                                className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                placeholder="Qtd..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2 ml-1">Sinopse da Obra (Descrição)</label>
                                <textarea
                                    required
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none h-24 transition-all"
                                    placeholder="Sinopse detalhada do livro..."
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-2 ml-1">Categoria</label>
                                    <select
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    >
                                        <option value="">Selecione...</option>
                                        {categoriesList.map(c => (
                                            <option key={c.id} value={c.name}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-2 ml-1">Conservação</label>
                                    <select
                                        value={conservation}
                                        onChange={(e) => setConservation(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    >
                                        <option value="">Selecione...</option>
                                        {conservationsList.map(c => (
                                            <option key={c.id} value={c.name}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-2 ml-1">Tipo</label>
                                    <select
                                        value={type}
                                        onChange={(e) => setType(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    >
                                        <option value="">Selecione...</option>
                                        {typesList.map(t => (
                                            <option key={t.id} value={t.name}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-2 ml-1">ID Local</label>
                                    <select
                                        value={location}
                                        onChange={(e) => setLocation(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    >
                                        <option value="">Selecione um local...</option>
                                        {locationsList.map(l => (
                                            <option key={l.id} value={l.name}>{l.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-2 ml-1">Identificador</label>
                                    <input
                                        type="text"
                                        value={locationId}
                                        onChange={(e) => setLocationId(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono"
                                        placeholder="Ex: P-01, Gaveta B..."
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-2 ml-1">Status</label>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value as any)}
                                    className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                >
                                    <option value="active">Ativo</option>
                                    <option value="inactive">Inativo</option>
                                </select>
                            </div>
                            <div className="pt-4 flex flex-col md:flex-row gap-3">
                                <button type="button" onClick={resetForm} className="order-3 md:order-1 flex-1 py-3 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                                <button type="button" onClick={handleClearForm} className="order-2 md:order-2 flex-1 py-3 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 font-bold rounded-xl hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors">Limpar</button>
                                <button type="submit" className="order-1 md:order-3 flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg active:scale-95">
                                    {currentProduct ? 'Salvar Alterações' : 'Cadastrar Título'}
                                </button>
                            </div>
                        </form>
                    </div >
                </div >
            )}

            <ScannerModal
                isOpen={!!activeScanner}
                onClose={() => setActiveScanner(null)}
                onScan={handleScan}
            />

            {/* Modal Histórico */}
            {
                isHistoryOpen && currentProduct && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
                            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-100/50 dark:bg-slate-800/50">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Histórico: {currentProduct.sku}</h2>
                                <button onClick={() => setIsHistoryOpen(false)} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-white">
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
                                {currentProduct.history?.slice().reverse().map((entry, idx) => (
                                    <div key={idx} className="border-l-2 border-blue-500 pl-4 py-1">
                                        <p className="text-xs text-slate-500">{new Date(entry.date).toLocaleString('pt-BR')}</p>
                                        <p className="text-slate-900 dark:text-white font-medium">{entry.action}</p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{entry.details}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Modal de Ampliação da Capa (Carrossel) */}
            {expandedImages && expandedImages.length > 0 && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 animate-in fade-in zoom-in duration-200" onClick={() => setExpandedImages(null)}>
                    <button className="absolute top-6 right-6 text-white bg-white/10 p-2 rounded-full hover:bg-white/20 transition-all backdrop-blur-md" onClick={(e) => { e.stopPropagation(); setExpandedImages(null); }}>
                        <X size={24} />
                    </button>
                    
                    <div className="relative flex items-center justify-center w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
                        {expandedImages.length > 1 && (
                            <button 
                                className="absolute left-2 md:-left-12 z-10 text-white bg-black/50 p-2 rounded-full hover:bg-black/80 transition-all"
                                onClick={() => setExpandedImageIndex(i => i === 0 ? expandedImages.length - 1 : i - 1)}
                            >
                                <ChevronLeft size={32} />
                            </button>
                        )}
                        
                        <img src={expandedImages[expandedImageIndex]} alt={`Capa ${expandedImageIndex + 1}`} className="max-w-full max-h-[90vh] rounded-lg shadow-2xl object-contain ring-1 ring-white/20 select-none" />
                        
                        {expandedImages.length > 1 && (
                            <button 
                                className="absolute right-2 md:-right-12 z-10 text-white bg-black/50 p-2 rounded-full hover:bg-black/80 transition-all"
                                onClick={() => setExpandedImageIndex(i => i === expandedImages.length - 1 ? 0 : i + 1)}
                            >
                                <ChevronRight size={32} />
                            </button>
                        )}
                    </div>
                    
                    {expandedImages.length > 1 && (
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            {expandedImages.map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setExpandedImageIndex(idx)}
                                    className={`w-2.5 h-2.5 rounded-full transition-all ${idx === expandedImageIndex ? 'bg-white scale-125' : 'bg-white/40 hover:bg-white/60'}`}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Modal de Sinopse (Descrição) */}
            {viewDescription && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in slide-in-from-bottom-4 duration-200" onClick={() => setViewDescription(null)}>
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2"><Info size={18} className="text-blue-500" /> Sinopse da Obra</h3>
                            <button className="text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors" onClick={() => setViewDescription(null)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 max-h-[60vh] overflow-y-auto">
                            <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-sm whitespace-pre-wrap">{viewDescription}</p>
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-right">
                            <button onClick={() => setViewDescription(null)} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors text-sm">Fechar</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Modal de Confirmação Unificado (Reutilizável) */}
            {confirmModal.show && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200 text-center">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse ${
                            confirmModal.type === 'danger' ? 'bg-red-500/10 text-red-500' : 
                            confirmModal.type === 'warning' ? 'bg-amber-500/10 text-amber-500' : 
                            'bg-blue-500/10 text-blue-500'
                        }`}>
                            <AlertTriangle size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{confirmModal.title}</h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                            {confirmModal.message}
                        </p>
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={() => confirmModal.onConfirm()}
                                className={`w-full py-3.5 text-white rounded-xl font-bold transition-all shadow-lg active:scale-95 ${
                                    confirmModal.type === 'danger' ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : 
                                    confirmModal.type === 'warning' ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' : 
                                    'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                                }`}
                            >
                                {confirmModal.confirmText}
                            </button>
                            <button 
                                onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                                className="w-full py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white rounded-xl font-bold transition-all border border-slate-200 dark:border-slate-700"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Sistema de Toasts (Notificações) */}
            {toast.show && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[110] animate-in slide-in-from-top-4 duration-300">
                    <div className={`px-6 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 backdrop-blur-md ${
                        toast.type === 'success' ? 'bg-emerald-500/90 border-emerald-400 text-white' :
                        toast.type === 'error' ? 'bg-red-500/90 border-red-400 text-white' :
                        'bg-blue-600/90 border-blue-400 text-white'
                    }`}>
                        <div className="bg-white/20 p-1 rounded-full">
                            {toast.type === 'success' ? <CheckSquare size={16} /> : <Info size={16} />}
                        </div>
                        <span className="text-sm font-bold whitespace-nowrap">{toast.message}</span>
                        <button onClick={() => setToast(prev => ({ ...prev, show: false }))} className="ml-2 hover:opacity-70 transition-opacity">
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Produtos;
