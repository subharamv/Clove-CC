/**
 * Currency utilities for proper rupees symbol rendering
 * Uses Unicode character U+20B9 (₹) with explicit UTF-8 handling
 */

// Export the rupees symbol as a constant
export const RUPEES_SYMBOL = '₹';

/**
 * Format an amount as Indian Rupees
 * @param amount - The numeric amount to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string like "₹100.00"
 */
export function formatRupees(amount: number, decimals: number = 2): string {
    return `${RUPEES_SYMBOL}${amount.toFixed(decimals)}`;
}

/**
 * Get the rupees symbol safely encoded
 * @returns The rupees symbol (₹)
 */
export function getRupeeSymbol(): string {
    return RUPEES_SYMBOL;
}
