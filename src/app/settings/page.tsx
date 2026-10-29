import type { Metadata } from "next";
import { SmartSuggestionsCard } from "@/components/settings/SmartSuggestionsCard";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Preferences for Ledgerly in this browser.</p>
      </div>
      <div className="max-w-2xl">
        <SmartSuggestionsCard />
      </div>
    </div>
  );
}
