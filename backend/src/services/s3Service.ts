import { S3Client, DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { AppConfig } from "../config.js";

export function s3Service(cfg: AppConfig) {
  const s3 = new S3Client({ region: cfg.AWS_REGION });
  const bucket = cfg.S3_ORIGINALS_BUCKET;

  return {
    taskAttachmentKey(taskId: string, versionId: string, ext: string) {
      const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, "") || "bin";
      return `tasks/${taskId}/${versionId}.${safeExt}`;
    },

    async presignPut(key: string, contentType: string) {
      const cmd = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
      });
      const url = await getSignedUrl(s3, cmd, { expiresIn: cfg.S3_UPLOAD_URL_TTL_SECONDS });
      return { url, bucket, key, expiresInSeconds: cfg.S3_UPLOAD_URL_TTL_SECONDS };
    },

    async presignGet(key: string, expiresInSeconds = Math.min(3600, cfg.S3_UPLOAD_URL_TTL_SECONDS)) {
      const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
      const url = await getSignedUrl(s3, cmd, { expiresIn: expiresInSeconds });
      return { url, bucket, key, expiresInSeconds };
    },

    async deleteObject(key: string) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}
