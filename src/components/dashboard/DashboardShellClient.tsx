"use client";
import dynamic from "next/dynamic";

// ssr: false must live in a Client Component — this thin wrapper satisfies
// that constraint while keeping the Server Component pages clean.
const DashboardShell = dynamic(() => import("./DashboardShell"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-sm text-gray-400 animate-pulse">Loading dashboard…</div>
    </div>
  ),
});

export default function DashboardShellClient({
  initial,
}: {
  initial: any;
}) {
  return <DashboardShell initial={initial} />;
}
