import { PGlite } from "@electric-sql/pglite";

export const CUSTOMERS = 5_000;
export const ORDERS = 200_000;

// Builds an in memory database with deterministic seed data, so every
// branch in a Settle run measures against exactly the same rows.
export async function openDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE customers (
      id          integer PRIMARY KEY,
      name        text NOT NULL,
      region      text NOT NULL
    );

    CREATE TABLE orders (
      id           serial PRIMARY KEY,
      customer_id  integer NOT NULL REFERENCES customers(id),
      amount_cents integer NOT NULL,
      status       text NOT NULL,
      created_at   timestamptz NOT NULL
    );

    SELECT setseed(0.42);

    INSERT INTO customers (id, name, region)
    SELECT i,
           'Customer ' || i,
           (ARRAY['north', 'south', 'east', 'west'])[1 + (i % 4)]
    FROM generate_series(1, ${CUSTOMERS}) AS i;

    INSERT INTO orders (customer_id, amount_cents, status, created_at)
    SELECT 1 + floor(random() * ${CUSTOMERS})::int,
           500 + floor(random() * 50000)::int,
           (ARRAY['paid', 'paid', 'paid', 'refunded'])[1 + floor(random() * 4)::int],
           now() - (random() * interval '120 days')
    FROM generate_series(1, ${ORDERS});

    ANALYZE;
  `);
  return db;
}
