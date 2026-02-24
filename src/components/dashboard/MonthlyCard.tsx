import { Card } from "../ui/Card";

export function MonthlyCard() {
  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-[#3830B1] p-6 text-white">
      <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/10" />
      <p className="text-xs uppercase tracking-[0.2em] text-white/70">
        Active testers
      </p>
      <p className="mt-3 text-3xl font-semibold">3,240</p>
      <p className="mt-1 text-xs text-white/70">Contributing this month</p>
      <div className="mt-6 flex items-center gap-3 text-xs text-white/80">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-white" />
          Manual: 62%
        </span>
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-white/60" />
          Automated: 38%
        </span>
      </div>
    </Card>
  );
}
