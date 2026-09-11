import { AsyncLocalStorage } from "async_hooks";

interface RequestContext {
  /** Aktif istek bir impersonation JWT'siyle geldiyse OWNER'ın User.id'si. */
  impersonatedBy?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * requireAuth tarafından her istek için bir kez çağrılır — böylece
 * recordAuditLog (lib/auditLog.ts) hiçbir çağıran kodu değiştirmeden
 * "bu işlem impersonation sırasında mı yapıldı" bilgisine ulaşabilir.
 */
export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}
