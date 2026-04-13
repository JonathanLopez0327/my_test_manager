"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Sheet } from "../ui/Sheet";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";

type ProfileSheetProps = {
  open: boolean;
  onClose: () => void;
};

function EyeToggle({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="transition-colors hover:text-ink"
      tabIndex={-1}
    >
      {visible ? (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      )}
    </button>
  );
}

export function ProfileSheet({ open, onClose }: ProfileSheetProps) {
  const { data: session, update } = useSession();

  const [fullName, setFullName] = useState(session?.user?.name ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setError("");

    if (password && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          ...(password ? { password } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.message ?? "Could not update profile.");
        return;
      }

      // Refresh the session so the new name shows immediately
      await update({ name: fullName.trim() });
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirm(false);
      onClose();
    } catch {
      setError("Could not update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} title="Edit profile" onClose={onClose} width="md">
      <div className="flex flex-col gap-5">
        <Input
          label="Email"
          value={session?.user?.email ?? ""}
          disabled
          hint="Email cannot be changed"
        />

        <Input
          label="Name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Your full name"
        />

        <Input
          label="Password"
          type={showPassword ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Leave empty to keep current"
          hint="Minimum 8 characters"
          trailingIcon={
            <EyeToggle visible={showPassword} onClick={() => setShowPassword((v) => !v)} />
          }
        />

        <Input
          label="Confirm password"
          type={showConfirm ? "text" : "password"}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Repeat password"
          error={confirmPassword && password !== confirmPassword ? "Passwords do not match" : undefined}
          trailingIcon={
            <EyeToggle visible={showConfirm} onClick={() => setShowConfirm((v) => !v)} />
          }
        />

        {error && (
          <p className="text-sm font-medium text-danger-600">{error}</p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
