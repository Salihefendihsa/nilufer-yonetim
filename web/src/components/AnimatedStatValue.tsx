"use client";

import { useEffect, useRef, useState } from "react";

/**
 * mobile/lib/widgets/animated_stat_value.dart ile aynı davranış — yalnızca
 * ondalık/binlik ayraç İÇERMEYEN saf tam sayılı değerler ("128", "%80", "12
 * iş") 0'dan gerçek değerine sayarak artar. Para birimi/ondalıklı değerler
 * ("₺12.500", "4.5") belirsizlik riski taşıdığı için (binlik mi ondalık mı)
 * animasyonsuz, olduğu gibi gösterilir.
 */
const PATTERN = /^(\D*)(\d+)(\D*)$/;

export function AnimatedStatValue({ value }: { value: string }) {
  const match = value.match(PATTERN);
  const [display, setDisplay] = useState(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!match) {
      setDisplay(value);
      return;
    }
    const [, prefix, digits, suffix] = match;
    const target = Number(digits);
    if (!Number.isFinite(target)) {
      setDisplay(value);
      return;
    }

    const durationMs = 700;
    const start = performance.now();

    function tick(now: number) {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      const current = Math.round(target * eased);
      setDisplay(`${prefix}${current}${suffix}`);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <>{display}</>;
}
