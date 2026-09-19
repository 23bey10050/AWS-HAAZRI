import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../lib/ddb.js";
import { ok, err, getWorkerId } from "../lib/http.js";
import { toISTDateString, nowIST } from "../lib/dates.js";

const gpsQuality = (accuracy) => {
  if (accuracy == null) return "unknown";
  if (accuracy <= 50) return "high";
  if (accuracy <= 500) return "medium";
  return "low";
};

export const handler = async (event) => {
  const worker_id = getWorkerId(event);
  if (!worker_id) return err(401, "Unauthorized");

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return err(400, "Invalid JSON body");
  }

  const { timestamp, gps_lat, gps_lng, gps_accuracy } = body;
  if (!timestamp || gps_lat == null || gps_lng == null) {
    return err(400, "timestamp, gps_lat, gps_lng are required");
  }

  const serverNow = nowIST();
  const record_date = body.record_date || toISTDateString(timestamp);
  if (record_date > toISTDateString(serverNow)) {
    return err(400, "record_date cannot be in the future");
  }
  const is_retroactive = record_date !== toISTDateString(timestamp);

  // Idempotent upsert (see spec 2.5.1): original timestamp/gps are set once via
  // if_not_exists and never overwritten by a later call the same day.
  const updateExpr = [
    "SET #ts = if_not_exists(#ts, :ts)",
    "gps_lat = if_not_exists(gps_lat, :lat)",
    "gps_lng = if_not_exists(gps_lng, :lng)",
    "gps_accuracy = if_not_exists(gps_accuracy, :acc)",
    "gps_quality = if_not_exists(gps_quality, :qual)",
    "created_at = if_not_exists(created_at, :now)",
    "updated_at = :now",
    "#st = if_not_exists(#st, :present)",
    "is_retroactive = if_not_exists(is_retroactive, :retro)",
  ];
  const names = { "#ts": "timestamp", "#st": "status" };
  const values = {
    ":ts": timestamp,
    ":lat": gps_lat,
    ":lng": gps_lng,
    ":acc": gps_accuracy ?? null,
    ":qual": gpsQuality(gps_accuracy),
    ":now": serverNow,
    ":present": "present",
    ":retro": is_retroactive,
  };

  // Optional fields: only set if provided and not already present.
  const optionalFields = {
    selfie_s3_key: body.selfie_s3_key,
    voice_s3_key: body.voice_s3_key,
    voice_transcript: body.voice_transcript,
    worksite_name: body.worksite_name,
    task_type: body.task_type,
    contractor_name: body.contractor_name,
    shift_type: body.shift_type,
    bedrock_confidence: body.bedrock_confidence,
    wage_rate: body.wage_rate,
  };
  for (const [key, val] of Object.entries(optionalFields)) {
    if (val !== undefined && val !== null) {
      updateExpr.push(`${key} = if_not_exists(${key}, :${key})`);
      values[`:${key}`] = val;
    }
  }

  await ddb.send(
    new UpdateCommand({
      TableName: process.env.ATTENDANCE_TABLE,
      Key: { worker_id, record_date },
      UpdateExpression: updateExpr.join(", "),
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );

  return ok(
    {
      status: "recorded",
      record_id: `${worker_id}#${record_date}`,
      message_hi: "हाज़िरी हो गई ✓",
    },
    201
  );
};
