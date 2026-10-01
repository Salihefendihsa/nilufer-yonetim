export function selectedCustomerDetail<T extends { id: string }>(detail: T | null, customerId: string | null): T | null {
  return detail?.id === customerId ? detail : null;
}

/** Kapanan ekranı ve aynı ekrandaki eski liste isteklerini geçersiz kılar. */
export class CustomerRequestGuard {
  private active = true;
  private revision = 0;

  open() {
    this.active = true;
  }

  private begin(): () => boolean {
    const revision = ++this.revision;
    return () => this.active && revision === this.revision;
  }

  async runLatest<T>(
    request: () => Promise<T>,
    handlers: { onSuccess: (value: T) => void; onError: (error: unknown) => void; onSettled: () => void }
  ): Promise<void> {
    const isCurrent = this.begin();
    try {
      const value = await request();
      if (isCurrent()) handlers.onSuccess(value);
    } catch (error) {
      if (isCurrent()) handlers.onError(error);
    } finally {
      if (isCurrent()) handlers.onSettled();
    }
  }

  isActive(): boolean {
    return this.active;
  }

  close() {
    this.active = false;
    this.revision++;
  }
}

/** Çoklu yüklemede hedef müşteri sabit kalır; kapanıştan sonra yeni dosya başlamaz. */
export async function uploadCustomerDocuments<T>(
  customerId: string,
  files: readonly T[],
  isActive: () => boolean,
  upload: (targetId: string, file: T) => Promise<void>
): Promise<boolean> {
  for (const file of files) {
    if (!isActive()) return false;
    await upload(customerId, file);
  }
  return isActive();
}
