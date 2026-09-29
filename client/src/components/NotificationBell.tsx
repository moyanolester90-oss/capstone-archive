import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Bell, CheckCircle2, Info, XCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const ICONS = {
  success: <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />,
  error: <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />,
  info: <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />,
};

function readSeen(key: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || "[]"));
  } catch {
    return new Set();
  }
}

/** Bell icon with a badge for new notifications about submissions, requests and reviews. */
export default function NotificationBell({ userId }: { userId: number }) {
  const storageKey = `capstone-notifications-seen-${userId}`;
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<Set<string>>(() => readSeen(storageKey));

  const { data: items = [] } = trpc.notifications.list.useQuery(undefined, {
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const unread = useMemo(() => items.filter(n => !seen.has(n.id)).length, [items, seen]);

  // Closing the list marks everything that was shown as read.
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next || items.length === 0) return;
    const nextSeen = new Set(items.map(n => n.id));
    setSeen(nextSeen);
    try {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(nextSeen)));
    } catch {
      // Storage unavailable (private mode): the badge just resets on reload.
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unread ? ` (${unread} new)` : ""}`}>
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3 font-semibold text-sm">Notifications</div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">You're all caught up.</p>
          ) : (
            items.map(n => (
              <Link
                key={n.id}
                href={n.href}
                onClick={() => handleOpenChange(false)}
                className={cn(
                  "flex gap-3 px-4 py-3 border-b last:border-b-0 no-underline hover:bg-muted/50 transition-colors",
                  !seen.has(n.id) && "bg-primary/5"
                )}
              >
                {ICONS[n.kind]}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{n.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                </div>
              </Link>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
