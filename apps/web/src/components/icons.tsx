import type { ReactNode, SVGProps } from "react";

/**
 * Lightweight, dependency-free line-icon set in the Lucide visual language
 * (24×24 grid, 2px stroke, round caps, currentColor). Used across the web
 * app so nothing relies on emoji. Icons inherit color/size from their context.
 */

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "ref"> {
  size?: number;
}

function Icon({
  size = 24,
  children,
  fill = "none",
  strokeWidth = 2,
  ...rest
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      {children}
    </svg>
  );
}

export const Camera = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
    <circle cx="12" cy="13" r="3.5" />
  </Icon>
);

export const ImageIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </Icon>
);

export const TextType = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7V5h16v2" />
    <path d="M12 5v14" />
    <path d="M9 19h6" />
  </Icon>
);

export const Link = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9.5 14.5l5-5" />
    <path d="M11 6.5l1-1a3.5 3.5 0 0 1 5 5l-1 1" />
    <path d="M13 17.5l-1 1a3.5 3.5 0 0 1-5-5l1-1" />
  </Icon>
);

export const FileText = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6M9 17h6" />
  </Icon>
);

export const Sparkles = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3l1.9 4.6L18.5 9l-4.6 1.4L12 15l-1.9-4.6L5.5 9l4.6-1.4z" />
    <path d="M18.5 14.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z" />
  </Icon>
);

export const Repeat = (p: IconProps) => (
  <Icon {...p}>
    <path d="M17 2l4 4-4 4" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <path d="M7 22l-4-4 4-4" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </Icon>
);

export const Shuffle = (p: IconProps) => (
  <Icon {...p}>
    <path d="M16 3h5v5" />
    <path d="M4 20L21 3" />
    <path d="M21 16v5h-5" />
    <path d="M15 15l6 6" />
    <path d="M4 4l5 5" />
  </Icon>
);

export const Flame = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 2.5c2.5 3 4 5 4 8a4 4 0 0 1-8 0c0-1.3.5-2.4 1.3-3.3.2 1.1.9 1.7 1.7 1.8-.8-2.4.2-4.7 1-6.3z" />
  </Icon>
);

export const RefreshSync = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 12a9 9 0 1 1-2.6-6.4" />
    <path d="M21 3v5h-5" />
  </Icon>
);

export const Check = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 6L9 17l-5-5" />
  </Icon>
);

export const CheckCircle = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12l3 3 5-6" />
  </Icon>
);

export const Target = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.5" />
  </Icon>
);

export const Layers = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3l9 5-9 5-9-5 9-5z" />
    <path d="M3 13l9 5 9-5" />
  </Icon>
);

export const ListChecks = (p: IconProps) => (
  <Icon {...p}>
    <path d="M11 6h9M11 12h9M11 18h9" />
    <path d="M3 6l1.5 1.5L7.5 4.5" />
    <path d="M3 17l1.5 1.5L7.5 15.5" />
  </Icon>
);

export const Match = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="6" cy="6" r="2" />
    <circle cx="6" cy="18" r="2" />
    <circle cx="18" cy="6" r="2" />
    <circle cx="18" cy="18" r="2" />
    <path d="M8 6h8M8 18h8" />
  </Icon>
);

export const Pencil = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
  </Icon>
);

export const RotateCw = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 12a9 9 0 1 1-2.6-6.4" />
    <path d="M21 3v5h-5" />
  </Icon>
);

export const ShieldCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
    <path d="M9 12l2 2 4-4" />
  </Icon>
);

export const Lock = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </Icon>
);

export const Plus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const Search = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </Icon>
);

export const MoreHorizontal = (p: IconProps) => (
  <Icon fill="currentColor" stroke="none" {...p}>
    <circle cx="5" cy="12" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="19" cy="12" r="1.6" />
  </Icon>
);

export const Play = (p: IconProps) => (
  <Icon fill="currentColor" stroke="none" {...p}>
    <path d="M7 4.5l12 7.5-12 7.5z" />
  </Icon>
);

export const Copy = (p: IconProps) => (
  <Icon {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </Icon>
);

export const Share = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="18" cy="5" r="2.5" />
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="19" r="2.5" />
    <path d="M8.2 10.8l7.6-4.6M8.2 13.2l7.6 4.6" />
  </Icon>
);

export const Trash = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 6h18" />
    <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
    <path d="M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14" />
    <path d="M10 11v6M14 11v6" />
  </Icon>
);

export const Star = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 20l1-6L3.3 9.9l6-.9z" />
  </Icon>
);

export const StarFilled = (p: IconProps) => (
  <Icon fill="currentColor" stroke="none" {...p}>
    <path d="M12 3.5l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 20l1-6L3.3 9.9l6-.9z" />
  </Icon>
);

export const X = (p: IconProps) => (
  <Icon {...p}>
    <path d="M18 6L6 18M6 6l12 12" />
  </Icon>
);

export const Menu = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Icon>
);

export const ArrowLeft = (p: IconProps) => (
  <Icon {...p}>
    <path d="M19 12H5" />
    <path d="M12 19l-7-7 7-7" />
  </Icon>
);

export const ChevronRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 18l6-6-6-6" />
  </Icon>
);

export const Zap = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13 2L4 14h6l-1 8 9-12h-6z" />
  </Icon>
);

export const Folder = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h3.5l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </Icon>
);

export const Smartphone = (p: IconProps) => (
  <Icon {...p}>
    <rect x="7" y="3" width="10" height="18" rx="2.5" />
    <path d="M11 18h2" />
  </Icon>
);

export const Users = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1" />
    <circle cx="8.5" cy="8" r="3.2" />
    <path d="M22 20v-1a4 4 0 0 0-3-3.9" />
    <path d="M16 4.6a3.2 3.2 0 0 1 0 6.2" />
  </Icon>
);

export const Trophy = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 21h8M12 17v4" />
    <path d="M7 4h10v4a5 5 0 0 1-10 0V4z" />
    <path d="M7 6H4v1a3 3 0 0 0 3 3" />
    <path d="M17 6h3v1a3 3 0 0 1-3 3" />
  </Icon>
);

export const Clock = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Icon>
);

export const BarChart = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 3v18h18" />
    <path d="M8 17v-5M13 17V8M18 17v-8" />
  </Icon>
);

export const LogOut = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </Icon>
);

export const Globe = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
  </Icon>
);

export const MailCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="M22 12V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8" />
    <path d="M2 7l10 6 10-6" />
    <path d="M16 19l2 2 4-4" />
  </Icon>
);

export const AlertTriangle = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3.5L2.5 20h19L12 3.5z" />
    <path d="M12 10v4" />
    <path d="M12 17.5v.01" />
  </Icon>
);

export const MapPin = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 21s7-6.3 7-11a7 7 0 0 0-14 0c0 4.7 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </Icon>
);

export const GraduationCap = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3L2 8l10 5 10-5-10-5z" />
    <path d="M6 10.5V15c0 1.4 2.7 3 6 3s6-1.6 6-3v-4.5" />
    <path d="M22 8v5" />
  </Icon>
);
