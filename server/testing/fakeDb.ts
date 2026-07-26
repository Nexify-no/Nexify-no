/**
 * Copyright © 2026 Nexify CRM Systems AS. All rights reserved.
 * Org.nr: 936300278 — Proprietary and confidential.
 */

/**
 * A recording stand-in for the Drizzle client, for router tests.
 *
 * Why this exists rather than the usual `vi.fn().mockReturnThis()` chain:
 *
 *  1. The suite runs with `mockReset: true` (vitest.config.ts), which strips the
 *     implementation off every spy before EVERY test. A chain built from
 *     `mockReturnThis()` at module scope therefore collapses to `undefined` on the
 *     second test onwards — which is exactly why a dozen router test files were
 *     failing with "Database not available". Plain closures cannot be reset.
 *  2. `mockResolvedValueOnce` on a chain link ties the test to the exact call
 *     ORDER inside the procedure, so any refactor (or an extra internal query,
 *     e.g. brandScope resolving the active brand) silently shifted the queued
 *     answer onto the wrong query. Keying rows by TABLE is order-independent.
 *  3. It records what was actually sent, so a test can assert the WHERE clause
 *     really scopes by userId instead of just asserting `result` is defined.
 *
 * Every chain node is thenable, so both `await db.select().from(t).where(c)` and
 * `await db.select().from(t).where(c).limit(1)` resolve to the table's rows.
 *
 * One consequence to know about: because the nodes are thenable, an async helper
 * that *returns* a query builder without awaiting it (`async () => db.select()
 * .from(t)`) will have it assimilated and resolve to the rows. That is usually
 * what you want, but it means such a helper cannot hand the builder back to its
 * caller for further chaining.
 */

