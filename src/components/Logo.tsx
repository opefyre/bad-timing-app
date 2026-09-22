export default function Logo({ size = 32, label = 'Bad Timing' }: { size?: number; label?: string }) {
  return (
    <svg
      className="app-logo"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label={label}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" fill="#050605" />
      <path fill="#d8ff58" d="M8 4h16v4H8zM4 8h4v16H4zM24 8h4v12h-4zM8 24h12v4H8z" />
      <path fill="#d8ff58" d="M12 8h8v4h-8zM8 12h4v8H8z" opacity=".35" />
      <path fill="#ff6d91" d="M14 10h4v8h6v4H14zM24 24h4v4h-4z" />
    </svg>
  );
}
