import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../lib/ddb.js";
import { ok, err, getWorkerId } from "../lib/http.js";

export const handler = async (event) => {
  const worker_id = getWorkerId(event);
  if (!worker_id) return err(401, "Unauthorized");

  const result = await ddb.send(
    new GetCommand({ TableName: process.env.WORKERS_TABLE, Key: { worker_id } })
  );

  return ok(result.Item || { worker_id, profile_incomplete: true });
};
