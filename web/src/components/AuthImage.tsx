"use client";

import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { fetchFileBlob } from "@/lib/api";

/**
 * Bölüm AC (7. tur) — GÜVENLİK: dosyalar artık kimlik doğrulamalı
 * `GET /files/:type/:id` ucundan gelir; `<img src>` Authorization header
 * taşıyamadığı için görsel fetch+blob ile indirilip object URL olarak
 * gösterilir (token'sız/imzalı URL yüzeyi hiç açılmaz). `path` API'ye göreli
 * yoldur (örn. `/files/job-photo/<id>`).
 */
interface AuthImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  path: string | null | undefined;
  /** Yüklenirken/başarısızken gösterilecek yer tutucu (opsiyonel). */
  fallback?: React.ReactNode;
}

export function useAuthFileUrl(path: string | null | undefined): { url: string | null; error: boolean } {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    setError(false);
    fetchFileBlob(path)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);

  return { url, error };
}

export function AuthImage({ path, fallback, alt, className, ...rest }: AuthImageProps) {
  const { url, error } = useAuthFileUrl(path);
  if (!url) {
    return (
      <span className={`flex items-center justify-center bg-surface-muted text-2xs text-text-faint ${className ?? ""}`} aria-label={alt}>
        {fallback ?? (error ? "Görsel yüklenemedi" : "…")}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} {...rest} />;
}
