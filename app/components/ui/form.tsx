"use client";

import React, { useState } from "react";
import { IconEye, IconEyeOff, IconChevronDown } from "@tabler/icons-react";

/* ─── Label ─── */

interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export function Label({ children, required, className = "", ...props }: LabelProps) {
  return (
    <label
      className={`block text-sm font-medium text-gray-700 ${className}`}
      {...props}
    >
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

/* ─── Input ─── */

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
  helperText?: string;
  icon?: React.ComponentType<{ size?: number; stroke?: number; className?: string }>;
  rightElement?: React.ReactNode;
}

export function Input({
  label,
  error,
  helperText,
  icon: Icon,
  rightElement,
  disabled,
  required,
  className = "",
  ...props
}: InputProps) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon
            size={18}
            stroke={1.5}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
          />
        )}
        <input
          disabled={disabled}
          className={`w-full rounded-lg border bg-white py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-150
            ${Icon ? "pl-10" : "pl-3.5"}
            ${rightElement ? "pr-10" : "pr-3.5"}
            ${
              error
                ? "border-red-500 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                : "border-gray-200 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
            }
            ${disabled ? "opacity-50 cursor-not-allowed bg-gray-50" : ""}`}
          {...props}
        />
        {rightElement && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
            {rightElement}
          </div>
        )}
      </div>
      {error ? (
        <p className="mt-1 text-xs font-medium text-red-600">{error}</p>
      ) : helperText ? (
        <p className="mt-1 text-xs text-gray-400">{helperText}</p>
      ) : null}
    </div>
  );
}

/* ─── PasswordInput ─── */

interface PasswordInputProps extends Omit<InputProps, "type" | "icon"> {
  icon?: React.ComponentType<{ size?: number; stroke?: number; className?: string }>;
}

export function PasswordInput(props: PasswordInputProps) {
  const [show, setShow] = useState(false);
  return (
    <Input
      {...props}
      type={show ? "text" : "password"}
      rightElement={
        <button
          type="button"
          onClick={() => setShow(!show)}
          tabIndex={-1}
          className="p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
          aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
        >
          {show ? <IconEyeOff size={18} stroke={1.5} /> : <IconEye size={18} stroke={1.5} />}
        </button>
      }
    />
  );
}

/* ─── Select ─── */

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
  error?: string | null;
}

export function Select({
  label,
  options,
  error,
  disabled,
  required,
  className = "",
  ...props
}: SelectProps) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          disabled={disabled}
          className={`w-full appearance-none rounded-lg border bg-white py-2.5 pl-3.5 pr-10 text-sm text-gray-900 outline-none transition-all duration-150
            ${
              error
                ? "border-red-500 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                : "border-gray-200 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
            }
            ${disabled ? "opacity-50 cursor-not-allowed bg-gray-50" : "cursor-pointer"}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <IconChevronDown
          size={18}
          stroke={1.5}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
        />
      </div>
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

/* ─── Textarea ─── */

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string | null;
  helperText?: string;
}

export function Textarea({
  label,
  error,
  helperText,
  disabled,
  required,
  className = "",
  ...props
}: TextareaProps) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <textarea
        disabled={disabled}
        className={`w-full rounded-lg border bg-white py-2.5 px-3.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-all duration-150 resize-y
          ${
            error
              ? "border-red-500 focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              : "border-gray-200 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
          }
          ${disabled ? "opacity-50 cursor-not-allowed bg-gray-50" : ""}`}
        {...props}
      />
      {error ? (
        <p className="mt-1 text-xs font-medium text-red-600">{error}</p>
      ) : helperText ? (
        <p className="mt-1 text-xs text-gray-400">{helperText}</p>
      ) : null}
    </div>
  );
}

/* ─── Checkbox ─── */

interface CheckboxProps {
  label?: string | React.ReactNode;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  error?: string | null;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({
  label,
  checked,
  onChange,
  error,
  disabled,
  className = "",
}: CheckboxProps) {
  return (
    <div className={className}>
      <label className="flex items-start gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange?.(e.target.checked)}
          disabled={disabled}
          className="mt-0.5 w-4 h-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        />
        {label && (
          <span className="text-sm text-gray-700 leading-relaxed">{label}</span>
        )}
      </label>
      {error && <p className="mt-1 text-xs font-medium text-red-600 ml-6">{error}</p>}
    </div>
  );
}

/* ─── PasswordStrength ─── */

interface PasswordStrengthProps {
  password: string;
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  if (!password) return null;

  const getStrength = () => {
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    return score;
  };

  const score = getStrength();
  const segments = [
    { filled: score >= 1, color: "bg-red-500" },
    { filled: score >= 2, color: "bg-orange-500" },
    { filled: score >= 3, color: "bg-yellow-500" },
    { filled: score >= 4, color: "bg-green-500" },
  ];

  let label = "";
  if (score <= 1) label = "Lemah";
  else if (score === 2) label = "Cukup";
  else if (score === 3) label = "Sedang";
  else label = "Kuat";

  const labelColor =
    score <= 1
      ? "text-red-600"
      : score === 2
        ? "text-orange-600"
        : score === 3
          ? "text-yellow-600"
          : "text-green-600";

  return (
    <div className="mt-2">
      <div className="flex gap-1.5">
        {segments.map((seg, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${
              seg.filled ? seg.color : "bg-gray-200"
            }`}
          />
        ))}
      </div>
      <p className={`mt-1 text-xs font-medium ${labelColor}`}>{label}</p>
    </div>
  );
}
