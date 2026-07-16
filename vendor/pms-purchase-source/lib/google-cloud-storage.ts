import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';

// Standalone Actinium-Ruby mirrors this layout in `Actinium-Ruby/lib/actinium/gcs_layout.rb` (keep paths in sync).

const GCS_KEY_FILE_PATH = path.join(process.cwd(), 'google-drive-key.json');

/**
 * Site prefix for GCS paths so actinium-sm.com, actinium-sm.org, and actinium-sm.net can share the same bucket without mixing files.
 * Set GCS_SITE_PREFIX explicitly (e.g. "sites/actinium-sm-com", "sites/actinium-sm-org", "sites/actinium-sm-net"), or it is derived from NEXT_PUBLIC_APP_URL.
 */
export function getGcsSitePrefix(): string {
  const explicit = process.env.GCS_SITE_PREFIX;
  if (explicit && typeof explicit === 'string') return explicit.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  if (appUrl.includes('actinium-sm.com')) return 'sites/actinium-sm-org';
  if (appUrl.includes('actinium-sm.org')) return 'sites/actinium-sm-org';
  if (appUrl.includes('actinium-sm.net')) return 'sites/actinium-sm-net';
  return '';
}

/** Prepend site prefix to a relative GCS path when using a shared bucket for multiple sites. */
export function prefixGcsPath(relativePath: string): string {
  const prefix = getGcsSitePrefix();
  if (!prefix) return relativePath;
  return relativePath.startsWith(prefix + '/') ? relativePath : `${prefix}/${relativePath}`;
}

/** Returns true if GCS can be used (key file exists or GCS_SERVICE_ACCOUNT_KEY env is set). Use this to fall back to inline upload when false. */
export function isGoogleCloudStorageConfigured(): boolean {
  if (fs.existsSync(GCS_KEY_FILE_PATH)) return true;
  const envKey = process.env.GCS_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (!envKey || typeof envKey !== 'string') return false;
  try {
    const parsed = JSON.parse(envKey);
    return !!(parsed && (parsed.client_email || parsed.private_key));
  } catch {
    return false;
  }
}

// Google Cloud Storage service
class GoogleCloudStorageService {
  private storage: Storage;
  private bucketName: string;

  constructor() {
    const envKey = process.env.GCS_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

    // Prefer google-drive-key.json when present (local/dev); otherwise use env (e.g. Vercel with same key content).
    let storageOptions: { keyFilename?: string; credentials?: object; projectId?: string };
    if (fs.existsSync(GCS_KEY_FILE_PATH)) {
      storageOptions = {
        keyFilename: GCS_KEY_FILE_PATH,
        projectId: process.env.GCS_PROJECT_ID || 'booming-monitor-477407-j7',
      };
    } else if (envKey && typeof envKey === 'string') {
      try {
        const credentials = JSON.parse(envKey);
        storageOptions = {
          credentials,
          projectId: credentials.project_id || process.env.GCS_PROJECT_ID || 'booming-monitor-477407-j7',
        };
      } catch (e) {
        console.error('❌ Invalid GCS_SERVICE_ACCOUNT_KEY / GOOGLE_APPLICATION_CREDENTIALS_JSON:', e);
        throw new Error('Google Cloud Storage credentials invalid (invalid JSON in env)');
      }
    } else {
      console.warn('⚠️ Google Cloud Storage not configured: no google-drive-key.json and no GCS_SERVICE_ACCOUNT_KEY (or GOOGLE_APPLICATION_CREDENTIALS_JSON) env.');
      throw new Error('Google Cloud Storage key file not found');
    }

    try {
      this.storage = new Storage(storageOptions);
      this.bucketName = process.env.GCS_BUCKET_NAME || 'actinium_sm';
      console.log('✅ Google Cloud Storage initialized:', {
        bucketName: this.bucketName,
        source: storageOptions.keyFilename ? 'keyFile' : 'env',
      });
    } catch (error) {
      console.error('❌ Error initializing Google Cloud Storage service:', error);
      throw error;
    }
  }

