import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../lib/ddb.js";
import { ok, err, getWorkerId } from "../lib/http.js";
import { nowIST } from "../lib/dates.js";

export const handler = async (event) => {
  const worker_id = getWorkerId(event);
  if (!worker_id) return err(401, "Unauthorized");

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return err(400, "Invalid JSON body");
  }

  const phone_number = event.requestContext.authorizer.claims.phone_number;
  const item = {
    worker_id,
    phone_number,
    display_name: body.display_name ?? null,
    preferred_language: body.preferred_language ?? "hi",
    default_wage_rate: body.default_wage_rate ?? 0,
    created_at: nowIST(),
  };

  await ddb.send(new PutCommand({ TableName: process.env.WORKERS_TABLE, Item: item }));
  return ok(item);
};
