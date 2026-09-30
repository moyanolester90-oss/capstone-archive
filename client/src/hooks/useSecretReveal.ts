import { useEffect, useState } from "react";

/**
 * Tracks whether the hidden Adviser / Librarian login & sign-up options have
 * been revealed with the Ctrl+Q keyboard shortcut. Starts hidden on every
 * page load (state is not persisted) — the shortcut has to be pressed again
 * each visit, which is the point of keeping these options out of sight by
 * default. This is a UI convenience only: the server still enforces who can
 * actually sign in or create an account as which role.
 */
export function useSecretReveal() {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "q") {
        e.preventDefault();
        setRevealed(r => !r);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return revealed;
}
