import { openDb } from "./db.ts";
import { buildServer } from "./server.ts";

const port = Number(process.env.PORT ?? 3000);
const started = Date.now();
const db = await openDb();
buildServer(db).listen(port, () => {
  console.log(`orders-api listening on ${port} (seeded in ${Date.now() - started} ms)`);
});
