/**
 * Global backdrop for every page in the app: the school seal, large,
 * centered, and softly masked so it reads as a subtle professional
 * watermark woven into the page rather than a separate image placed on
 * top. Mounted once in App.tsx as a fixed layer behind the header and
 * every route, so Home, Browse, Upload, Dashboard, Users, Login, Sign Up,
 * Download Requests, and every other page share the exact same look.
 *
 * Kept lightly blurred (not heavily) and at low-but-visible opacity so the
 * seal stays clearly recognizable up close while still reading as a
 * watermark rather than the page's main visual.
 */
export default function PageBackground() {
  const maskImage =
    "radial-gradient(circle at center, black 0%, black 35%, transparent 70%)";

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 overflow-hidden bg-background"
    >
      {/* The seal itself: centered, faded, lightly sharpened, and masked so
          its edges dissolve into the page instead of a hard blurred box. */}
      <div
        className="pointer-events-none select-none absolute left-1/2 top-1/2 h-[min(90vw,1050px)] w-[min(90vw,1050px)] -translate-x-1/2 -translate-y-1/2 opacity-[0.09] blur-[0.5px]"
        style={{
          backgroundImage: "url(/logo.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          WebkitMaskImage: maskImage,
          maskImage,
        }}
      />
      {/* A faint tint of the school colors, also centered, to help the seal
          blend into the page instead of floating on plain white. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at center, rgba(30,64,175,0.04) 0%, rgba(30,64,175,0.015) 40%, transparent 70%)",
        }}
      />
    </div>
  );
}
