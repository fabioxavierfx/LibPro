import toast from 'react-hot-toast';

export interface ReportItem {
    productId: string;
    sku: string;
    description: string;
    currentCount: number;
    previousCount?: number;
}

export interface Report {
    id: string;
    type: 'inventory' | 'tested' | 'delivery';
    createdAt: any;
    updatedAt: any;
    totalItems: number;
    items: ReportItem[];
    userName?: string;
    title?: string;
    locationId?: string;
    locationName?: string;
    notes?: string;
    sequentialId?: number;
    imageUrls?: string[];
}

const getBase64FromUrl = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generatePdfBlob = async (report: Report, sequentialId: number, includeImages: boolean = true, allProducts?: any[]): Promise<Blob> => {
    const dateText = report.createdAt?.toDate ? report.createdAt.toDate().toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');

    let defaultTitle = `Relatório #${sequentialId}`;
    if (report.type === 'inventory') defaultTitle = `Inventário #${sequentialId}`;
    if (report.type === 'delivery') defaultTitle = `Entrega #${sequentialId}`;
    if (report.type === 'tested') defaultTitle = `Testados #${sequentialId}`;

    const reportTitle = report.title || defaultTitle;
    const sortedItems = [...report.items].sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true, sensitivity: 'base' }));

    const doc = new jsPDF();
    
    // Título e sub-cabeçalhos
    doc.setFontSize(18);
    doc.text(reportTitle, 14, 20);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    let currentY = 28;
    if (report.type === 'inventory' && report.locationName) {
        doc.text(`Local: ${report.locationName}`, 14, currentY);
        currentY += 6;
    }
    doc.text(`Data: ${dateText}`, 14, currentY);
    doc.text(`Total de Itens: ${report.totalItems}`, 140, currentY);
    currentY += 10;

    if (report.notes) {
        doc.text(`Observações: ${report.notes}`, 14, currentY);
        currentY += 10;
    }

    // Configurar colunas da tabela conforme o tipo
    let head = [[] as string[]];
    let body = [] as any[];

    if (report.type === 'inventory') {
        head[0] = ['SKU/ISBN', 'Título', 'Categoria', 'Conserv./Tipo', 'Local/ID', 'Ok'];
        body = sortedItems.map(item => {
            const fullProduct = allProducts?.find((p: any) => p.sku === item.sku || p.id === item.productId) || {};
            const skuText = fullProduct.ean ? `${item.sku}\n${fullProduct.ean}` : item.sku;
            const titleBase = fullProduct.title || item.description;
            const authPub = [fullProduct.author, fullProduct.publisher].filter(Boolean).join(' - ');
            const titleText = authPub ? `${titleBase}\n${authPub}` : titleBase;
            const catText = fullProduct.category || '-';
            const consText = `${fullProduct.conservation || '-'}/${fullProduct.type || '-'}`;
            const locText = `${fullProduct.locationId || '-'}\n${fullProduct.identifier || '-'}`;
            return [skuText, titleText, catText, consText, locText, ' [   ]'];
        });
    } else if (report.type === 'tested') {
        head[0] = ['SKU', 'Descrição', 'Qtd Restante', 'Qtd Testada'];
        body = sortedItems.map(item => [item.sku, item.description, (item.previousCount || 0).toString(), item.currentCount.toString()]);
    } else if (report.type === 'delivery') {
        head[0] = ['SKU', 'Descrição', 'Qtd (Recebida)'];
        body = sortedItems.map(item => [item.sku, item.description, item.currentCount.toString()]);
    }

    autoTable(doc, {
        startY: currentY,
        head: head,
        body: body,
        theme: 'grid',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [226, 232, 240], textColor: [51, 51, 51], fontStyle: 'bold' },
        columnStyles: {
            0: { fontStyle: 'bold' },
            5: { halign: 'center', cellWidth: 15 }
        }
    });

    if (includeImages && report.imageUrls && report.imageUrls.length > 0) {
        let finalY = (doc as any).lastAutoTable.finalY + 15;
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        
        if (finalY > pageHeight - 20) {
            doc.addPage();
            finalY = 20;
        }

        doc.setFontSize(14);
        doc.setTextColor(51, 51, 51);
        doc.text('Imagens Anexadas', 14, finalY);
        finalY += 10;

        const margin = 14;
        const imgWidth = (pageWidth - margin * 3) / 2; // Duas colunas
        const maxImgHeight = 85;

        let col = 0;
        for (const url of report.imageUrls) {
            try {
                const base64 = await getBase64FromUrl(url);
                const img = new Image();
                img.src = base64;
                await new Promise((resolve, reject) => { 
                    img.onload = resolve; 
                    img.onerror = reject;
                });

                const ratio = img.width / img.height;
                let renderWidth = imgWidth;
                let renderHeight = renderWidth / ratio;

                if (renderHeight > maxImgHeight) {
                    renderHeight = maxImgHeight;
                    renderWidth = renderHeight * ratio;
                }

                if (finalY + renderHeight > pageHeight - 15) {
                    doc.addPage();
                    finalY = 20;
                    col = 0;
                }

                const xPos = col === 0 ? margin : margin * 2 + imgWidth;
                
                // Centrar horizontalmente na coluna se a imagem ficou mais estreita
                const offsetX = xPos + (imgWidth - renderWidth) / 2;

                doc.addImage(base64, 'JPEG', offsetX, finalY, renderWidth, renderHeight);

                col++;
                if (col > 1) {
                    col = 0;
                    // movemos o Y pelo tamanho máximo desenhado na linha original (usando maxImgHeight como safe net)
                    finalY += renderHeight + 10;
                }
            } catch (e) {
                console.error('Erro ao processar imagem para o PDF nativo:', e);
            }
        }
    }

    return doc.output('blob');
};

