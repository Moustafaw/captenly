// Defines which routes should NOT render the global header, footer, or mobile dock
// (e.g. auth flows, onboarding, and standalone modals).

export function isChromeless(pathname: string): boolean {
  if (!pathname) return false;
  const p = pathname.toLowerCase();
  return (
    p.startsWith("/auth") ||
    p.startsWith("/admin")
  );
}
