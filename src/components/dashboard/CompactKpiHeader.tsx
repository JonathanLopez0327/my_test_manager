import { Card } from "../ui/Card";

type CompactKpiHeaderProps = {
  items: Array<{
    id: string;
    label: string;
    value: string;
    microcopy: string;
    tone: "success" | "danger" | "warning" | "neutral";
  }>;
};

const toneClassMap: Record<
  CompactKpiHeaderProps["items"][number]["tone"],
  string
> = {
  success: "text-success-500",
  danger: "text-danger-500",
  warning: "text-warning-500",
  neutral: "text-ink",
};

export function CompactKpiHeader({ items }: CompactKpiHeaderProps) {
  return (
    <Card className="p-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-lg border border-stroke bg-surface-muted/50 px-3 py-2.5"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-soft">
              {item.label}
            </p>
            <p className={`mt-2 text-lg font-semibold ${toneClassMap[item.tone]}`}>
              {item.value}
            </p>
            <p className="mt-1 text-[11px] text-ink-muted">{item.microcopy}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