export const shareTextReport = async (report: Report, sequentialId: number) => {
    let defaultTitle = `Relatório #${sequentialId}`;
    if (report.type === 'inventory') defaultTitle = `Inventário #${sequentialId}`;
    if (report.type === 'delivery') defaultTitle = `Entrega #${sequentialId}`;
    if (report.type === 'tested') defaultTitle = `Testados #${sequentialId}`;

    const reportTitle = report.title || defaultTitle;
    const dateText = report.createdAt?.toDate ? report.createdAt.toDate().toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');
    
    const shareText = `📊 *${reportTitle}*\n📅 *Data:* ${dateText}\n📝 *Itens:* ${report.totalItems}`;

    if (navigator.share) {
        try {
            await navigator.share({
                title: reportTitle,
                text: shareText
            });
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                if (navigator.clipboard) {
                    await navigator.clipboard.writeText(shareText);
                    toast.success('Resumo copiado para a área de transferência!');
                } else {
                    toast.error('O dispositivo recusou o compartilhamento de texto.');
                }
            }
        }
    } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareText);
        toast.success('Resumo copiado para a área de transferência!');
    } else {
        toast.error('Não é possível compartilhar texto neste navegador.');
    }
};

export const shareReport = async (report: Report, sequentialId: number, includeImages: boolean = true, forceDownload: boolean = false, allProducts?: any[]) => {
    const loadingToast = toast.loading('Gerando PDF para compartilhar...');
    
    try {
        let defaultTitle = `Relatório #${sequentialId}`;
        if (report.type === 'inventory') defaultTitle = `Inventário #${sequentialId}`;
        if (report.type === 'delivery') defaultTitle = `Entrega #${sequentialId}`;
        if (report.type === 'tested') defaultTitle = `Testados #${sequentialId}`;

        const reportTitle = report.title || defaultTitle;

        // Sanitize the title to be used as a filename (remove invalid characters)
        const sanitizedTitle = reportTitle.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');

        const pdfBlob = await generatePdfBlob(report, sequentialId, includeImages, allProducts);
        const pdfFile = new File([pdfBlob], `${sanitizedTitle}.pdf`, { 
            type: 'application/pdf',
            lastModified: new Date().getTime()
        });

        toast.dismiss(loadingToast);

        let sharedSuccessfully = false;

        if (!forceDownload && navigator.share) {
            try {
                // Passando APENAS o 'files' para o navegador abrir a Share Sheet forçando-a no modo Documento/Arquivo
                // Evita problemas de intents (esquema) com o WhatsApp Android
                await navigator.share({
                    files: [pdfFile]
                });
                sharedSuccessfully = true;
            } catch (error: any) {
                if (error.name !== 'AbortError') {
                    console.error("Erro na API de Web Share (Native):", error);
                    // Falhou ao compartilhar (ex: tempo limite cruzado ou negado pelo Android).
                    // Deixa cair para o fallback abaixo.
                } else {
                    // Usuário apenas interagiu e fechou a aba (cancelou)
                    sharedSuccessfully = true;
                }
            }
        }

        if (!sharedSuccessfully) {
            // Se o navegador não suporta compartilhamento de arquivos via File API,
            // então fazemos o download direto do PDF (Adicionado suporte nativo de seleção de pasta se suportado).
            try {
                if ('showSaveFilePicker' in window) {
                    const handle = await (window as any).showSaveFilePicker({
                        suggestedName: `${sanitizedTitle}.pdf`,
                        types: [{
                            description: 'Documento PDF',
                            accept: { 'application/pdf': ['.pdf'] }
                        }]
                    });
                    const writable = await handle.createWritable();
                    await writable.write(pdfBlob);
                    await writable.close();
                    toast.success('PDF salvo com sucesso na pasta selecionada!');
                } else {
                    // Fallback para abrir o PDF nativamente em nova aba no celular
                    toast.success('Abrindo PDF...', { icon: '📄' });
                    const url = URL.createObjectURL(pdfBlob);
                    window.open(url, '_blank');
                    setTimeout(() => URL.revokeObjectURL(url), 60000); // limpeza
                }
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.error("Erro ao salvar arquivo:", err);
                    
                    // Último fallback incondicional
                    toast.success('Abrindo PDF...', { icon: '📄' });
                    const url = URL.createObjectURL(pdfBlob);
                    window.open(url, '_blank');
                    setTimeout(() => URL.revokeObjectURL(url), 60000); // limpeza
                }
            }
            
            try {
                const dateText = report.createdAt?.toDate ? report.createdAt.toDate().toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');
                const shareText = `📊 *${reportTitle}*\n📅 *Data:* ${dateText}\n📝 *Itens:* ${report.totalItems}`;
                if (navigator.clipboard) {
                    await navigator.clipboard.writeText(shareText);
                    toast.success('Resumo copiado! Se desejar, cole-o no corpo da mensagem ao enviar.');
                }
            } catch (err) {
                // ignorar
            }
        }
    } catch (error) {
        toast.dismiss(loadingToast);
        toast.error('O arquivo gerado ficou complexo demais e não pôde ser gerado. Tente remover algumas imagens ou enviar "Sem imagens".', { duration: 6000 });
        console.error("Erro Crítico ao gerar/compartilhar o relatório:", error);
    }
};