  /**
   * Set CORS configuration on the bucket
   * This allows cross-origin requests from browsers
   */
  async setCorsConfiguration() {
    try {
      const bucket = this.storage.bucket(this.bucketName);

      const corsConfiguration = [
        {
          maxAgeSeconds: 3600, // Cache preflight requests for 1 hour
          method: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
          origin: ['*'], // Allow all origins, or specify your domain: ['https://yourdomain.com']
          responseHeader: ['Content-Type', 'Content-Length', 'Content-Disposition', 'Authorization'],
        },
      ];

      await bucket.setCorsConfiguration(corsConfiguration);

      console.log('✅ CORS configuration set successfully on bucket:', {
        bucketName: this.bucketName,
        corsRules: corsConfiguration,
      });

      return {
        success: true,
        bucketName: this.bucketName,
        corsConfiguration,
      };
    } catch (error) {
      console.error('❌ Error setting CORS configuration:', error);
      throw error;
    }
  }

  /**
   * Get current CORS configuration
   */
  async getCorsConfiguration() {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const [metadata] = await bucket.getMetadata();
      const cors = metadata.cors || [];

      console.log('📋 Current CORS configuration:', {
        bucketName: this.bucketName,
        corsRules: cors,
      });

      return cors;
    } catch (error) {
      console.error('❌ Error getting CORS configuration:', error);
      throw error;
    }
  }

  /**
   * Upload a file to Google Cloud Storage with organized folder structure
   * @param file - File buffer or stream
   * @param fileName - Name of the file
   * @param mimeType - MIME type of the file
   * @param options - Upload options including vesselId and category
   * @returns Promise with file URL and metadata
   */
  async uploadFile(
    file: Buffer | NodeJS.ReadableStream,
    fileName: string,
    mimeType: string,
    options?: {
      vesselId?: string;
      category?: 'certificates' | 'old-certificates' | 'archived-certificates' | 'technical' | 'purchase' | 'invoices' | 'defect-reports' | 'drydock-drawings' | 'drydock-jobs' | 'hseq' | 'crewing' | 'inspections' | 'other';
      subfolder?: string;
    }
  ): Promise<{
    fileUrl: string;
    downloadUrl: string;
    publicUrl: string;
    bucketName: string;
    fileName: string;
  }> {
    try {
      const bucket = this.storage.bucket(this.bucketName);

      // Generate unique filename with timestamp
      const timestamp = Date.now();
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      
      // Build folder structure: vessels/{vesselId}/{category}/{filename}
      let folderPath = '';
      
      if (options?.vesselId) {
        // Vessel-specific folder structure
        const vesselFolder = `vessels/${options.vesselId}`;
        const category = options.category || 'other';
        folderPath = `${vesselFolder}/${category}`;
        
        // Add subfolder if provided (e.g., for purchase/invoices)
        if (options.subfolder) {
          folderPath = `${folderPath}/${options.subfolder}`;
        }
      } else {
        // Fallback: use generic folder structure
        const category = options?.category || 'other';
        folderPath = category;
        if (options?.subfolder) {
          folderPath = `${folderPath}/${options.subfolder}`;
        }
      }
      
      const uniqueFileName = prefixGcsPath(`${folderPath}/${timestamp}-${sanitizedFileName}`);

      // Create file reference
      const fileRef = bucket.file(uniqueFileName);

      // Upload options
      const uploadOptions = {
        metadata: {
          contentType: mimeType,
          cacheControl: 'public, max-age=31536000', // Cache for 1 year
        },
      };

      // Upload file
      let stream: NodeJS.ReadableStream;
      if (Buffer.isBuffer(file)) {
        // Convert Buffer to stream
        const { Readable } = require('stream');
        stream = Readable.from(file);
      } else {
        stream = file;
      }

      await new Promise<void>((resolve, reject) => {
        stream
          .pipe(fileRef.createWriteStream(uploadOptions))
          .on('error', (error) => reject(error))
          .on('finish', () => resolve());
      });

      // Try to make file publicly accessible
      // Note: This will fail if uniform bucket-level access is enabled
      // In that case, use signed URLs or bucket-level IAM permissions
      let isPublic = false;
      try {
        await fileRef.makePublic();
        isPublic = true;
        console.log('✅ File made publicly accessible');
      } catch (publicError: any) {
        if (publicError?.code === 400 && publicError?.message?.includes('uniform bucket-level access')) {
          console.log('ℹ️  Uniform bucket-level access enabled - using public URL (bucket must be public or use IAM)');
          // File URL will still work if bucket/folder has public access
          isPublic = true; // Assume public if bucket is configured for public access
        } else {
          console.warn('⚠️  Could not make file public:', publicError?.message || 'Unknown error');
          // Continue anyway - file might still be accessible via signed URLs or IAM
        }
      }

      // Get public URL (works if bucket/folder is public or uniform bucket-level access allows it)
      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${uniqueFileName}`;
      const downloadUrl = publicUrl;
      const fileUrl = publicUrl;

      console.log('✅ File uploaded to Google Cloud Storage:', {
        fileName: uniqueFileName,
        bucketName: this.bucketName,
        publicUrl,
        size: Buffer.isBuffer(file) ? file.length : 'stream',
      });

      return {
        fileUrl,
        downloadUrl,
        publicUrl,
        bucketName: this.bucketName,
        fileName: uniqueFileName,
      };
    } catch (error) {
      console.error('❌ Error uploading file to Google Cloud Storage:', error);
      throw error;
    }
  }

  /**
   * Upload a readable stream to an exact object path in the bucket (path must already include
   * site prefix if you use {@link prefixGcsPath}). Used for large exports (e.g. vessel NDJSON)
   * where {@link uploadFile}’s vessels/... folder layout is not appropriate.
   */
  async uploadStreamToObjectPath(
    objectPath: string,
    stream: NodeJS.ReadableStream,
    contentType: string
  ): Promise<{ objectPath: string; bucketName: string }> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const fileRef = bucket.file(objectPath);
      const uploadOptions = {
        metadata: {
          contentType: contentType.trim() || 'application/octet-stream',
          cacheControl: 'no-store',
        },
      };

      await new Promise<void>((resolve, reject) => {
        stream
          .pipe(fileRef.createWriteStream(uploadOptions))
          .on('error', (err) => reject(err))
          .on('finish', () => resolve());
      });

      console.log('✅ Stream uploaded to Google Cloud Storage:', {
        objectPath,
        bucketName: this.bucketName,
      });

      return { objectPath, bucketName: this.bucketName };
    } catch (error) {
      console.error('❌ Error uploading stream to Google Cloud Storage:', error);
      throw error;
    }
  }

  /**
   * Delete a file from Google Cloud Storage
   * @param fileName - Name of the file in the bucket
   */
  async deleteFile(fileName: string): Promise<void> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      await bucket.file(fileName).delete();

      console.log('✅ File deleted from Google Cloud Storage:', fileName);
    } catch (error) {
      console.error('❌ Error deleting file from Google Cloud Storage:', error);
      throw error;
    }
  }

  /**
   * Get file metadata
   * @param fileName - Name of the file in the bucket
   */
  async getFileMetadata(fileName: string): Promise<any> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const [metadata] = await bucket.file(fileName).getMetadata();

      return metadata;
    } catch (error) {
      console.error('❌ Error getting file metadata:', error);
      throw error;
    }
  }

  /**
   * Generate a signed URL for temporary access (read)
   * @param fileName - Name of the file in the bucket
   * @param expiresInMinutes - URL expiration time in minutes (default: 60)
   */
  async getSignedUrl(fileName: string, expiresInMinutes: number = 60): Promise<string> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);

      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + expiresInMinutes * 60 * 1000,
      });

      return url;
    } catch (error) {
      console.error('❌ Error generating signed URL:', error);
      throw error;
    }
  }

  /**
   * Generate a signed URL for direct client upload (PUT).
   * Client uploads the file to this URL; no file passes through the server.
   * @param filePath - Full path in bucket (e.g. drydock/quotes/projectId/quoteId/timestamp-filename.xlsx)
   * @param mimeType - Content-Type for the upload
   * @param expiresInMinutes - URL expiration (default: 15)
   */
  async getSignedUploadUrl(
    filePath: string,
    mimeType: string,
    expiresInMinutes: number = 15
  ): Promise<string> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(filePath);
      const contentType = (mimeType || 'application/octet-stream').trim();

      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + expiresInMinutes * 60 * 1000,
        contentType,
      });

      return url;
    } catch (error) {
      console.error('❌ Error generating signed upload URL:', error);
      throw error;
    }
  }

  /**
   * Check if a file exists in the bucket (without downloading)
   * @param fileName - Name/path of the file in the bucket
   */
  async fileExists(fileName: string): Promise<boolean> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);
      const [exists] = await file.exists();
      return !!exists;
    } catch {
      return false;
    }
  }

  /**
   * Get the object path inside the bucket from a full fileUrl.
   * e.g. https://storage.googleapis.com/actinium_sm/drydock/quotes/.../file.xlsx -> drydock/quotes/.../file.xlsx
   */
  getPathFromFileUrl(fileUrl: string | null): string | null {
    if (!fileUrl) return null;
    const prefix = `https://storage.googleapis.com/${this.bucketName}/`;
    return fileUrl.startsWith(prefix) ? fileUrl.slice(prefix.length) : null;
  }

  /**
   * Download a file from Google Cloud Storage
   * @param fileName - Name of the file in the bucket (path)
   * @returns Buffer containing the file data
   */
  async downloadFile(fileName: string): Promise<Buffer> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);

      // Check if file exists
      const [exists] = await file.exists();
      if (!exists) {
        throw new Error(`File not found: ${fileName}`);
      }

      // Download file as buffer
      const [buffer] = await file.download();

      console.log('✅ File downloaded from Google Cloud Storage:', {
        fileName,
        size: buffer.length,
      });

      return buffer;
    } catch (error) {
      console.error('❌ Error downloading file from Google Cloud Storage:', error);
      throw error;
    }
  }

  /**
   * Download a file from GCS in chunks (streaming). Use for large files to avoid loading
   * the entire response in memory at once. Returns the full buffer for saving to DB or analysis.
   * @param fileName - Name of the file in the bucket (path)
   * @param chunkSizeBytes - Size of each read chunk (default 512KB)
   */
  async downloadFileInChunks(fileName: string, chunkSizeBytes: number = 512 * 1024): Promise<Buffer> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);

      const [exists] = await file.exists();
      if (!exists) {
        throw new Error(`File not found: ${fileName}`);
      }

      const stream = file.createReadStream({ highWaterMark: chunkSizeBytes });
      const chunks: Buffer[] = [];
      let totalLength = 0;

      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
          totalLength += chunk.length;
        });
        stream.on('end', () => resolve());
        stream.on('error', reject);
      });

      const buffer = Buffer.concat(chunks, totalLength);
      console.log('✅ File downloaded from GCS in chunks:', { fileName, size: buffer.length });
      return buffer;
    } catch (error) {
      console.error('❌ Error downloading file from GCS (chunked):', error);
      throw error;
    }
  }

  /**
   * Create folder structure by creating placeholder files
   * In GCS, folders are implicit (prefixes), but we create placeholder files to ensure structure exists
   * @param folderPath - Path to the folder (e.g., 'vessels/{vesselId}/certificates')
   */
  async createFolder(folderPath: string): Promise<void> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const prefixedPath = prefixGcsPath(folderPath);
      // Ensure folder path ends with a slash
      const normalizedPath = prefixedPath.endsWith('/') ? prefixedPath : `${prefixedPath}/`;
      
      // Create a placeholder file to ensure the folder exists
      // Use a hidden file that won't interfere with actual uploads
      const placeholderFileName = `${normalizedPath}.folder-placeholder`;
      const file = bucket.file(placeholderFileName);
      
      // Check if placeholder already exists
      const [exists] = await file.exists();
      if (exists) {
        console.log(`📁 Folder already exists: ${normalizedPath}`);
        return;
      }
      
      // Create empty placeholder file
      await file.save('', {
        metadata: {
          contentType: 'application/x-directory',
          cacheControl: 'no-cache',
        },
      });
      
      console.log(`✅ Folder created: ${normalizedPath}`);
    } catch (error) {
      console.error(`❌ Error creating folder ${folderPath}:`, error);
      // Don't throw - folder creation is not critical, files will create folders automatically
    }
  }

  /**
   * Initialize folder structure for a vessel
   * Creates all required folders: certificates, old-certificates, archived-certificates, technical, purchase, invoices, defect-reports
   * @param vesselId - Vessel ID
   */
  async initializeVesselFolders(vesselId: string): Promise<void> {
    try {
      const folders = [
        'certificates',
        'old-certificates',
        'archived-certificates',
        'technical',
        'purchase',
        'invoices',
        'defect-reports',
      ];

      console.log(`📁 Initializing folder structure for vessel: ${vesselId}`);
      
      for (const folder of folders) {
        const folderPath = `vessels/${vesselId}/${folder}`;
        await this.createFolder(folderPath);
      }
      
      console.log(`✅ All folders initialized for vessel: ${vesselId}`);
    } catch (error) {
      console.error(`❌ Error initializing vessel folders for ${vesselId}:`, error);
      // Don't throw - folder creation is not critical
    }
  }

  /**
   * Initialize folder structure for a company
   * Creates company-level folders if needed
   * @param companyId - Company ID
   */
  async initializeCompanyFolders(companyId: string): Promise<void> {
    try {
      const folders = [
        'documents',
        'reports',
        'archives',
      ];

      console.log(`📁 Initializing folder structure for company: ${companyId}`);
      
      for (const folder of folders) {
        const folderPath = `companies/${companyId}/${folder}`;
        await this.createFolder(folderPath);
      }
      
      console.log(`✅ All folders initialized for company: ${companyId}`);
    } catch (error) {
      console.error(`❌ Error initializing company folders for ${companyId}:`, error);
      // Don't throw - folder creation is not critical
    }
  }
  /**
   * Upload a buffer directly to GCS (for JSON reports, sync history, etc.)
   * @param buffer - Buffer to upload
   * @param objectPath - Full GCS object path (e.g., sync-history/ABTA/2026-05-17.json)
   * @param contentType - MIME type
   */
  async uploadBuffer(
    buffer: Buffer,
    objectPath: string,
    contentType: string = 'application/json'
  ): Promise<{ objectPath: string; bucketName: string }> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const fileRef = bucket.file(objectPath);

      await fileRef.save(buffer, {
        metadata: {
          contentType,
          cacheControl: 'no-store',
        },
      });

      console.log('✅ Buffer uploaded to Google Cloud Storage:', {
        objectPath,
        bucketName: this.bucketName,
        size: buffer.length,
      });

      return { objectPath, bucketName: this.bucketName };
    } catch (error) {
      console.error('❌ Error uploading buffer to Google Cloud Storage:', error);
      throw error;
    }
  }

  /**
   * Get the public URL for a GCS object.
   */
  getPublicUrl(objectPath: string): string {
    return `https://storage.googleapis.com/${this.bucketName}/${objectPath}`;
  }
}

// Singleton instance
let googleCloudStorageService: GoogleCloudStorageService | null = null;

/**
 * Get Google Cloud Storage service instance
 */
export function getGoogleCloudStorageService(): GoogleCloudStorageService {
  if (!googleCloudStorageService) {
    googleCloudStorageService = new GoogleCloudStorageService();
  }
  return googleCloudStorageService;
}

/**
 * Set CORS configuration on the bucket
 * Call this function once to configure CORS for your bucket
 */
export async function setBucketCors() {
  const storage = getGoogleCloudStorageService();
  return await storage.setCorsConfiguration();
}

export default GoogleCloudStorageService;

