interface ResQRouteLogoProps {
  className?: string;
}

export function ResQRouteLogo({ className }: ResQRouteLogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="40" height="40" rx="11" fill="#0B3B78" />
      <path
        d="M8 29h5.5l3.7-9.1 4.4 5.2 4.4-11"
        stroke="#FFFFFF"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="29" r="2.7" fill="#ED5B3B" />
      <path
        d="M28.5 6.8c-3.2 0-5.8 2.6-5.8 5.8 0 4.1 5.8 10.6 5.8 10.6s5.8-6.5 5.8-10.6c0-3.2-2.6-5.8-5.8-5.8Z"
        fill="#ED5B3B"
      />
      <circle cx="28.5" cy="12.5" r="2" fill="#FFFFFF" />
    </svg>
  );
}
