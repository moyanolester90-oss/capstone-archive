import { useAuth } from "@/_core/hooks/useAuth";

/**
 * Watermark overlay that displays the currently logged-in user's full name
 * (or email fallback) diagonally across protected content areas.
 */
export default function Watermark({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) return <>{children}</>;

  const watermarkText = user?.name?.trim() || user?.email?.trim() || "Authenticated User";

  return (
    <div className="relative overflow-hidden group">
      {children}

      {/* Repeated background watermark */}
      <div
        className="pointer-events-none absolute inset-0 z-30 select-none overflow-hidden opacity-[0.05] flex flex-wrap gap-20 p-10 justify-center items-center"
        aria-hidden="true"
      >
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="whitespace-nowrap text-sm font-bold -rotate-45 transform"
            style={{ userSelect: 'none' }}
          >
            {watermarkText}
          </div>
        ))}
      </div>

      {/* Large diagonal watermark */}
      <div
        className="pointer-events-none absolute inset-0 z-40 select-none overflow-hidden opacity-[0.08] flex items-center justify-center"
        aria-hidden="true"
      >
        <div
          className="whitespace-nowrap text-4xl md:text-6xl font-black -rotate-12 transform border-4 border-current p-4 rounded-xl"
          style={{ userSelect: 'none' }}
        >
          {watermarkText}
        </div>
      </div>
    </div>
  );
}

