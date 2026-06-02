// Pod layout is intentionally barebones — no AppShell, no nav, no footer.
// This is the lockdown shell.
export default function PodLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}