import { getTableName, type SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";

const dialect = new MySqlDialect();

/** Compile a Drizzle condition to SQL text, for asserting on scoping. */
export function sqlOf(condition: unknown): string {
  if (condition == null) return "";
  return dialect.sqlToQuery(condition as SQL).sql;
}

/** Compile a Drizzle condition to SQL text plus bound parameters. */
export function queryOf(condition: unknown): { sql: string; params: unknown[] } {
  const q = dialect.sqlToQuery(condition as SQL);
  return { sql: q.sql, params: q.params };
}

export type RecordedOp = {
  kind: "select" | "insert" | "update" | "delete";
  /** Drizzle table name, e.g. "posts". Empty until `.from()`/`.into()` is seen. */
  table: string;
  /** Payload passed to `.values()` — an object, or an array for a bulk insert. */
  values?: unknown;
  /** Payload passed to `.set()`. */
  set?: unknown;
  /** Condition passed to `.where()`, uncompiled. Use `sqlOf` / `queryOf`. */
  where?: unknown;
  limit?: number;
  orderBy?: unknown;
  /** True when the caller asked for generated ids. */
  returningId?: boolean;
};

export type FakeDbConfig = {
  /** Rows a SELECT against a table resolves to. Missing table → `[]`. */
  rows?: Record<string, unknown[]>;
  /** Ids `$returningId()` resolves to, per table. Missing table → `[{ id: 1 }]`. */
  returningId?: Record<string, Array<{ id: number }>>;
  /** Throw from any operation against these tables, to test failure paths. */
  failOn?: Record<string, Error>;
  /**
   * Rows an INSERT/UPDATE/DELETE against a table reports as affected. Missing
   * table → 1.
   *
   * This matters: a lot of this codebase's write paths are optimistic locks that
   * read `res?.[0]?.affectedRows ?? res?.affectedRows ?? 0` and treat 0 as "I lost
   * the race, discard this work" (planStore, schedulerService, socialRouter). A
   * fake that resolved writes to `undefined` would silently push every such test
   * down the abort branch while it looked like the success path was covered. Set
   * this to 0 deliberately to exercise the lost-lease path.
   */
  affectedRows?: Record<string, number>;
};

export type FakeDb = {
  /** Pass as the resolved value of a mocked `getDb()`. */
  db: unknown;
  /** Every operation, in the order the code performed it. */
  ops: RecordedOp[];
  /** Operations of one kind, optionally narrowed to one table. */
  opsOf: (kind: RecordedOp["kind"], table?: string) => RecordedOp[];
  /** The single op of that kind/table; fails loudly if there is not exactly one. */
  onlyOp: (kind: RecordedOp["kind"], table?: string) => RecordedOp;
  reset: () => void;
};

const CHAIN_METHODS = [
  "from",
  "into",
  "where",
  "orderBy",
  "limit",
  "offset",
  "values",
  "set",
  "groupBy",
  "having",
  "innerJoin",
  "leftJoin",
  "rightJoin",
  "onDuplicateKeyUpdate",
  "$returningId",
  "execute",
  "run",
] as const;

export function createFakeDb(config: FakeDbConfig = {}): FakeDb {
  const ops: RecordedOp[] = [];

  const settle = (op: RecordedOp): unknown => {
    const failure = config.failOn?.[op.table];
    if (failure) throw failure;
    if (op.kind === "select") return config.rows?.[op.table] ?? [];
    if (op.returningId) return config.returningId?.[op.table] ?? [{ id: 1 }];
    // Shaped like mysql2's ResultSetHeader tuple, which is what the real driver
    // hands back and what the optimistic-lock call sites destructure.
    return [{ affectedRows: config.affectedRows?.[op.table] ?? 1 }];
  };

  function chain(op: RecordedOp) {
    const node: Record<string, unknown> = {};

    for (const method of CHAIN_METHODS) {
      node[method] = (arg: unknown) => {
        switch (method) {
          case "from":
          case "into":
            op.table = tableNameOf(arg);
            break;
          case "where":
            op.where = arg;
            break;
          case "values":
            op.values = arg;
            break;
          case "set":
            op.set = arg;
            break;
          case "limit":
            op.limit = arg as number;
            break;
          case "orderBy":
            op.orderBy = arg;
            break;
          case "$returningId":
            op.returningId = true;
            break;
          default:
            break;
        }
        return node;
      };
    }

    // Thenable: awaiting ANY point in the chain settles the operation, which is
    // what the routers do — some await `.where(...)`, some `.limit(1)`, some
    // `.$returningId()`.
    node.then = (onOk?: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) => {
      let value: unknown;
      try {
        value = settle(op);
      } catch (e) {
        return Promise.reject(e).catch(onErr as never);
      }
      return Promise.resolve(value).then(onOk, onErr);
    };

    return node;
  }

  const start = (kind: RecordedOp["kind"], tableArg?: unknown) => {
    const op: RecordedOp = { kind, table: tableArg === undefined ? "" : tableNameOf(tableArg) };
    ops.push(op);
    return chain(op);
  };

  const db = {
    // `select()` takes an optional projection, never the table.
    select: () => start("select"),
    selectDistinct: () => start("select"),
    insert: (t: unknown) => start("insert", t),
    update: (t: unknown) => start("update", t),
    delete: (t: unknown) => start("delete", t),
    execute: async () => [],
    transaction: async (fn: (tx: unknown) => unknown) => fn(db),
  };

  const opsOf: FakeDb["opsOf"] = (kind, table) =>
    ops.filter((o) => o.kind === kind && (table === undefined || o.table === table));

  return {
    db,
    ops,
    opsOf,
    onlyOp: (kind, table) => {
      const found = opsOf(kind, table);
      if (found.length !== 1) {
        throw new Error(
          `expected exactly one ${kind}${table ? ` on ${table}` : ""}, got ${found.length}` +
            ` (recorded: ${ops.map((o) => `${o.kind}:${o.table || "?"}`).join(", ")})`,
        );
      }
      return found[0];
    },
    reset: () => {
      ops.length = 0;
    },
  };
}

function tableNameOf(table: unknown): string {
  try {
    return getTableName(table as never);
  } catch {
    return "";
  }
}
