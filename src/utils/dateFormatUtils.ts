/**
 * Date formatting utilities
 */

/**
 * Convert date string to dd-mm-yyyy format
 * Handles multiple input formats:
 * - YYYY-MM-DD (ISO format)
 * - DD/MM/YYYY
 * - DD-MM-YYYY
 * - MM/DD/YYYY
 */
export const formatDateToDDMMYYYY = (dateString: string): string => {
    if (!dateString || typeof dateString !== 'string') {
        return '';
    }

    try {
        let date: Date;

        // Try to parse as ISO format (YYYY-MM-DD)
        if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
            date = new Date(dateString);
        }
        // Try to parse as DD/MM/YYYY or DD-MM-YYYY
        else if (dateString.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})$/)) {
            const parts = dateString.split(/[-\/]/);
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);
            date = new Date(year, month - 1, day);
        }
        // Try to parse as MM/DD/YYYY (US format)
        else if (dateString.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)) {
            // Assume this is day/month/year format (most common in India)
            const parts = dateString.split('/');
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10);
            const year = parseInt(parts[2], 10);
            date = new Date(year, month - 1, day);
        } else {
            // Try generic parsing
            date = new Date(dateString);
        }

        // Check if valid date
        if (isNaN(date.getTime())) {
            return dateString; // Return original if parsing fails
        }

        // Format as DD-MM-YYYY
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();

        return `${day}-${month}-${year}`;
    } catch (error) {
        console.warn('Error formatting date:', dateString, error);
        return dateString; // Return original on error
    }
};

/**
 * Convert date string to dd/mm/yyyy format (with slashes)
 */
export const formatDateToDDMMYYYYSlash = (dateString: string): string => {
    const formatted = formatDateToDDMMYYYY(dateString);
    return formatted.replace(/-/g, '/');
};
