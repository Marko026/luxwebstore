"use client";

import { useState } from "react";
import { AuthModal } from "@/components/auth/auth-modal";

/** A note that the page needs a User, and a button that opens the sign-in dialog over it. */
export function SignInPrompt({ message }: { message: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="text-center">
      <p className="text-sm">{message}</p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="btn btn-dark mt-8 h-12 px-10"
      >
        Sign in
      </button>
      <AuthModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