export const printWebReport = (report: Report, sequentialId: number, includeImages: boolean = true, allProducts?: any[]) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let defaultTitle = `Relatório #${sequentialId}`;
    if (report.type === 'inventory') defaultTitle = `Inventário #${sequentialId}`;
    if (report.type === 'delivery') defaultTitle = `Entrega #${sequentialId}`;
    if (report.type === 'tested') defaultTitle = `Testados #${sequentialId}`;

    const reportTitle = report.title || defaultTitle;
    const dateText = report.createdAt?.toDate ? report.createdAt.toDate().toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR');

    let tableHeaders = '';
    if (report.type === 'inventory') {
        tableHeaders = `<th>SKU / ISBN</th><th>Título</th><th>Categoria</th><th>Conservação/Tipo</th><th>Local/ID</th><th style="width: 40px; text-align: center">Ok</th>`;
    } else if (report.type === 'tested') {
        tableHeaders = `<th>SKU</th><th>Descrição</th><th>Quantidade Restante</th><th>Quantidade Testada</th>`;
    } else if (report.type === 'delivery') {
        tableHeaders = `<th>SKU</th><th>Descrição</th><th>Quantidade (Recebida)</th>`;
    }

    const sortedItems = [...report.items].sort((a, b) => a.sku.localeCompare(b.sku, undefined, { numeric: true, sensitivity: 'base' }));

    let tableBody = '';
    sortedItems.forEach(item => {
        if (report.type === 'inventory') {
            const fullProduct = allProducts?.find((p: any) => p.sku === item.sku || p.id === item.productId) || {};
            tableBody += `
                <tr>
                    <td style="font-family: monospace; font-weight: bold; white-space: nowrap;">${item.sku}${fullProduct.ean ? `<br/><span style="font-size: 11px; color: #666; font-weight: normal;">${fullProduct.ean}</span>` : ''}</td>
                    <td style="font-weight: bold;">
                        ${fullProduct.title || item.description}
                        ${(fullProduct.author || fullProduct.publisher) ? `<br/><span style="font-size: 11px; font-weight: normal; color: #555;">${[fullProduct.author, fullProduct.publisher].filter(Boolean).join(' - ')}</span>` : ''}
                    </td>
                    <td style="font-size: 12px;">${fullProduct.category || '-'}</td>
                    <td style="font-size: 12px; text-transform: uppercase;">${fullProduct.conservation || '-'}/${fullProduct.type || '-'}</td>
                    <td style="font-size: 12px; white-space: nowrap;">${fullProduct.locationId || '-'} <br/> ${fullProduct.identifier || '-'}</td>
                    <td style="text-align: center; vertical-align: middle;"><div style="width: 20px; height: 20px; border: 2px solid #555; border-radius: 4px; display: inline-block;"></div></td>
                </tr>
            `;
        } else if (report.type === 'tested') {
            const prev = item.previousCount || 0;
            tableBody += `
                <tr>
                    <td>${item.sku}</td>
                    <td>${item.description}</td>
                    <td>${prev}</td>
                    <td>${item.currentCount}</td>
                </tr>
            `;
        } else if (report.type === 'delivery') {
            tableBody += `
                <tr>
                    <td>${item.sku}</td>
                    <td>${item.description}</td>
                    <td>${item.currentCount}</td>
                </tr>
            `;
        }
    });

    const notesHtml = (report.type === 'delivery' && report.notes)
        ? `<div style="margin-top: 15px; padding-top: 10px; border-top: 1px dotted #ccc;">
               <strong>Observações:</strong> ${report.notes}
           </div>`
        : '';

    const locationHtml = (report.type === 'inventory' && report.locationName)
        ? `<p style="margin: 5px 0 0 0; color: #555;"><strong>Local:</strong> ${report.locationName}</p>`
        : '';

    const imagesHtml = (includeImages && report.type === 'delivery' && report.imageUrls && report.imageUrls.length > 0)
        ? `<div style="margin-top: 30px; border-top: 2px solid #333; padding-top: 20px;">
               <h3 style="margin-bottom: 15px;">Imagens Anexadas</h3>
               <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
                   ${report.imageUrls.map(url => `<img src="${url}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; border: 1px solid #ddd;" />`).join('')}
               </div>
           </div>`
        : '';

    const html = `
        <html>
            <head>
                <title>${reportTitle}</title>
                <style>
                    body { font-family: sans-serif; padding: 20px; color: #333; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                    th { background-color: #e2e8f0 !important; }
                    tbody tr:nth-child(even) { background-color: #f2f2f2 !important; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #333; padding-bottom: 10px; }
                    .diff-pos { color: green; font-weight: bold; }
                    .diff-neg { color: red; font-weight: bold; }
                    h1 { margin-bottom: 5px; }
                    @media print {
                        img { break-inside: avoid; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <h1>${reportTitle}</h1>
                        ${locationHtml}
                        <p style="margin-top: 5px;">Data: ${dateText}</p>
                    </div>
                    <div style="text-align: right">
                        <p>Total de Itens: ${report.totalItems}</p>
                    </div>
                </div>
                ${notesHtml}
                <table>
                    <thead>
                        <tr>${tableHeaders}</tr>
                    </thead>
                    <tbody>
                        ${tableBody}
                    </tbody>
                </table>
                ${imagesHtml}
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 250);
                    };
                </script>
            </body>
        </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
};
