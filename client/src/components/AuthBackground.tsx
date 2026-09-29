/**
 * Layout wrapper for the Login and Sign Up pages. The seal watermark is
 * now supplied globally by `PageBackground` (mounted once in App.tsx) so
 * every page — including these two — shares the exact same background.
 * This component just centers the auth card on the page.
 */
export default function AuthBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center p-4 py-10">
      {children}
    </div>
  );
}
