export function BrandLogo({ size = 36 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-300 via-yellow-400 to-amber-500 text-black shadow-lg shadow-yellow-500/25 ring-1 ring-yellow-200/40"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-[58%] w-[58%]"
        aria-hidden="true"
      >
        <path
          d="M6.5 4.8C5.4 4.1 4 4.9 4 6.2v7.6c0 1.3 1.4 2.1 2.5 1.4l6.3-3.8c1.1-.6 1.1-2.2 0-2.8L6.5 4.8Z"
          fill="currentColor"
        />
        <rect x="4" y="17.2" width="9.5" height="2.6" rx="1.3" fill="currentColor" />
        <rect
          x="15.2"
          y="17.2"
          width="4.8"
          height="2.6"
          rx="1.3"
          fill="currentColor"
          opacity="0.72"
        />
      </svg>
    </div>
  );
}
