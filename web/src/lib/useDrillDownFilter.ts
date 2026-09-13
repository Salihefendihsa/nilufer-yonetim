"use client";

import { useEffect, useState } from "react";

/**
 * Bölüm G (2. tur): Yönetici Özeti kartlarından gelen `?filter=` / `?tab=`
 * drill-down parametresini okur. `useSearchParams` yerine `window.location`
 * kullanılır — böylece sayfanın Suspense sınırına sarılması gerekmez
 * (bkz. Bölüm E'de yaşanan `next build` hatası). Yalnızca ilk render'da
 * okunur; kullanıcı filtreyi temizleyince URL'e dokunulmaz.
 */
export function useInitialQueryParam(name: string): string | null {
  const [value, setValue] = useState<string | null>(null);
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get(name);
    if (param) setValue(param);
  }, [name]);
  return value;
}
