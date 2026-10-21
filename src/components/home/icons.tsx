// Line icons for the header and controls, 24px, stroke follows currentColor.
type IconProps = { className?: string };

const base = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  "aria-hidden": true,
} as const;

export const BagIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M5 8h14l-1 12H6L5 8Z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </svg>
);

export const UserIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c.8-3.4 3.6-5.5 7-5.5s6.2 2.1 7 5.5" />
  </svg>
);

export const SearchIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="m16.5 16.5 4 4" />
  </svg>
);

export const MenuIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const CloseIcon = ({ className }: IconProps) => (
  <svg {...base} className={className}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);

export const ChevronIcon = ({ className }: IconProps) => (
  <svg {...base} width={16} height={16} className={className}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export const MinusIcon = ({ className }: IconProps) => (
  <svg {...base} width={14} height={14} className={className}>
    <path d="M5 12h14" />
  </svg>
);

export const PlusIcon = ({ className }: IconProps) => (
  <svg {...base} width={14} height={14} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
