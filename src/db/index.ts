import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

// A WebSocket Pool, so `db.transaction` runs interactive transactions (ADR 0003). Node 22+ has a global WebSocket,
// so no `ws` constructor is set. The Pool lives at module scope: the app runs on the Node.js runtime, never Edge,
// where a Pool could not outlive one request.
const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
// An idle connection that drops (e.g. Neon suspending the compute) emits "error" on the Pool; unhandled, it would
// crash the server. The Pool discards that connection and opens a new one for the next query.
pool.on("error", (err: Error) => console.error("Postgres pool error", err));

export const db = drizzle({ client: pool, schema });
