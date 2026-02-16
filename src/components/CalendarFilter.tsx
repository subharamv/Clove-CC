import React, { useState } from 'react';

export type DateFilterType = 'all' | 'week' | 'month' | 'custom';

interface CalendarFilterProps {
    onDateRangeChange: (startDate: string, endDate: string, filterType: DateFilterType) => void;
}

const CalendarFilter: React.FC<CalendarFilterProps> = ({ onDateRangeChange }) => {
    const [filterType, setFilterType] = useState<DateFilterType>('all');
    const [startDate, setStartDate] = useState(getDefaultStartDate('month'));
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [isOpen, setIsOpen] = useState(false);

    function getDefaultStartDate(type: DateFilterType): string {
        const today = new Date();
        const startOfDay = new Date(today);

        if (type === 'week') {
            const dayOfWeek = today.getDay();
            const daysBack = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = 0
            startOfDay.setDate(startOfDay.getDate() - daysBack);
        } else if (type === 'month') {
            startOfDay.setDate(1);
        }

        return startOfDay.toISOString().split('T')[0];
    }

    const handleFilterTypeChange = (newType: DateFilterType) => {
        setFilterType(newType);
        const today = new Date().toISOString().split('T')[0];

        if (newType === 'all') {
            onDateRangeChange('', '', 'all');
        } else if (newType === 'week') {
            const newStartDate = getDefaultStartDate('week');
            setStartDate(newStartDate);
            setEndDate(today);
            onDateRangeChange(newStartDate, today, 'week');
        } else if (newType === 'month') {
            const newStartDate = getDefaultStartDate('month');
            setStartDate(newStartDate);
            setEndDate(today);
            onDateRangeChange(newStartDate, today, 'month');
        }
    };

    const handleCustomDateChange = (type: 'start' | 'end', value: string) => {
        if (type === 'start') {
            setStartDate(value);
        } else {
            setEndDate(value);
        }

        if (filterType === 'custom') {
            const start = type === 'start' ? value : startDate;
            const end = type === 'end' ? value : endDate;
            if (start && end) {
                onDateRangeChange(start, end, 'custom');
            }
        }
    };

    const handleApplyCustom = () => {
        if (startDate && endDate) {
            if (new Date(startDate) <= new Date(endDate)) {
                onDateRangeChange(startDate, endDate, 'custom');
                setIsOpen(false);
            } else {
                alert('Start date must be before end date');
            }
        }
    };

    const getFilterLabel = () => {
        switch (filterType) {
            case 'week':
                return 'This Week';
            case 'month':
                return 'This Month';
            case 'custom':
                return `${startDate} to ${endDate}`;
            default:
                return 'All Time';
        }
    };

    return (
        <div className="relative w-full">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition flex items-center gap-2 justify-start whitespace-nowrap overflow-hidden"
            >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="truncate">{getFilterLabel()}</span>
            </button>

            {isOpen && (
                <div className="absolute left-0 right-0 mt-2 w-full sm:w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-50 p-6">
                    <div className="space-y-4">
                        {/* Filter Type Options */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-3">Filter By</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => handleFilterTypeChange('all')}
                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${filterType === 'all'
                                        ? 'bg-orange-100 text-orange-700 border border-orange-300'
                                        : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                                        }`}
                                >
                                    All Time
                                </button>
                                <button
                                    onClick={() => handleFilterTypeChange('week')}
                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${filterType === 'week'
                                        ? 'bg-orange-100 text-orange-700 border border-orange-300'
                                        : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                                        }`}
                                >
                                    This Week
                                </button>
                                <button
                                    onClick={() => handleFilterTypeChange('month')}
                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${filterType === 'month'
                                        ? 'bg-orange-100 text-orange-700 border border-orange-300'
                                        : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                                        }`}
                                >
                                    This Month
                                </button>
                                <button
                                    onClick={() => setFilterType('custom')}
                                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${filterType === 'custom'
                                        ? 'bg-orange-100 text-orange-700 border border-orange-300'
                                        : 'bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100'
                                        }`}
                                >
                                    Custom Range
                                </button>
                            </div>
                        </div>

                        {/* Custom Date Range */}
                        {filterType === 'custom' && (
                            <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Start Date</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => handleCustomDateChange('start', e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-orange-500 focus:border-orange-500 transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">End Date</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => handleCustomDateChange('end', e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-orange-500 focus:border-orange-500 transition"
                                    />
                                </div>
                                <button
                                    onClick={handleApplyCustom}
                                    className="w-full px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition"
                                >
                                    Apply
                                </button>
                            </div>
                        )}

                        {/* Close Button */}
                        <button
                            onClick={() => setIsOpen(false)}
                            className="w-full px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CalendarFilter;
