"use client";

import { useState } from "react";
import * as RS from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { menuItemClass, menuSurfaceClass, menuTriggerClass } from "./menu-styles";

export interface SelectOption {
  value: string;
  label: string;
}

// Radix reserves "" for "no value"; the app uses "" to mean "none", so map it through a sentinel.
const NONE = "__none__";
const toRadix = (v: string) => (v === "" ? NONE : v);
const fromRadix = (v: string) => (v === NONE ? "" : v);

interface Props {
  options: SelectOption[];
  /** Controlled value ("" = the option whose value is ""). */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Submits with forms through a hidden input. */
  name?: string;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Styled select with full keyboard support (arrows, Home/End, Enter/Space, Esc, type-to-search),
 * built on Radix so screen readers get a proper listbox.
 */
export function Select({ options, value, defaultValue = "", onValueChange, name, ariaLabel, disabled, className = "" }: Props) {
  const [internal, setInternal] = useState(defaultValue);
  const current = value ?? internal;

  return (
    <RS.Root
      value={toRadix(current)}
      onValueChange={(v) => {
        const next = fromRadix(v);
        if (value === undefined) setInternal(next);
        onValueChange?.(next);
      }}
      disabled={disabled}
    >
      <RS.Trigger
        aria-label={ariaLabel}
        className={`${menuTriggerClass} ${className}`}
      >
        <span className="truncate">
          <RS.Value />
        </span>
        <RS.Icon>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
        </RS.Icon>
      </RS.Trigger>
      {name && <input type="hidden" name={name} value={current} />}

      <RS.Portal>
        <RS.Content
          position="popper"
          sideOffset={6}
          className={`${menuSurfaceClass} max-h-[min(var(--radix-select-content-available-height),18rem)] min-w-[var(--radix-select-trigger-width)] overflow-hidden`}
        >
          <RS.ScrollUpButton className="flex h-6 items-center justify-center text-muted">
            <ChevronUp className="h-4 w-4" />
          </RS.ScrollUpButton>
          <RS.Viewport className="p-1">
            {options.map((o) => (
              <RS.Item
                key={o.value || NONE}
                value={toRadix(o.value)}
                className={`${menuItemClass} pl-8`}
              >
                <RS.ItemIndicator className="absolute left-2.5 inline-flex">
                  <Check className="h-4 w-4 text-accent" strokeWidth={2.5} />
                </RS.ItemIndicator>
                <RS.ItemText>{o.label}</RS.ItemText>
              </RS.Item>
            ))}
          </RS.Viewport>
          <RS.ScrollDownButton className="flex h-6 items-center justify-center text-muted">
            <ChevronDown className="h-4 w-4" />
          </RS.ScrollDownButton>
        </RS.Content>
      </RS.Portal>
    </RS.Root>
  );
}
