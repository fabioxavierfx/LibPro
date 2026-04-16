import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';

interface ScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (decodedText: string) => void;
}

export const ScannerModal = ({ isOpen, onClose, onScan }: ScannerModalProps) => {
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
    const isStoppingRef = useRef(false);

    const playSound = (type: 'success' | 'error') => {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        if (type === 'success') {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1);
        }
    };

    const stopScanner = async () => {
        if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning && !isStoppingRef.current) {
            isStoppingRef.current = true;
            try {
                await html5QrCodeRef.current.stop();
                html5QrCodeRef.current.clear();
            } catch (err: any) {
                console.warn("Aviso ao parar scanner:", err);
            } finally {
                isStoppingRef.current = false;
            }
        }
    };

    useEffect(() => {
        if (isOpen) {
            // Pequeno delay para garantir que a div no DOM já esteja visível
            setTimeout(async () => {
                try {
                    const elementId = `global-scanner-reader`;
                    const element = document.getElementById(elementId);

                    if (!element) {
                        toast.error("Elemento do scanner não encontrado no DOM");
                        onClose();
                        return;
                    }

                    const html5QrCode = new Html5Qrcode(elementId);
                    html5QrCodeRef.current = html5QrCode;

                    const devices = await Html5Qrcode.getCameras();
                    if (devices && devices.length) {
                        let cameraId = devices[0].id;
                        const backCamera = devices.find(d =>
                            d.label.toLowerCase().includes('back') ||
                            d.label.toLowerCase().includes('traseira')
                        );
                        if (backCamera) cameraId = backCamera.id;

                        await html5QrCode.start(
                            cameraId,
                            {
                                fps: 10,
                                qrbox: { width: 250, height: 150 },
                            },
                            (decodedText) => {
                                playSound('success');
                                stopScanner().then(() => {
                                    onScan(decodedText);
                                    // onClose será chamado pelo pai (se desejar) ou chamamos aqui
                                });
                            },
                            () => { }
                        );
                    } else {
                        toast.error("Nenhuma câmera encontrada");
                        onClose();
                    }
                } catch (err) {
                    toast.error("Erro ao iniciar scanner");
                    console.error("Erro ao iniciar scanner:", err);
                    onClose();
                }
            }, 300);
        } else {
            stopScanner();
        }

        return () => {
            stopScanner();
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl w-full max-w-sm relative overflow-hidden shadow-2xl">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 p-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded-full text-slate-500 hover:text-rose-500 transition-colors"
                >
                    <X size={24} />
                </button>
                <div className="text-center mb-6 mt-2">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Escanear Código</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Aponte a câmera para o código de barras ou QR Code do produto</p>
                </div>
                <div className="rounded-2xl overflow-hidden bg-black relative shadow-inner min-h-[300px] flex items-center justify-center">
                    <div id="global-scanner-reader" className="w-full [&>video]:object-cover"></div>
                    <div className="absolute inset-0 border-2 border-indigo-500/30 rounded-2xl pointer-events-none z-10"></div>
                    <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-indigo-500/50 -translate-y-1/2 shadow-[0_0_15px_rgba(99,102,241,0.5)] z-10 pointer-events-none"></div>
                </div>
            </div>
        </div>
    );
};
