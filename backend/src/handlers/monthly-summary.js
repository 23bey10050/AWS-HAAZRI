import { ScanCommand, QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../lib/ddb.js";

// NOTE: Scan is fine at hackathon scale (dozens of workers). At real scale,
// paginate or move this to a Step Functions Map state. Not needed for the demo.
export const handler = async () => {
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthKey = prevMonth.toISOString().slice(0, 7); // "YYYY-MM"

  const workers = await ddb.send(new ScanCommand({ TableName: process.env.WORKERS_TABLE }));

  for (const worker of workers.Items || []) {
    const records = await ddb.send(
      new QueryCommand({
        TableName: process.env.ATTENDANCE_TABLE,
        KeyConditionExpression: "worker_id = :wid AND begins_with(record_date, :m)",
        ExpressionAttributeValues: { ":wid": worker.worker_id, ":m": monthKey },
      })
    );
    const present = (records.Items || []).filter((r) => r.status === "present");
    const total_wages = present.reduce((s, r) => s + (r.wage_rate || 0), 0);

    await ddb.send(
      new PutCommand({
        TableName: process.env.SUMMARIES_TABLE,
        Item: {
          worker_id: worker.worker_id,
          month_key: monthKey,
          total_days: present.length,
          total_wages,
          generated_at: new Date().toISOString(),
        },
      })
    );
  }
};
