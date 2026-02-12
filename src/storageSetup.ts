import { supabaseClient } from './supabaseClient';

const BUCKET_NAME = 'coupon-templates';

/**
 * Setup the coupon-templates storage bucket
 * This function creates the bucket if it doesn't exist
 * NOTE: You still need to run the RLS policies from SETUP_COMPLETE_STORAGE.sql
 */
export async function setupCouponTemplatesBucket() {
    try {
        // Check if bucket already exists
        const { data: buckets, error: listError } = await supabaseClient.storage.listBuckets();

        if (listError) {
            console.error('❌ Error listing buckets:', listError);
            return false;
        }

        const bucketExists = buckets?.some(b => b.name === BUCKET_NAME);

        if (!bucketExists) {
            // Create the bucket
            const { data, error } = await supabaseClient.storage.createBucket(BUCKET_NAME, {
                public: true,
                fileSizeLimit: 5242880, // 5MB in bytes
                allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
            });

            if (error) {
                console.error('❌ Error creating bucket:', error);
                return false;
            }

            console.log('✓ Storage bucket created:', data);
            console.log('⚠️  NEXT STEP: Run SETUP_COMPLETE_STORAGE.sql in Supabase SQL Editor to set up RLS policies');
        } else {
            console.log('✓ Storage bucket already exists');
        }
        return true;
    } catch (error) {
        console.error('❌ Storage setup error:', error);
        return false;
    }
}

/**
 * Upload a coupon template image to storage
 */
export async function uploadCouponTemplate(file: File, fileName: string) {
    console.log('🚀 uploadCouponTemplate called', { fileName, fileSize: file.size, fileType: file.type });
    try {
        // Verify user is authenticated
        console.log('🔐 Checking session...');
        const { data: { session }, error: authError } = await supabaseClient.auth.getSession();
        const user = session?.user;
        
        if (authError || !user) {
            console.error('❌ Auth error or no user:', authError);
            throw new Error('User must be authenticated to upload. Please login first.');
        }
        console.log('👤 Authenticated as:', user.email);

        // Create unique filename to prevent conflicts
        const timestamp = Date.now();
        const safeName = `${user.id}-${timestamp}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '-')}`;
        const filePath = safeName; // Upload to root of bucket for simplicity

        console.log('📤 Uploading to:', filePath, 'in bucket:', BUCKET_NAME);

        // Add a timeout to the upload promise
        console.log('⏱️ Starting upload with 30s timeout...');
        const uploadPromise = supabaseClient.storage
            .from(BUCKET_NAME)
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false,
            });

        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => {
                console.error('⏰ Upload timeout triggered after 30s');
                reject(new Error('Upload timed out after 30 seconds. This might be due to network issues or incorrect Supabase Storage permissions.'));
            }, 30000)
        );

        const response = await Promise.race([uploadPromise, timeoutPromise]) as any;
        console.log('📡 Supabase response received:', response);

        const { data, error } = response || {};

        if (error) {
            console.error('❌ Upload error details:', error);
            if (error.message?.includes('row-level security') || error.error === 'Permission denied' || (error.status === 403)) {
                throw new Error('Permission denied (403). Please ensure you have run SETUP_COMPLETE_STORAGE.sql in Supabase SQL Editor to set up RLS policies.');
            }
            if (error.message?.includes('bucket not found') || error.status === 404) {
                throw new Error(`Storage bucket "${BUCKET_NAME}" not found. Please ensure the bucket exists and is public.`);
            }
            throw error;
        }

        if (!data) {
            console.warn('⚠️ No data returned from upload');
        }

        console.log('✅ Upload successful, data:', data);

        // Get public URL
        console.log('🔗 Generating public URL...');
        const { data: publicData } = supabaseClient.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);

        if (!publicData?.publicUrl) {
            console.warn('⚠️ Could not generate public URL');
        }

        console.log('✨ Final URL:', publicData?.publicUrl);

        return {
            path: data?.path,
            url: publicData?.publicUrl,
        };
    } catch (error: any) {
        console.error('💥 Final catch in uploadCouponTemplate:', error);
        throw error;
    }
}

/**
 * Delete a coupon template image from storage
 */
export async function deleteCouponTemplate(fileName: string) {
    try {
        const { error } = await supabaseClient.storage
            .from(BUCKET_NAME)
            .remove([fileName]);

        if (error) throw error;
        console.log('✓ File deleted');
    } catch (error) {
        console.error('❌ Delete error:', error);
        throw error;
    }
}

/**
 * Get public URL for a coupon template
 */
export function getCouponTemplateUrl(fileName: string) {
    const { data } = supabaseClient.storage
        .from(BUCKET_NAME)
        .getPublicUrl(fileName);

    return data?.publicUrl;
}

/**
 * List all coupon templates
 */
export async function listCouponTemplates() {
    try {
        const { data, error } = await supabaseClient.storage
            .from(BUCKET_NAME)
            .list();

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('❌ List error:', error);
        return [];
    }
}
