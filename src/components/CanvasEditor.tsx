import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SystemSettings } from '../types';

interface DataElement {
    id: string;
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fontSize: number;
    color: string;
    fontWeight: 'normal' | 'bold';
}

interface CanvasEditorProps {
    templateUrl: string;
    settings: SystemSettings;
    onUpdatePositions: (elements: DataElement[]) => void;
}

const CanvasEditor: React.FC<CanvasEditorProps> = ({
    templateUrl,
    settings,
    onUpdatePositions
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Initial elements
    const defaultElements: DataElement[] = [
        { id: 'name', label: 'Employee Name', x: 241, y: 326, width: 300, height: 50, fontSize: 48, color: '#1e293b', fontWeight: 'bold' },
        { id: 'empId', label: 'Employee ID', x: 220, y: 398, width: 300, height: 50, fontSize: 48, color: '#1e293b', fontWeight: 'bold' },
        { id: 'date', label: 'Issue Date', x: 220, y: 517, width: 250, height: 30, fontSize: 24, color: '#1e293b', fontWeight: 'bold' },
        { id: 'serial', label: 'Serial Code', x: 778, y: 141, width: 200, height: 40, fontSize: 36, color: '#334155', fontWeight: 'bold' },
        { id: 'amount', label: 'Amount', x: 740, y: 251, width: 250, height: 60, fontSize: 56, color: '#059669', fontWeight: 'bold' }
    ];

    const [elements, setElements] = useState<DataElement[]>(() => {
        let initialElements = settings.templateElements && settings.templateElements.length > 0
            ? [...settings.templateElements]
            : [...defaultElements];

        // Handle QR element based on settings
        const qrExists = initialElements.some(el => el.id === 'qr');
        if (settings.qrEnabled && !qrExists) {
            initialElements.push({ id: 'qr', label: 'QR Code', x: 800, y: 400, width: 150, height: 150, fontSize: 12, color: '#000000', fontWeight: 'normal' });
        } else if (!settings.qrEnabled && qrExists) {
            initialElements = initialElements.filter(el => el.id !== 'qr');
        }

        // Handle Amount element visibility based on settings
        const amountExists = initialElements.some(el => el.id === 'amount');
        if (settings.amountVisible !== false && !amountExists) {
            initialElements.push({ id: 'amount', label: 'Amount', x: 740, y: 251, width: 250, height: 60, fontSize: 56, color: '#059669', fontWeight: 'bold' });
        } else if (settings.amountVisible === false && amountExists) {
            initialElements = initialElements.filter(el => el.id !== 'amount');
        }

        return initialElements;
    });

    // Update local elements if settings change
    useEffect(() => {
        setElements(prev => {
            let updatedElements = settings.templateElements && settings.templateElements.length > 0
                ? [...settings.templateElements]
                : prev;

            const qrExists = updatedElements.some(el => el.id === 'qr');

            if (settings.qrEnabled && !qrExists) {
                updatedElements.push({ id: 'qr', label: 'QR Code', x: 800, y: 400, width: 150, height: 150, fontSize: 12, color: '#000000', fontWeight: 'normal' });
            } else if (!settings.qrEnabled && qrExists) {
                updatedElements = updatedElements.filter(el => el.id !== 'qr');
            }

            const amountExists = updatedElements.some(el => el.id === 'amount');
            if (settings.amountVisible !== false && !amountExists) {
                updatedElements.push({ id: 'amount', label: 'Amount', x: 740, y: 251, width: 250, height: 60, fontSize: 56, color: '#059669', fontWeight: 'bold' });
            } else if (settings.amountVisible === false && amountExists) {
                updatedElements = updatedElements.filter(el => el.id !== 'amount');
            }

            return updatedElements;
        });
    }, [settings.templateElements, settings.qrEnabled, settings.amountVisible]);

    const [selectedId, setSelectedId] = useState<string | null>('name');
    const [dragging, setDragging] = useState(false);
    const [resizing, setResizing] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [templateImage, setTemplateImage] = useState<HTMLImageElement | null>(null);
    const [zoom, setZoom] = useState(0.5);
    const [isEditMode, setIsEditMode] = useState(false);

    // Load template image
    useEffect(() => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => setTemplateImage(img);
        img.onerror = () => console.warn('Failed to load template:', templateUrl);
        img.src = templateUrl;
    }, [templateUrl]);

    // Draw canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !templateImage) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw template at scaled size
        const scaledWidth = 1048 * zoom;
        const scaledHeight = 598 * zoom;
        ctx.drawImage(templateImage, 0, 0, scaledWidth, scaledHeight);

        // Draw element boundaries and labels
        elements.forEach((el) => {
            const x = el.x * zoom;
            const y = el.y * zoom;
            const width = el.width * zoom;
            const height = el.height * zoom;

            // Draw border
            ctx.strokeStyle = selectedId === el.id ? '#f97316' : '#cbd5e1';
            ctx.lineWidth = selectedId === el.id ? 3 : 2;
            ctx.strokeRect(x, y, width, height);

            // Special drawing for QR Code
            if (el.id === 'qr') {
                ctx.fillStyle = 'rgba(0,0,0,0.05)';
                ctx.fillRect(x, y, width, height);

                // Draw QR-like patterns
                ctx.fillStyle = '#cbd5e1';
                const pSize = width / 5;
                ctx.fillRect(x + pSize, y + pSize, pSize, pSize);
                ctx.fillRect(x + width - 2 * pSize, y + pSize, pSize, pSize);
                ctx.fillRect(x + pSize, y + height - 2 * pSize, pSize, pSize);
                ctx.fillRect(x + width / 2 - pSize / 2, y + height / 2 - pSize / 2, pSize, pSize);
            }

            // Draw label
            ctx.fillStyle = selectedId === el.id ? '#f97316' : '#64748b';
            ctx.font = '12px Arial';
            ctx.fillText(el.label, x + 5, y - 5);

            // Draw resize handle
            if (selectedId === el.id) {
                ctx.fillStyle = '#f97316';
                ctx.fillRect(x + width - 8, y + height - 8, 8, 8);
            }
        });
    }, [templateImage, elements, selectedId, zoom]);

    // Mouse events for dragging and resizing
    const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / zoom;
        const y = (e.clientY - rect.top) / zoom;

        // Check if clicking on selected element's resize handle
        if (selectedId) {
            const element = elements.find(el => el.id === selectedId);
            if (element) {
                const handleX = element.x + element.width;
                const handleY = element.y + element.height;
                if (x >= handleX - 8 && x <= handleX && y >= handleY - 8 && y <= handleY) {
                    setResizing(true);
                    return;
                }
            }
        }

        // Check if clicking on any element
        const clickedElement = elements.find(el => {
            return x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height;
        });

        if (clickedElement) {
            setSelectedId(clickedElement.id);
            setDragging(true);
            setDragOffset({
                x: x - clickedElement.x,
                y: y - clickedElement.y
            });
        }
    }, [elements, selectedId, zoom]);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas || !selectedId) return;

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / zoom;
        const y = (e.clientY - rect.top) / zoom;

        setElements(prev => prev.map(el => {
            if (el.id !== selectedId) return el;

            if (dragging) {
                return {
                    ...el,
                    x: Math.max(0, x - dragOffset.x),
                    y: Math.max(0, y - dragOffset.y)
                };
            }

            if (resizing) {
                return {
                    ...el,
                    width: Math.max(50, x - el.x),
                    height: Math.max(30, y - el.y)
                };
            }

            return el;
        }));
    }, [selectedId, dragging, resizing, dragOffset, zoom]);

    const handleMouseUp = () => {
        setDragging(false);
        setResizing(false);
    };

    const updateElement = (id: string, updates: Partial<DataElement>) => {
        setElements(prev => prev.map(el => el.id === id ? { ...el, ...updates } : el));
    };

    const handleSave = () => {
        onUpdatePositions(elements);
    };

    const selected = elements.find(el => el.id === selectedId);

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-900">Template Editor</h3>
                    <button
                        onClick={() => setIsEditMode(!isEditMode)}
                        className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${isEditMode
                            ? 'bg-orange-100 text-orange-700 border border-orange-300'
                            : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                            }`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        {isEditMode ? 'Close Editor' : 'Edit Layout'}
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Canvas Area */}
                    <div
                        ref={containerRef}
                        className="border-2 border-slate-300 rounded-xl bg-slate-50 overflow-auto"
                        style={{ height: '500px' }}
                    >
                        <canvas
                            ref={canvasRef}
                            width={Math.floor(1048 * zoom)}
                            height={Math.floor(598 * zoom)}
                            onMouseDown={isEditMode ? handleCanvasMouseDown : undefined}
                            onMouseMove={isEditMode ? handleMouseMove : undefined}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            className={`${isEditMode ? 'cursor-move' : 'cursor-default'} bg-white`}
                            style={{ display: 'block', margin: 'auto' }}
                        />
                    </div>

                    {/* Controls - Only shown when in edit mode */}
                    {isEditMode && (
                        <>
                            {/* Zoom Control */}
                            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <label className="text-sm font-medium text-slate-700">Zoom:</label>
                                <input
                                    type="range"
                                    min="0.25"
                                    max="1.5"
                                    step="0.25"
                                    value={zoom}
                                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                                    className="flex-1"
                                />
                                <span className="text-sm text-slate-600 w-12">{Math.round(zoom * 100)}%</span>
                            </div>

                            {/* Elements List */}
                            <div className="space-y-3">
                                <h4 className="font-semibold text-slate-900 text-sm">Data Elements</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    {elements.map(el => (
                                        <button
                                            key={el.id}
                                            onClick={() => setSelectedId(el.id)}
                                            className={`p-3 rounded-lg text-left text-sm transition-all border ${selectedId === el.id
                                                ? 'bg-orange-50 border-orange-300 text-orange-900 font-medium'
                                                : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                                                }`}
                                        >
                                            {el.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Selected Element Properties */}
                            {selected && (
                                <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg p-4 space-y-4 border border-orange-200">
                                    <h4 className="font-semibold text-slate-900">Properties: {selected.label}</h4>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 mb-1">X Position</label>
                                            <input
                                                type="number"
                                                value={selected.x}
                                                onChange={(e) => updateElement(selected.id, { x: parseInt(e.target.value) })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-orange-500 focus:border-orange-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 mb-1">Y Position</label>
                                            <input
                                                type="number"
                                                value={selected.y}
                                                onChange={(e) => updateElement(selected.id, { y: parseInt(e.target.value) })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-orange-500 focus:border-orange-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 mb-1">Width</label>
                                            <input
                                                type="number"
                                                value={selected.width}
                                                onChange={(e) => updateElement(selected.id, { width: parseInt(e.target.value) })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-orange-500 focus:border-orange-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 mb-1">Height</label>
                                            <input
                                                type="number"
                                                value={selected.height}
                                                onChange={(e) => updateElement(selected.id, { height: parseInt(e.target.value) })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-orange-500 focus:border-orange-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 mb-1">Font Size</label>
                                            <input
                                                type="number"
                                                value={selected.fontSize}
                                                onChange={(e) => updateElement(selected.id, { fontSize: parseInt(e.target.value) })}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-orange-500 focus:border-orange-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-700 mb-1">Color</label>
                                            <input
                                                type="color"
                                                value={selected.color}
                                                onChange={(e) => updateElement(selected.id, { color: e.target.value })}
                                                className="w-full h-10 border border-slate-300 rounded-lg cursor-pointer"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Save Button */}
                            <button
                                onClick={handleSave}
                                className="w-full px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold transition-colors shadow-lg shadow-orange-100"
                            >
                                Save Template Layout
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CanvasEditor;
