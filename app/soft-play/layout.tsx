// Required for app/soft-play/not-found.tsx to actually render server-side.
// Without a layout.tsx in this segment, Next.js has no error boundary scoped
// here, so notFound() calls in app/soft-play/[city]/page.tsx (and its
// children) bubble past this segment's not-found.tsx entirely — the
// metadata (title, robots) still resolves correctly, but the HTML body falls
// back to Next's generic client-only "__next_error__" shell, which is blank
// until JavaScript hydrates. That's invisible to crawlers that don't execute
// JS and to anyone relying on server-rendered content (e.g. no-JS,
// screen readers on a slow connection). Confirmed live on production before
// this fix: curl of an invalid /soft-play/<city> URL returned that empty
// shell instead of the actual "Venue or Location Not Found" page content.
export default function SoftPlayLayout({ children }: { children: React.ReactNode }) {
  return children
}
