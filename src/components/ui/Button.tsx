import * as React from "react";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  isLoading?: boolean;
};

export function Button({
  isLoading,
  className = "",
  disabled,
  children,
  ...props
}: ButtonProps) {
  const isDisabled = Boolean(disabled || isLoading);

  return (
    <button
      className={[
        "inline-flex w-full items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white",
        "hover:bg-zinc-800",
        "focus:outline-none focus:ring-2 focus:ring-zinc-900/20",
        "disabled:opacity-60 disabled:cursor-not-allowed",
        className,
      ].join(" ")}
      disabled={isDisabled}
      {...props}
    >
      {isLoading ? "Please wait..." : children}
    </button>
  );
}


