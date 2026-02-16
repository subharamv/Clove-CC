/**
 * Parse dates in various formats commonly found in CSV files
 * Supports: dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd, mm/dd/yyyy, etc.
 */
export function parseDateFromCSV(dateString: string): string | null {
    if (!dateString || typeof dateString !== 'string') return null;

    const trimmed = dateString.trim();
    if (!trimmed) return null;

    // Try to parse various date formats
    const separators = ['/', '-'];

    for (const separator of separators) {
        const parts = trimmed.split(separator);

        if (parts.length === 3) {
            const [part1, part2, part3] = parts.map(p => parseInt(p, 10));

            // Check if all parts are valid numbers
            if (isNaN(part1) || isNaN(part2) || isNaN(part3)) continue;

            let day, month, year;

            // Try to determine the format
            // Format: dd/mm/yyyy or dd-mm-yyyy (day in 1-31 range, month in 1-12 range)
            if (part1 > 0 && part1 <= 31 && part2 > 0 && part2 <= 12) {
                day = part1;
                month = part2;
                year = part3;
            }
            // Format: yyyy/mm/dd or yyyy-mm-dd (year > 1900, month in 1-12)
            else if (part1 > 1900 && part2 > 0 && part2 <= 12 && part3 > 0 && part3 <= 31) {
                year = part1;
                month = part2;
                day = part3;
            }
            // Format: mm/dd/yyyy (US format - month in 1-12, day in 1-31)
            else if (part1 > 0 && part1 <= 12 && part2 > 0 && part2 <= 31 && part3 > 1900) {
                month = part1;
                day = part2;
                year = part3;
            }
            else {
                continue;
            }

            // Validate the date
            try {
                const date = new Date(year, month - 1, day);
                // Check if the date is valid (getMonth returns 0-11, so we check against month-1)
                if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
                    // Return in YYYY-MM-DD format using local components to avoid timezone shift
                    const m = String(month).padStart(2, '0');
                    const d = String(day).padStart(2, '0');
                    return `${year}-${m}-${d}`;
                }
            } catch (e) {
                continue;
            }
        }
    }

    // Try parsing as ISO format (YYYY-MM-DD)
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
        const [, year, month, day] = isoMatch;
        try {
            const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
            if (date.getFullYear() === parseInt(year, 10) &&
                date.getMonth() === parseInt(month, 10) - 1 &&
                date.getDate() === parseInt(day, 10)) {
                return trimmed; // Already in YYYY-MM-DD format
            }
        } catch (e) {
            // continue
        }
    }

    return null;
}

/**
 * Format a date string to YYYY-MM-DD format
 * If date is already in YYYY-MM-DD format, return as-is
 */
export function formatDateToISO(date: string | Date): string {
    if (typeof date === 'string') {
        const parsed = parseDateFromCSV(date);
        return parsed || formatDateToISO(new Date());
    }

    if (date instanceof Date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    return formatDateToISO(new Date());
}

/**
 * Get date range for validity period in YYYY-MM-DD format
 */
export function getValidityDate(startDate: string, days: number): string {
    // Parse the start date components manually to avoid timezone issues
    let year, month, day;
    const parts = startDate.split(/[-/]/);
    
    if (parts.length === 3) {
        if (parts[0].length === 4) { // YYYY-MM-DD
            year = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10);
            day = parseInt(parts[2], 10);
        } else if (parts[2].length === 4) { // DD-MM-YYYY or MM-DD-YYYY
            // Assume DD-MM-YYYY as per parseDateFromCSV default for 3 parts
            day = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10);
            year = parseInt(parts[2], 10);
        } else {
            // Fallback
            const d = new Date(startDate);
            year = d.getFullYear();
            month = d.getMonth() + 1;
            day = d.getDate();
        }
    } else {
        const d = new Date(startDate);
        year = d.getFullYear();
        month = d.getMonth() + 1;
        day = d.getDate();
    }
    
    // Create date using local components
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + days);
    
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d_str = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d_str}`;
}
