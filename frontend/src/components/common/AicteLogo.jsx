import React from 'react';

export default function AicteLogo({ className = "h-8 w-auto", showText = false }) {
  return (
    <div className="flex items-center gap-2.5 shrink-0">
      <div className="relative flex items-center justify-center">
        {/* Authoritative AICTE Emblem Vector Badge */}
        <svg
          className={className}
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Outer Ring */}
          <circle cx="20" cy="20" r="19" fill="#00685F" stroke="#89F5E7" strokeWidth="1.5" />
          <circle cx="20" cy="20" r="16.5" stroke="#FFFFFF" strokeWidth="0.75" strokeDasharray="2 1.5" opacity="0.8" />
          
          {/* Inner Golden Seal Sun Rays / Emblem Motif */}
          <circle cx="20" cy="20" r="13" fill="#004D46" />
          <path
            d="M20 9L21.5 14L26 11.5L24 16.5L29 17L25 20L29 23L24 23.5L26 28.5L21.5 26L20 31L18.5 26L14 28.5L16 23.5L11 23L15 20L11 17L16 16.5L14 11.5L18.5 14L20 9Z"
            fill="#FFDDB8"
            opacity="0.9"
          />
          
          {/* Center Ashoka Dharma Chakra / Gear of Technical Education */}
          <circle cx="20" cy="20" r="6" fill="#00685F" stroke="#FFFFFF" strokeWidth="1" />
          <circle cx="20" cy="20" r="2.5" fill="#FFFFFF" />
          
          {/* Central Technical Education Torch Flame */}
          <path
            d="M20 15C19 16.5 19 17.5 20 19C21 17.5 21 16.5 20 15Z"
            fill="#FFB95F"
          />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col min-w-0">
          <span className="font-headline-sm text-sm font-bold tracking-tight text-primary leading-tight truncate">
            AICTE FDR Portal
          </span>
          <span className="font-label-sm text-[10px] text-on-surface-variant leading-tight truncate">
            Ministry of Education, GoI
          </span>
        </div>
      )}
    </div>
  );
}
