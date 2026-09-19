const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
};

export const ok = (body, statusCode = 200) => ({
  statusCode,
  headers: { "Content-Type": "application/json", ...CORS },
  body: JSON.stringify(body),
});

export const err = (statusCode, message) => ok({ error: message }, statusCode);

export const getWorkerId = (event) =>
  event.requestContext?.authorizer?.claims?.sub;
