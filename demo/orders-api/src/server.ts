import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { PGlite } from "@electric-sql/pglite";

export interface TopCustomer {
  customer_id: number;
  name: string;
  revenue_cents: number;
  orders: number;
}

// Top customers by paid revenue over the last 30 days. This is the slow
// endpoint the Settle demo debates how to speed up.
export async function topCustomers(db: PGlite, limit: number): Promise<TopCustomer[]> {
  const { rows } = await db.query<TopCustomer>(
    `SELECT c.id AS customer_id,
            c.name,
            sum(o.amount_cents)::int AS revenue_cents,
            count(*)::int AS orders
     FROM orders o
     JOIN customers c ON c.id = o.customer_id
     WHERE o.status = 'paid'
       AND o.created_at > now() - interval '30 days'
     GROUP BY c.id, c.name
     ORDER BY revenue_cents DESC
     LIMIT $1`,
    [limit],
  );
  return rows;
}

export async function createOrder(db: PGlite, customerId: number, amountCents: number): Promise<number> {
  const { rows } = await db.query<{ id: number }>(
    `INSERT INTO orders (customer_id, amount_cents, status, created_at)
     VALUES ($1, $2, 'paid', now())
     RETURNING id`,
    [customerId, amountCents],
  );
  return rows[0].id;
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readJson(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

export function buildServer(db: PGlite): Server {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");

      if (req.method === "GET" && url.pathname === "/health") {
        return send(res, 200, { ok: true });
      }

      if (req.method === "GET" && url.pathname === "/stats/top-customers") {
        const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 10), 1), 100);
        return send(res, 200, await topCustomers(db, limit));
      }

      if (req.method === "POST" && url.pathname === "/orders") {
        const body = await readJson(req);
        const customerId = Number(body.customer_id);
        const amountCents = Number(body.amount_cents);
        if (!Number.isInteger(customerId) || !Number.isInteger(amountCents) || amountCents <= 0) {
          return send(res, 400, { error: "customer_id and amount_cents must be positive integers" });
        }
        const id = await createOrder(db, customerId, amountCents);
        return send(res, 201, { id });
      }

      send(res, 404, { error: "not found" });
    } catch (err) {
      send(res, 500, { error: (err as Error).message });
    }
  });
}
