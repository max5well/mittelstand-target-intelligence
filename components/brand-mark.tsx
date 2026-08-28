import type { SVGProps } from "react";

export function BrandMark({
  inverse = false,
  ...props
}: SVGProps<SVGSVGElement> & { inverse?: boolean }) {
  const foreground = inverse ? "#ffffff" : "#15352e";

  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}>
      <path
        d="M7 19V8h11M46 8h11v11M57 45v11H46M18 56H7V45"
        stroke="#24b894"
        strokeWidth="5"
        strokeLinecap="square"
      />
      <path d="M17 17h30v8L29 43h19v7H16v-8l18-18H17v-7Z" fill={foreground} />
      <path d="M35 34l8-5 8 5v15H35V34Z" fill={foreground} />
      <path
        d="M41 36h3v4h-3v-4Zm5 0h3v4h-3v-4Zm-5 6h3v4h-3v-4Zm5 0h3v4h-3v-4Z"
        fill={inverse ? "#15352e" : "#f3f0e8"}
      />
    </svg>
  );
}
