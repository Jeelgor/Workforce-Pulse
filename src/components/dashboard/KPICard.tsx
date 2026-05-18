"use client";
import * as React from "react";
import { formatINR, formatHours } from "@/lib/utils/index";

function IconClock() {
  return (
    <svg className="h-5 w-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
      <circle cx="12" cy="12" r="9" strokeWidth="1.5" />
    </svg>
  );
}

function IconCurrency() {
  return (
    <svg className="h-5 w-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M12 8c-2 0-3 1-3 2s1 2 3 2 3 1 3 2-1 2-3 2" />
      <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M12 4v2m0 12v2" />
    </svg>
  );
}

export default function KPICard({
  title,
  value,
  description,
  meta,
  icon,
  loading = false,
}: {
  title: string;
  value: React.ReactNode;
  description?: string;
  meta?: string[];
  icon?: "clock" | "currency" | null;
  loading?: boolean;
}) {
  let formatted: React.ReactNode = value;
  if (typeof value === "number") {
    const t = title.toLowerCase();
    if (t.includes("inr") || t.includes("₹")) formatted = formatINR(value);
    else if (t.includes("hour") || t.includes("hrs")) formatted = formatHours(value);
    else formatted = value;
  }

  const showIcon =
    icon === "clock" ? <IconClock /> :
    icon === "currency" ? <IconCurrency /> :
    null;

  return (
    <div className="rounded-lg border bg-white shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="text-sm font-medium text-gray-500">{title}</div>
        {showIcon}
      </div>

      {loading ? (
        <div className="h-10 w-40 animate-pulse rounded bg-gray-100" />
      ) : (
        <div className="text-3xl font-semibold text-gray-900 leading-tight">
          {formatted}
        </div>
      )}

      {description && (
        <div className="mt-1.5 text-xs text-gray-500">{description}</div>
      )}
      {meta && meta.length > 0 && (
        <div className="mt-2 text-xs text-gray-400">{meta.join(" · ")}</div>
      )}
    </div>
  );
}
