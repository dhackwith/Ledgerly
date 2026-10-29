"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRecurring } from "@/components/providers/RecurringProvider";
import { UpcomingList } from "@/components/recurring/UpcomingList";
import { Card } from "@/components/ui/Card";
import { ListSkeleton } from "@/components/ui/Skeleton";

const LIMIT = 5;

/** Dashboard card listing the next few scheduled recurring expenses. */
export function UpcomingRecurringCard() {
  const { rules, status, upcoming } = useRecurring();
  const items = useMemo(() => upcoming(LIMIT), [upcoming]);

  return (
    <Card
      title="Upcoming recurring"
      subtitle={`Next ${LIMIT} scheduled expenses`}
      bodyClassName=""
      action={
        <Link href="/recurring" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
          Manage
        </Link>
      }
    >
      {status === "loading" ? (
        <ListSkeleton rows={2} />
      ) : rules.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-500">
          No recurring expenses yet.{" "}
          <Link href="/recurring" className="font-semibold text-brand-600 hover:text-brand-700">
            Add one
          </Link>{" "}
          for rent, subscriptions and other bills that repeat.
        </p>
      ) : items.length ? (
        <UpcomingList items={items} />
      ) : (
        <p className="px-5 py-6 text-sm text-slate-500">All your recurring rules are paused or finished.</p>
      )}
    </Card>
  );
}
