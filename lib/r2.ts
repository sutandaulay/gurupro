import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT;
const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL;

const isR2Configured = !!(accessKeyId && secretAccessKey && endpoint && bucketName && publicUrl);

const s3Client = isR2Configured
  ? new S3Client({
      region: 'auto',
      endpoint: endpoint,
      credentials: {
        accessKeyId: accessKeyId!,
        secretAccessKey: secretAccessKey!,
      },
    })
  : null;

export async function uploadToR2(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string
): Promise<string | null> {
  if (!s3Client || !bucketName || !publicUrl) {
    console.warn("Cloudflare R2 is not fully configured. File upload to R2 skipped.");
    return null;
  }

  // Generate unique file path
  const fileExtension = fileName.split('.').pop() || '';
  const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExtension}`;
  const key = `uploads/${uniqueName}`;

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    });

    await s3Client.send(command);

    // Return the public URL
    const url = `${publicUrl.replace(/\/$/, '')}/${key}`;
    return url;
  } catch (error) {
    console.error("Failed to upload file to Cloudflare R2:", error);
    throw error;
  }
}

export async function uploadBase64ToR2(base64Data: string, prefix = 'journals'): Promise<string | null> {
  if (!s3Client || !bucketName || !publicUrl) {
    return null; // fallback to base64
  }

  try {
    const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      // If it's already a URL, return it directly
      if (base64Data.startsWith('http')) return base64Data;
      return null;
    }

    const contentType = match[1];
    const base64Content = match[2];
    const buffer = Buffer.from(base64Content, 'base64');
    
    // Guess file extension from content type
    let extension = 'png';
    if (contentType.includes('jpeg')) extension = 'jpg';
    else if (contentType.includes('pdf')) extension = 'pdf';
    else if (contentType.includes('webp')) extension = 'webp';
    else if (contentType.includes('svg')) extension = 'svg';

    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${extension}`;
    const key = `${prefix}/${uniqueName}`;

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await s3Client.send(command);

    const url = `${publicUrl.replace(/\/$/, '')}/${key}`;
    return url;
  } catch (error) {
    console.error("Failed to upload base64 to Cloudflare R2:", error);
    throw error;
  }
}

export async function uploadToR2WithKey(
  fileBuffer: Buffer,
  key: string,
  contentType: string
): Promise<string | null> {
  if (!s3Client || !bucketName || !publicUrl) {
    console.warn("Cloudflare R2 is not fully configured. File upload to R2 skipped.");
    return null;
  }

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    });

    await s3Client.send(command);

    const url = `${publicUrl.replace(/\/$/, '')}/${key}`;
    return url;
  } catch (error) {
    console.error("Failed to upload file to Cloudflare R2:", error);
    throw error;
  }
}

export async function getObjectFromR2(key: string) {
  if (!s3Client || !bucketName) {
    console.warn("Cloudflare R2 is not fully configured.");
    return null;
  }
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    return await s3Client.send(command);
  } catch (error) {
    console.error("Failed to get file from Cloudflare R2:", error);
    return null;
  }
}

export async function deleteFromR2(key: string): Promise<boolean> {
  if (!s3Client || !bucketName) {
    console.warn("Cloudflare R2 is not fully configured. Delete from R2 skipped.");
    return false;
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    await s3Client.send(command);
    return true;
  } catch (error) {
    console.error("Failed to delete file from Cloudflare R2:", error);
    return false;
  }
}

export function extractKeyFromUrl(url: string): string | null {
  if (!publicUrl) return null;
  const prefix = publicUrl.replace(/\/$/, '') + '/';
  if (url.startsWith(prefix)) {
    return url.substring(prefix.length);
  }
  return null;
}
