import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ok, err, getWorkerId } from "../lib/http.js";

const s3 = new S3Client({});
const LIMITS = { selfie: 2_000_000, voice: 5_000_000 }; // bytes, post-compression

export const handler = async (event) => {
  const worker_id = getWorkerId(event);
  if (!worker_id) return err(401, "Unauthorized");

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return err(400, "Invalid JSON body");
  }

  const { media_type, file_type, file_size_bytes } = body;
  if (!["selfie", "voice"].includes(media_type)) {
    return err(400, "media_type must be 'selfie' or 'voice'");
  }
  if (file_size_bytes > LIMITS[media_type]) {
    return err(400, `${media_type} exceeds ${LIMITS[media_type]} byte limit`);
  }

  const ext = media_type === "selfie" ? "jpg" : "webm";
  const s3_key = `${media_type === "selfie" ? "selfies" : "voice"}/${worker_id}/${Date.now()}.${ext}`;

  const upload_url = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: process.env.BUCKET_NAME, Key: s3_key, ContentType: file_type }),
    { expiresIn: 300 }
  );

  return ok({ upload_url, s3_key, expires_in: 300 });
};
