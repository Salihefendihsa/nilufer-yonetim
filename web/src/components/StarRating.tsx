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
          className="text-white/20 transition hover:scale-110 disabled:opacity-50"
        >
          <Star size={20} strokeWidth={1.5} fill={value <= hovered ? "#5DA130" : "none"} className={value <= hovered ? "text-primary-greenLight" : ""} />
        </button>
      ))}
    </div>
  );
}
