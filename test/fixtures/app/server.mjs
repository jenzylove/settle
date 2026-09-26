import { createServer } from "node:http";

// Answers slowly on purpose; the "fast" option in the end to end test removes the delay.
export const DELAY_MS = 25;
let value = 0;

export const server = createServer(async (req, res) => {
  if (req.url === "/health") return res.end("ok");
  if (req.method === "POST" && req.url === "/value") {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    value = JSON.parse(raw || "{}").value ?? value + 1;
    res.writeHead(201, { "content-type": "application/json" });
    return res.end(JSON.stringify({ value }));
  }
  if (req.url === "/value") {
    await new Promise((r) => setTimeout(r, DELAY_MS));
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ value }));
  }
  res.writeHead(404).end();
});

if (process.env.PORT) server.listen(Number(process.env.PORT));
