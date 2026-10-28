import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const PlusIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} aria-hidden {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const ChartIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} aria-hidden {...p}>
    <path d="M3 3v18h18" />
    <path d="M7 15l4-4 3 3 5-6" />
  </svg>
);

export const ListIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} aria-hidden {...p}>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
);

export const SearchIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} aria-hidden {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </svg>
);

export const DownloadIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} aria-hidden {...p}>
    <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
  </svg>
);

export const PencilIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} aria-hidden {...p}>
    <path d="M16.86 3.49a2.1 2.1 0 113 3L7.5 18.85 3 20l1.15-4.5L16.86 3.49z" />
  </svg>
);

export const TrashIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} aria-hidden {...p}>
    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
  </svg>
);

export const WalletIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} aria-hidden {...p}>
    <path d="M20 7V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h13a2 2 0 002-2v-2" />
    <path d="M21 11h-5a2 2 0 000 4h5v-4z" />
  </svg>
);

export const CalendarIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} aria-hidden {...p}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);

export const TagIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} aria-hidden {...p}>
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
    <path d="M7 7h.01" />
  </svg>
);

export const TrendUpIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} aria-hidden {...p}>
    <path d="M23 6l-9.5 9.5-5-5L1 18" />
    <path d="M17 6h6v6" />
  </svg>
);

export const XIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} aria-hidden {...p}>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

export const SparklesIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} aria-hidden {...p}>
    <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" />
  </svg>
);

export const ShareIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} aria-hidden {...p}>
    <path d="M7 18.5h10.5a4 4 0 00.6-7.95A5.5 5.5 0 007.4 9.1 4.75 4.75 0 007 18.5z" />
    <path d="M12 16v-5m-2.25 2.25L12 11l2.25 2.25" />
  </svg>
);

export const ClockIcon = (p: IconProps) => (
  <svg viewBox="0 0 24 24" {...base} aria-hidden {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);
