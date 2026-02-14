/**
 * Date formatting utilities
 */

/**
 * Convert date string or Date object to dd-mm-yyyy format
 * Handles multiple input formats:
 * - Date object
 * - YYYY-MM-DD (ISO format)
 * - DD/MM/YYYY
 * - DD-MM-YYYY
 * - MM/DD/YYYY
 */
export const formatDateToDDMMYYYY = (dateInput: string | Date): string => {
    if (!dateInput) {
        return '';
    }

    try {
        let date: Date;

        if (dateInput instanceof Date) {
            date = dateInput;
        } else {
            const dateString = String(dateInput).trim();
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
                const parts = dateString.split('/');
                const month = parseInt(parts[0], 10);
                const day = parseInt(parts[1], 10);
                const year = parseInt(parts[2], 10);
                date = new Date(year, month - 1, day);
            } else {
                // Try generic parsing
                date = new Date(dateString);
            }
        }

        // Check if valid date
        if (isNaN(date.getTime())) {
            return String(dateInput); // Return original if parsing fails
        }

        // Format as DD-MM-YYYY
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();

        return `${day}-${month}-${year}`;
    } catch (error) {
        console.warn('Error formatting date:', dateInput, error);
        return String(dateInput); // Return original on error
    }
};

/**
 * Convert date string to dd/mm/yyyy format (with slashes) - DEPRECATED: prefer dd-mm-yyyy
 */
export const formatDateToDDMMYYYYSlash = (dateString: string): string => {
    return formatDateToDDMMYYYY(dateString).replace(/-/g, '/');
};
