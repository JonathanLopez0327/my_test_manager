import { Card } from "../ui/Card";

type ProgressCardProps = {
  title: string;
  percent: number;
  detail: string;
};

export function ProgressCard({ title, percent, detail }: ProgressCardProps) {
  return (
    <Card className="flex h-full flex-col justify-between p-6">
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-1 text-xs text-ink-muted">{detail}</p>
      </div>
      <div className="mt-6 flex items-center justify-center">
        <div
          className="flex h-28 w-28 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(#5750F1 ${percent * 3.6}deg, rgba(87,80,241,0.12) 0deg)`,
          }}
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-elevated text-lg font-semibold text-ink dark:bg-surface-muted">
            {percent}%
          </div>
        </div>
      </div>
    </Card>
  );
}
