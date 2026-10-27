import Link from "next/link";

type WordmarkProps = { inverse?: boolean; className?: string; linked?: boolean };

export function Wordmark({ inverse = false, className = "", linked = true }: WordmarkProps) {
  const mark = (
    <svg
      className={`wordmark ${inverse ? "wordmark-inverse" : ""} ${className}`}
      viewBox="0 0 760 166"
      role="img"
      aria-label="VEGORA — Elevate Your Style"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g fill="none" stroke="currentColor" strokeWidth="12" strokeLinecap="square" strokeLinejoin="miter">
        <path d="M8 18 49 122 90 18" />
        <path d="M132 18v104h78M132 18h78M132 70h63" />
        <path d="M336 46c-10-19-26-30-47-30-30 0-52 24-52 54s22 54 52 54c28 0 48-20 48-47v-6h-48" />
        <ellipse cx="433" cy="70" rx="49" ry="54" />
        <path d="M532 122V18h47c24 0 38 13 38 33s-14 33-38 33h-47M574 84l48 38" />
        <path d="m666 122 42-104 42 104" />
      </g>
      <text x="380" y="158" fill="currentColor" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="14" letterSpacing="12">ELEVATE YOUR STYLE</text>
    </svg>
  );
  return linked ? <Link href="/" className="wordmark-link" aria-label="VEGORA home">{mark}</Link> : mark;
}
