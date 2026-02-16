import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Employee, CouponStatus } from '../types';
import { supabase } from '../supabaseClient';
import { CheckCircle, XCircle, Info, QrCode, History, Play, Square, Trash2, RefreshCcw } from 'lucide-react';
import { formatRupees } from '../utils/currencyUtils';
import { playBeep } from '../utils/soundUtils';

interface ScanCouponProps {
    onRefresh: () => Promise<void> | void;
    onNavigateToHistory?: () => void;
}

const ScanCoupon: React.FC<ScanCouponProps> = ({ onRefresh, onNavigateToHistory }) => {
    const [scannedCoupons, setScannedCoupons] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [mode, setMode] = useState<'camera' | 'gallery'>('camera');
    const [cameras, setCameras] = useState<Array<{ id: string; label?: string }>>([]);
    const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
    const [isCameraRunning, setIsCameraRunning] = useState(false);
    const html5QrRef = useRef<Html5Qrcode | null>(null);
    const lastScannedCode = useRef<string | null>(null);
    const scanTimeout = useRef<any>(null);

    useEffect(() => {
        let mounted = true;

        const init = async () => {
            try {
                const cams = await Html5Qrcode.getCameras().catch(() => []);
                if (!mounted) return;
                
                if (Array.isArray(cams) && cams.length > 0) {
                    setCameras(cams.map(c => ({ id: c.id, label: c.label })));

                    // detect mobile to prefer back camera
                    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
                    let preferredIndex = 0;
                    if (isMobile) {
                        const backIndex = cams.findIndex(c => /back|rear|environment/i.test(c.label || ''));
                        if (backIndex >= 0) preferredIndex = backIndex;
                    }
                    setCurrentCameraIndex(preferredIndex);
                    
                    // Auto-start camera after detecting
                    setTimeout(() => {
                        if (mounted) startCameraAtIndex(preferredIndex);
                    }, 500);
                } else {
                    console.warn('No cameras found during initialization');
                    if (mode === 'camera') {
                        setError('No camera detected on this device. Please use Gallery mode or ensure camera is connected.');
                    }
                }
            } catch (err) {
                console.warn('Could not get cameras', err);
                if (mounted && mode === 'camera') {
                    setError('Unable to access camera hardware. Please check permissions.');
                }
            }
        };

        init();

        return () => {
            mounted = false;
            // Use a safe cleanup
            if (html5QrRef.current) {
                if (html5QrRef.current.isScanning) {
                    html5QrRef.current.stop().catch(() => {});
                }
            }
            if (scanTimeout.current) clearTimeout(scanTimeout.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // start camera helper
    const startCameraAtIndex = async (index: number) => {
        // Safe stop before restarting
        if (html5QrRef.current && html5QrRef.current.isScanning) {
            try { await html5QrRef.current.stop(); } catch(e) {}
        }
        
        setError(null);
        setSuccess(null);

        const readerId = 'reader';
        const readerElem = document.getElementById(readerId);
        if (readerElem) {
            readerElem.style.display = 'block';
        }

        // Initialize scanner if not already created
        if (!html5QrRef.current) {
            html5QrRef.current = new Html5Qrcode(readerId);
        }
        
        const qrboxFunction = (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const qrboxSize = Math.floor(minEdge * 0.7);
            return { width: qrboxSize, height: qrboxSize };
        };

        const config = { 
            fps: 15, 
            qrbox: qrboxFunction,
            aspectRatio: 1.0,
            rememberLastUsedCamera: true,
            supportedScanTypes: [0]
        };

        try {
            const cam = cameras[index];
            const cameraConstraint = (cam && cam.id) ? { deviceId: { exact: cam.id } } : { facingMode: 'environment' };
            
            await html5QrRef.current.start(
                cameraConstraint as any,
                config,
                onScanSuccess,
                onScanFailure
            );
            
            setIsCameraRunning(true);
            setError(null);
        } catch (err: any) {
            console.error('Failed to start camera', err);
            
            // Try fallback to generic environment camera
            try {
                if (html5QrRef.current && !html5QrRef.current.isScanning) {
                    await html5QrRef.current.start(
                        { facingMode: 'environment' },
                        config,
                        onScanSuccess,
                        onScanFailure
                    );
                    setIsCameraRunning(true);
                    setError(null);
                    return;
                }
            } catch (fallbackErr) {
                console.error('Fallback camera start failed', fallbackErr);
            }

            setIsCameraRunning(false);
            const errorMsg = err?.message || '';
            if (errorMsg.includes('NotAllowedError') || errorMsg.includes('Permission')) {
                setError('Camera permission denied. Please allow camera access.');
            } else {
                setError('Unable to access camera. Please use Gallery mode.');
            }
        }
    };

    const stopCamera = () => {
        if (html5QrRef.current) {
            // Only attempt to stop if it's actually running
            if (html5QrRef.current.isScanning) {
                html5QrRef.current.stop().catch((e) => {
                    console.warn('Error stopping camera:', e);
                }).finally(() => {
                    try { html5QrRef.current?.clear(); } catch (e) { }
                    html5QrRef.current = null;
                });
            } else {
                try { html5QrRef.current.clear(); } catch (e) { }
                html5QrRef.current = null;
            }
        }
        setIsCameraRunning(false);
    };

    const onScanSuccess = async (decodedText: string) => {
        // Prevent duplicate scans within a short period
        if (decodedText === lastScannedCode.current) return;
        
        lastScannedCode.current = decodedText;
        if (scanTimeout.current) clearTimeout(scanTimeout.current);
        scanTimeout.current = setTimeout(() => {
            lastScannedCode.current = null;
        }, 3000);

        playBeep('scan');
        setLoading(true);
        setError(null);

        try {
            // Check if the decoded text is a serial code or an ID
            const { data, error: fetchError } = await supabase
                .from('coupons')
                .select('*')
                .eq('serial_code', decodedText)
                .single();

            let couponData = data;
            if (fetchError) {
                const { data: dataById, error: fetchErrorById } = await supabase
                    .from('coupons')
                    .select('*')
                    .eq('id', decodedText)
                    .single();

                if (fetchErrorById) {
                    playBeep('error');
                    throw new Error('Invalid coupon or not found');
                }
                couponData = dataById;
            }

            if (couponData.status === CouponStatus.SETTLED) {
                playBeep('error');
                throw new Error('This coupon is already SETTLED');
            }

            if (couponData.status === CouponStatus.RECEIVED) {
                playBeep('error');
                throw new Error('This coupon has already been RECEIVED');
            }

            // Mark as received automatically
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');

            const { error: updateError } = await supabase
                .from('coupons')
                .update({
                    status: CouponStatus.RECEIVED,
                    received_at: new Date().toISOString(),
                    received_by: user.id
                })
                .eq('id', couponData.id);

            if (updateError) throw updateError;

            playBeep('success');
            const employee = transformRow(couponData);
            employee.status = CouponStatus.RECEIVED;
            
            setScannedCoupons(prev => [employee, ...prev]);
            setSuccess(`Verified: ${employee.name}`);
            
            if (onRefresh) onRefresh();

        } catch (err: any) {
            setError(err.message || 'Scan failed');
        } finally {
            setLoading(false);
        }
    };

    const transformRow = (row: any): Employee => ({
        id: row.id,
        name: row.name || '',
        empId: row.emp_id || '',
        otHours: row.ot_hours || 0,
        amount: row.amount || 0,
        status: row.status || CouponStatus.PENDING,
        serialCode: row.serial_code || '',
        issueDate: row.issue_date || '',
        validTill: row.valid_till || '',
        created_at: row.created_at,
        couponImageUrl: row.coupon_image_url
    });

    const onScanFailure = (error: any) => {
        // console.warn(`Code scan error = ${error}`);
    };

    const handleModeChange = async (next: 'camera' | 'gallery') => {
        setError(null);
        setSuccess(null);
        setMode(next);
        stopCamera();
    };

    const switchCamera = async () => {
        if (!cameras || cameras.length <= 1) return;
        const next = (currentCameraIndex + 1) % cameras.length;
        setCurrentCameraIndex(next);
        if (isCameraRunning) {
            await startCameraAtIndex(next);
        }
    };

    const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setError(null);
        setSuccess(null);
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
            const decoded = await scanImageFile(file);
            if (decoded) await onScanSuccess(decoded);
            else {
                playBeep('error');
                setError('No QR code found in image');
            }
        } catch (err: any) {
            playBeep('error');
            setError(err?.message || 'No QR code found in image');
        } finally {
            e.currentTarget.value = '';
        }
    };

    // Scans an image file for QR code. Tries BarcodeDetector first, falls back to jsQR loaded from CDN.
    const scanImageFile = async (file: File): Promise<string | null> => {
        // load image
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.src = objectUrl;
        await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = (e) => reject(new Error('Failed to load image'));
        });

        // draw to canvas
        const maxDim = 1600;
        let w = img.naturalWidth;
        let h = img.naturalHeight;
        const scale = Math.min(1, maxDim / Math.max(w, h));
        w = Math.max(1, Math.floor(w * scale));
        h = Math.max(1, Math.floor(h * scale));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas not supported');
        ctx.drawImage(img, 0, 0, w, h);

        // Try BarcodeDetector if available
        try {
            const BD = (window as any).BarcodeDetector;
            if (BD) {
                const detector = new BD({ formats: ['qr_code'] });
                const results = await detector.detect(canvas as any);
                if (results && results.length) {
                    URL.revokeObjectURL(objectUrl);
                    return results[0].rawValue || results[0].rawvalue || null;
                }
            }
        } catch (e) {
            // ignore and fallback
        }

        // Fallback: load jsQR from CDN if needed
        const ensureJsQr = async () => {
            if ((window as any).jsQR) return (window as any).jsQR;
            await new Promise<void>((resolve, reject) => {
                const s = document.createElement('script');
                s.src = 'https://unpkg.com/jsqr/dist/jsQR.js';
                s.async = true;
                s.onload = () => resolve();
                s.onerror = () => reject(new Error('Failed to load jsQR'));
                document.head.appendChild(s);
            });
            return (window as any).jsQR;
        };

        const jsQR = await ensureJsQr();
        const imageData = ctx.getImageData(0, 0, w, h);
        const code = jsQR(imageData.data, w, h);
        URL.revokeObjectURL(objectUrl);
        return code ? code.data : null;
    };

    return (
        <div className="flex flex-col desktop:flex-row min-h-screen bg-slate-50">
            {/* Main Content - Scanner */}
            <div className="flex-1 p-4 md:p-8">
                <div className="max-w-2xl mx-auto">
                    <header className="mb-6 flex justify-between items-start">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                                <QrCode className="text-orange-600" />
                                Scan Coupon
                            </h1>
                            <p className="text-slate-500 text-sm">Verify employee coupons by scanning QR codes.</p>
                        </div>
                        {onNavigateToHistory && (
                            <button
                                onClick={onNavigateToHistory}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition shadow-sm"
                            >
                                <History size={18} />
                                View History
                            </button>
                        )}
                    </header>

                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 overflow-hidden mt-4">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                                <button
                                    onClick={() => handleModeChange('camera')}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition ${mode === 'camera' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>
                                    Camera
                                </button>
                                <button
                                    onClick={() => handleModeChange('gallery')}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition ${mode === 'gallery' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>
                                    Gallery
                                </button>
                            </div>

                            {mode === 'camera' && (
                                <div className="flex gap-2">
                                    {/* Always show switch button on mobile OR if multiple cameras detected */}
                                    {(cameras.length > 1 || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) && (
                                        <button 
                                            onClick={switchCamera}
                                            className="p-2 bg-slate-50 hover:bg-slate-100 rounded-lg text-indigo-600 border border-slate-200 transition-colors shadow-sm"
                                            title="Switch Camera"
                                        >
                                            <RefreshCcw size={20} />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="relative">
                            <div 
                                id="reader" 
                                className={`w-full overflow-hidden rounded-2xl bg-slate-900 ${!isCameraRunning && mode === 'camera' ? 'opacity-0 h-0' : 'opacity-100'}`} 
                                style={{ minHeight: mode === 'camera' ? 300 : 0 }}
                            ></div>
                            
                            {!isCameraRunning && mode === 'camera' && (
                                <div className="w-full aspect-video bg-slate-100 rounded-2xl flex flex-col items-center justify-center border-2 border-dashed border-slate-200">
                                    <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                                        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                                    </div>
                                    <p className="text-slate-500 font-bold">Starting Camera...</p>
                                    <p className="text-slate-400 text-xs mt-1">Please ensure you have granted camera permissions.</p>
                                </div>
                            )}

                            {mode === 'gallery' && (
                                <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
                                    <input 
                                        type="file" 
                                        id="gallery-input"
                                        accept="image/*" 
                                        onChange={onFileChange} 
                                        className="hidden" 
                                    />
                                    <label 
                                        htmlFor="gallery-input"
                                        className="cursor-pointer flex flex-col items-center"
                                    >
                                        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4 text-indigo-600">
                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        </div>
                                        <p className="font-bold text-indigo-600">Choose Image</p>
                                        <p className="text-slate-400 text-xs mt-1">Select an image containing a QR code</p>
                                    </label>
                                </div>
                            )}

                            {loading && (
                                <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center z-10 rounded-2xl">
                                    <div className="flex flex-col items-center">
                                        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-2"></div>
                                        <p className="text-indigo-600 font-bold text-xs">Verifying...</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-2xl flex flex-col gap-3 text-red-700 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-start gap-3">
                                <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-sm font-bold">{error}</p>
                                    <p className="text-[10px] mt-1 opacity-70 italic">Try refreshing the page or checking if your browser has camera permissions enabled for this site.</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => startCameraAtIndex(currentCameraIndex)}
                                className="text-xs font-black bg-white border border-red-200 py-2 rounded-xl hover:bg-red-100 transition shadow-sm"
                            >
                                🔄 Retry Camera Access
                            </button>
                        </div>
                    )}

                    {success && !error && (
                        <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-emerald-700 animate-in fade-in slide-in-from-top-2">
                            <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <p className="text-sm font-bold">{success}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Sidebar - Scanned List */}
            <div className="w-full desktop:w-96 bg-white border-l border-slate-200 p-6 flex flex-col h-[calc(100vh-64px)] desktop:h-screen">
                <div className="flex items-center justify-between mb-6 border-b pb-4">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Info className="w-5 h-5 text-slate-400" />
                        Recently Scanned
                    </h2>
                    <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-bold">
                        {scannedCoupons.length}
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                    {scannedCoupons.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-100 rounded-3xl">
                            <QrCode className="w-12 h-12 text-slate-200 mb-4" />
                            <p className="text-slate-400 font-medium">No coupons scanned yet</p>
                            <p className="text-slate-300 text-xs mt-2">Verified coupons will appear here automatically.</p>
                        </div>
                    ) : (
                        scannedCoupons.map((coupon, idx) => (
                            <div key={`${coupon.id}-${idx}`} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition group relative">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="font-bold text-slate-900">{coupon.name}</p>
                                        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{coupon.empId}</p>
                                    </div>
                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold">
                                        {formatRupees(coupon.amount)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-[10px]">
                                    <span className="font-mono text-slate-400">{coupon.serialCode}</span>
                                    <span className="text-slate-400 font-medium">
                                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <button 
                                    onClick={() => setScannedCoupons(prev => prev.filter((_, i) => i !== idx))}
                                    className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-red-600 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {scannedCoupons.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-slate-100">
                        <div className="flex justify-between items-center mb-4">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Session Total</p>
                            <p className="text-xl font-black text-emerald-600">
                                {formatRupees(scannedCoupons.reduce((sum, c) => sum + c.amount, 0))}
                            </p>
                        </div>
                        <button 
                            onClick={() => setScannedCoupons([])}
                            className="w-full py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
                        >
                            Clear Session
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ScanCoupon;
