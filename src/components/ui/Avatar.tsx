type AvatarProps = {
  name: string;
  role?: string;
};

export function Avatar({ name, role }: AvatarProps) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
        {initials}
      </div>
      <div className="hidden text-left sm:block">
        <p className="text-sm font-semibold text-ink">{name}</p>
        {role ? <p className="text-xs text-ink-soft">{role}</p> : null}
      </div>
    </div>
  );
}
