"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ThemeOption = { value: string; label: string };

export function ThemeSelect({
  value,
  onChange,
  options,
  required = false,
  placeholder = "Pilih",
}: {
  value: string;
  onChange: (value: string) => void;
  options: ThemeOption[];
  required?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState({ top: 0, left: 0, width: 0, maxHeight: 240 });
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value);

  useLayoutEffect(() => {
    if (!open) return;
    const node = trigger.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(140, Math.min(280, openUp ? spaceAbove : spaceBelow));
    setBox({
      top: openUp ? Math.max(8, rect.top - maxHeight - 6) : rect.bottom + 6,
      left: rect.left,
      width: rect.width,
      maxHeight,
    });
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (root.current?.contains(target) || menu.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="theme-select" ref={root}>
      <button
        ref={trigger}
        type="button"
        className="theme-select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected?.label || placeholder}</span>
        <ChevronDown size={17} />
      </button>
      {required && (
        <input
          className="theme-select-required"
          tabIndex={-1}
          aria-hidden="true"
          required
          value={value}
          onChange={() => undefined}
        />
      )}
      {open &&
        createPortal(
          <div
            ref={menu}
            id={listId}
            className="theme-select-menu"
            role="listbox"
            style={{
              top: box.top,
              left: box.left,
              width: box.width,
              maxHeight: box.maxHeight,
            }}
          >
            {options.map((option) => (
              <button
                type="button"
                role="option"
                key={option.value || "empty"}
                aria-selected={option.value === value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
