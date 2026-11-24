import "server-only";
import type { DbOrTx } from "@/db";
import { schema } from "@/db";

export interface AuditEntry {
  username: string;
  action: string;
  entity: string;
  entityId?: string | number;
  reason?: string;
  before?: unknown;
  after?: unknown;
}

/** Every organiser change is recorded with who, when, why, and the values before and after. */
export async function audit(db: DbOrTx, e: AuditEntry): Promise<void> {
  await db.insert(schema.auditLog).values({
    username: e.username,
    action: e.action,
    entity: e.entity,
    entityId: e.entityId === undefined ? "" : String(e.entityId),
    reason: e.reason ?? "",
    before: (e.before ?? null) as object | null,
    after: (e.after ?? null) as object | null,
  });
}
