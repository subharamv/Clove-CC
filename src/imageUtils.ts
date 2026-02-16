import { supabase } from './supabaseClient';

// Default template if no custom template is uploaded
export const DEFAULT_TEMPLATE = 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=800&q=80';

/**
 * Get template image URL for a user
 * Falls back to default if not found
 */
export const getTemplateImageUrl = async (userId?: string): Promise<string> => {
    try {
        if (!userId) {
            const { data: { user } } = await supabase.auth.getUser();
            userId = user?.id;
        }

        if (!userId) return DEFAULT_TEMPLATE;

        const { data: profile } = await supabase
            .from('profiles')
            .select('template_image_url')
            .eq('user_id', userId)
            .maybeSingle();

        return profile?.template_image_url || DEFAULT_TEMPLATE;
    } catch (err) {
        console.warn('Error loading template image:', err);
        return DEFAULT_TEMPLATE;
    }
};

/**
 * Check if bucket exists and create if needed
 */
export const ensureStorageBucket = async (bucketName: string): Promise<void> => {
    try {
        // Try to get bucket info
        const { data, error } = await supabase.storage.getBucket(bucketName);

        if (error && error.message.includes('not found')) {
            // Bucket doesn't exist - user needs to create it manually
            console.warn(`Storage bucket "${bucketName}" does not exist. Please create it in Supabase Dashboard.`);
        }
    } catch (err) {
        console.warn(`Could not check storage bucket: ${bucketName}`, err);
    }
};

/**
 * Generate a coupon image with serial code overlay
 */
export const generateCouponImage = async (
    templateUrl: string,
    serialCode: string,
    couponName: string
): Promise<string> => {
    try {
        // Create canvas for image composition
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');

        // Load template image
        const img = new Image();
        img.crossOrigin = 'anonymous';

        return new Promise((resolve, reject) => {
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;

                // Draw template
                ctx.drawImage(img, 0, 0);

                // Draw semi-transparent overlay for text
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.fillRect(50, canvas.height - 120, canvas.width - 100, 100);

                // Draw serial code
                ctx.fillStyle = '#1e293b';
                ctx.font = 'bold 48px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(serialCode, canvas.width / 2, canvas.height - 40);

                // Draw coupon name
                ctx.font = '16px sans-serif';
                ctx.fillStyle = '#64748b';
                ctx.fillText(couponName, canvas.width / 2, canvas.height - 65);

                resolve(canvas.toDataURL('image/png'));
            };

            img.onerror = () => {
                reject(new Error('Could not load template image'));
            };

            img.src = templateUrl;
        });
    } catch (err) {
        console.error('Error generating coupon image:', err);
        throw err;
    }
};
