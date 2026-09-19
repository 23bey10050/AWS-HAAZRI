import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ok, err, getWorkerId } from "../lib/http.js";

const s3 = new S3Client({});

// Generates a short-lived, read-only URL for a worker's own selfie/voice file so the
// Calendar day-detail view can display the actual evidence. Never trusts the requested
// key blindly — it must fall under this caller's own worker_id prefix (matching the key
// layout presigned-url.js writes: "selfies/<worker_id>/..." / "voice/<worker_id>/..."),
// so a worker can only ever view their own uploads, never someone else's.
export const handler = async (event) => {
  const worker_id = getWorkerId(event);
  if (!worker_id) return err(401, "Unauthorized");

  const key = event.queryStringParameters?.key;
  if (!key) return err(400, "key is required");

  const allowedPrefixes = [`selfies/${worker_id}/`, `voice/${worker_id}/`];
  if (!allowedPrefixes.some((prefix) => key.startsWith(prefix))) {
    return err(403, "Forbidden");
  }

  const view_url = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: process.env.BUCKET_NAME, Key: key }),
    { expiresIn: 300 }
  );

  return ok({ view_url, expires_in: 300 });
};
