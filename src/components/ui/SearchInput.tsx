import type { InputHTMLAttributes } from "react";

import { IconSearch } from "../icons";
import { Input } from "./Input";

type SearchInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "type"
> & {
  onChange: (value: string) => void;
  containerClassName?: string;
};

// Shared search control for manager headers.
// Keeps icon, spacing, and input behavior consistent across modules.
export function SearchInput({
  value,
  onChange,
  containerClassName = "min-w-[220px] flex-1",
  ...props
}: SearchInputProps) {
  return (
    <div className={containerClassName}>
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        leadingIcon={<IconSearch className="h-4 w-4" />}
        {...props}
      />
    </div>
  );
}
