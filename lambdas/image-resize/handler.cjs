"use strict";

const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const Jimp = require("jimp");

const s3 = new S3Client({});

/** Thumbnail bounding box edge (pixels). Uses cover (fills box, crops overflow). */
const MAX_EDGE = Number(process.env.THUMB_MAX_EDGE || 640);

exports.handler = async (event) => {
  const destBucket = process.env.RESIZED_BUCKET_NAME;
  if (!destBucket) throw new Error("Missing RESIZED_BUCKET_NAME");

  for (const record of event.Records || []) {
    const srcBucket = record.s3.bucket.name;
    const rawKey = record.s3.object.key;
    const key = decodeURIComponent(rawKey.replace(/\+/g, " "));

    if (!key.startsWith("tasks/")) {
      console.log("Skipping key (not tasks/ prefix):", key);
      continue;
    }

    const ext = key.split(".").pop()?.toLowerCase() || "";
    const imageExtensions = ["jpg", "jpeg", "png", "webp", "gif", "bmp"];
    if (!imageExtensions.includes(ext)) {
      console.log("Skipping non-image extension:", ext, key);
      continue;
    }

    const obj = await s3.send(new GetObjectCommand({ Bucket: srcBucket, Key: key }));
    const incoming = Buffer.from(await obj.Body.transformToByteArray());
    const image = await Jimp.read(incoming);
    await image.cover(MAX_EDGE, MAX_EDGE);

    const outBuffer = await image.getBufferAsync(Jimp.MIME_JPEG);
    /** Same path in resized bucket; normalize to .jpg output. */
    const destKey = key.replace(/\.[^.]+$/, ".thumb.jpg");

    await s3.send(
      new PutObjectCommand({
        Bucket: destBucket,
        Key: destKey,
        Body: outBuffer,
        ContentType: "image/jpeg",
      }),
    );

    console.log("Wrote thumbnail:", destBucket, destKey);
  }
};
