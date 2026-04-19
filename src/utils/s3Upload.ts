// @ts-ignore
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
// @ts-ignore
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
// @ts-ignore
import multer from 'multer';
// @ts-ignore
import multerS3 from 'multer-s3';
import { env } from '../config/env';

// Inisialisasi S3 Client
export const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY,
    secretAccessKey: env.AWS_SECRET_KEY,
  },
});

/**
 * Generate Pre-signed URL untuk upload (Flutter -> S3 secara langsung)
 */
export const generatePresignedUrl = async (filename: string, contentType: string) => {
  const bucketName = env.AWS_S3_BUCKET;
  const key = `uploads/${Date.now()}-${filename}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    ContentType: contentType,
  });

  // URL valid selama 15 menit
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

  return {
    uploadUrl,
    fileUrl: `https://${bucketName}.s3.${env.AWS_REGION}.amazonaws.com/${key}`,
    key,
  };
};

/**
 * Hapus file dari S3
 */
export const deleteFromS3 = async (key: string) => {
  try {
    const bucketName = env.AWS_S3_BUCKET;
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    await s3Client.send(command);
    return true;
  } catch (error) {
    console.error('Failed to delete S3 object:', error);
    return false;
  }
};

/**
 * Multer fallback setup (Jika backend ingin memproses dan upload file secara langsung)
 */
export const uploadMiddleware = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: env.AWS_S3_BUCKET,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: function (req: any, file: any, cb: any) {
      cb(null, `backend-uploads/${Date.now()}-${file.originalname}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req: any, file: any, cb: any) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Format file tidak didukung, hanya JPG/PNG') as any, false);
    }
  }
});
