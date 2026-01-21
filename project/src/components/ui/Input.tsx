import * as React from "react";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, className = "", id, ...props }, ref) => {
    const inputId = id ?? props.name ?? label.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="space-y-2">
        <label htmlFor={inputId} className="text-sm font-medium text-zinc-900">
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          className={[
            "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900",
            "placeholder:text-zinc-400",
            "focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900/30",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            className,
          ].join(" ")}
          {...props}
        />
      </div>
    );
  },
);
Input.displayName = "Input";


