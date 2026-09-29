import { Link } from "wouter";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/** A small number tile used on the role dashboards. */
export default function StatCard({ label, value, icon: Icon, color, href }: {
  label: string; value: number | string; icon: LucideIcon; color: string; href?: string;
}) {
  const body = (
    <Card className="hover:shadow-md transition-all h-full">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className={`h-10 w-10 rounded-lg ${color} flex items-center justify-center`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          {href && <ArrowUpRight className="h-4 w-4 text-muted-foreground" />}
        </div>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href} className="no-underline">{body}</Link> : body;
}
