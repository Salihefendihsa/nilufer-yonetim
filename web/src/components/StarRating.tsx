"use client";

import { useState } from "react";
import { Star } from "lucide-react";

interface StarRatingProps {
  onRate: (rating: number) => void;
  disabled?: boolean;
}

export function StarRating({ onRate, disabled }: StarRatingProps) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          disabled={disabled}
          onMouseEnter={() => setHovered(value)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onRate(value)}
          aria-label={`${value} yıldız`}
          className="text-neutral-300 transition hover:scale-110 disabled:opacity-50"
        >
          <Star size={20} strokeWidth={1.5} fill={value <= hovered ? "#B57F13" : "none"} className={value <= hovered ? "text-warning-500" : ""} />
        </button>
      ))}
    </div>
  );
}
