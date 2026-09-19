import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../lib/ddb.js";
import { ok, err, getWorkerId } from "../lib/http.js";

export const handler = async (event) => {
  const worker_id = getWorkerId(event);
  if (!worker_id) return err(401, "Unauthorized");

  const qs = event.queryStringParameters || {};
  let { from, to, month } = qs;
  if (month && !(from && to)) {
    from = `${month}-01`;
    to = `${month}-31`;
  }
  if (!from || !to) return err(400, "Provide from & to (YYYY-MM-DD) or month (YYYY-MM)");

  const result = await ddb.send(
    new QueryCommand({
      TableName: process.env.ATTENDANCE_TABLE,
      KeyConditionExpression: "worker_id = :wid AND record_date BETWEEN :from AND :to",
      ExpressionAttributeValues: { ":wid": worker_id, ":from": from, ":to": to },
    })
  );

  const records = result.Items || [];
  const present = records.filter((r) => r.status === "present");
  const total_wages = present.reduce((sum, r) => sum + (r.wage_rate || 0), 0);

  return ok({
    worker_id,
    records,
    summary: { total_days: present.length, total_wages },
  });
};
