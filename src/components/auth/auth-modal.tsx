"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type InputHTMLAttributes } from "react";
import { authClient } from "@/lib/auth-client";
import { CloseIcon } from "@/components/home/icons";

type Mode = "sign-in" | "sign-up";
type Field = "name" | "email" | "password";
type Errors = Partial<Record<Field | "form", string>>;

/** Better Auth error codes shown under the field they belong to; anything else shows above the button. */
function toErrors(error: { code?: string; message?: string }): Errors {
  switch (error.code) {
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return { email: "An account with this email already exists." };
    case "INVALID_EMAIL":
      return { email: "Enter a valid email address." };
    case "PASSWORD_TOO_SHORT":
      return { password: "Use at least 8 characters." };
    case "PASSWORD_TOO_LONG":
      return { password: "Use at most 128 characters." };
    case "INVALID_EMAIL_OR_PASSWORD":
      return { password: "Incorrect email or password." };
    case "VALIDATION_ERROR": {
      // Body validation names the field in the message: "[body.email] Invalid email address"
      const field = /\[body\.(name|email|password)\]/.exec(error.message ?? "")?.[1] as Field | undefined;
      if (field === "email") return { email: "Enter a valid email address." };
      if (field) return { [field]: error.message!.replace(/^\[body\.\w+\]\s*/, "") };
      return { form: error.message || "Please check the form." };
    }
    default:
      return { form: error.message || "Something went wrong. Please try again." };
  }
}

const input =
  "h-11 w-full border-b border-line bg-transparent text-base transition-colors duration-(--t-ui) ease-lux placeholder:text-muted focus:border-ink focus:outline-none aria-invalid:border-b-2 aria-invalid:border-error";

/** Fades and slides in when it appears, so a new error catches the eye. */
const errorIn = "transition-[opacity,translate] duration-(--t-ui) ease-lux starting:-translate-y-1 starting:opacity-0";

function ErrorIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="mt-px size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6.75" />
      <path d="M8 4.5v4.25" strokeLinecap="round" />
      <circle cx="8" cy="11.25" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Sign in / create account over the current page, on a native <dialog> (focus trap, Esc and backdrop for free).
 * On success the session updates in place and the modal closes, so the visitor stays where they were.
 * Validation is the server's (except a required name): its errors show under the field they concern.
 */
export function AuthModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pressedOnBackdrop = useRef(false);
  const [mode, setMode] = useState<Mode>("sign-in");
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);
  const id = useId();

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setErrors({});
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const name = String(data.get("name") ?? "").trim();
    // The server accepts an empty name, which would leave the header blank
    if (mode === "sign-up" && !name) {
      setErrors({ name: "Enter your name." });
      return;
    }

    setPending(true);
    setErrors({});
    const { error } =
      mode === "sign-in"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name });
    setPending(false);

    if (error) {
      setErrors(toErrors(error));
      return;
    }
    form.reset();
    onClose();
  };

  const field = (name: Field, label: string, props: InputHTMLAttributes<HTMLInputElement>) => (
    <div>
      <label
        htmlFor={`${id}-${name}`}
        className={`text-xs font-bold uppercase transition-colors duration-(--t-ui) ease-lux ${errors[name] ? "text-error" : ""}`}
      >
        {label}
      </label>
      <input
        id={`${id}-${name}`}
        name={name}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? `${id}-${name}-error` : undefined}
        className={input}
        {...props}
      />
      {errors[name] && (
        <p id={`${id}-${name}-error`} className={`mt-2 flex gap-1.5 text-xs font-medium text-error ${errorIn}`}>
          <ErrorIcon />
          {errors[name]}
        </p>
      )}
    </div>
  );

  return (
    <dialog
      ref={dialog}
      aria-labelledby={`${id}-title`}
      // Every close path (Esc, backdrop, button, success) ends here: reopen in sign-in mode
      onClose={() => {
        switchMode("sign-in");
        onClose();
      }}
      // A click on the backdrop lands on the dialog element itself; the padding sits on the inner div so clicks there do not.
      // A drag from the form out to the backdrop also clicks the dialog (common ancestor), so the press must start there too.
      // Closing on pointerdown instead would let a tap fall through to the page under the closed dialog.
      onPointerDown={(e) => (pressedOnBackdrop.current = e.target === e.currentTarget)}
      onClick={(e) => pressedOnBackdrop.current && e.target === e.currentTarget && onClose()}
      className="m-auto w-[min(28rem,calc(100%-2rem))] bg-paper text-ink backdrop:bg-scrim backdrop:backdrop-blur-[15px]"
    >
      <div className="p-8 sm:p-12">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-ink text-paper transition-[scale] duration-(--t-press) active:scale-95"
        >
          <CloseIcon />
        </button>

        <h2 id={`${id}-title`} className="text-xl font-thin">
          {mode === "sign-in" ? "Sign in" : "Create an account"}
        </h2>
        <p className="mt-2 text-xs text-muted">
          {mode === "sign-in" ? "New to Luxwebstore? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => switchMode(mode === "sign-in" ? "sign-up" : "sign-in")}
            className="link-wipe text-ink"
          >
            {mode === "sign-in" ? "Create an account" : "Sign in"}
          </button>
        </p>

        {/* noValidate: the server's messages are the ones shown, under each field */}
        <form key={mode} onSubmit={onSubmit} noValidate className="mt-8 space-y-6">
          {mode === "sign-up" && field("name", "Name", { type: "text", autoComplete: "name" })}
          {field("email", "Email", { type: "email", autoComplete: "email" })}
          {field("password", "Password", {
            type: "password",
            autoComplete: mode === "sign-in" ? "current-password" : "new-password",
          })}
          {errors.form && (
            <p className={`flex gap-2 border-l-2 border-error bg-error/5 px-4 py-3 text-xs font-medium text-error ${errorIn}`}>
              <ErrorIcon />
              {errors.form}
            </p>
          )}
          {/* Announces errors to screen readers; the visible text is under each field */}
          <p aria-live="polite" className="sr-only">
            {Object.values(errors).join(" ")}
          </p>
          <button type="submit" disabled={pending} className="btn btn-dark h-12 w-full disabled:opacity-40">
            {pending ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>
    </dialog>
  );
}
