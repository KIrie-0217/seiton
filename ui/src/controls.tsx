/**
 * Thin, styled wrappers over React Aria Components used across the app.
 * Behaviour, focus and accessibility come from React Aria; appearance comes
 * from `styles.css` (class names below and RAC's data attributes).
 */
import type { ReactNode } from "react";
import {
  Button,
  Checkbox as AriaCheckbox,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  Label,
  Tooltip,
  TooltipTrigger,
  type CheckboxProps,
  type Key,
} from "react-aria-components";
import { ChevronIcon } from "./icons";

interface IconButtonProps {
  /** Accessible name, also shown as the tooltip. */
  label: string;
  icon: ReactNode;
  onPress?: () => void;
  isDisabled?: boolean;
  /** Tooltip text when it should differ from the label (e.g. why it is disabled). */
  tooltip?: string;
}

/** Square icon button with a tooltip. */
export function IconButton({ label, icon, onPress, isDisabled, tooltip }: IconButtonProps) {
  return (
    <TooltipTrigger delay={500} closeDelay={0}>
      <Button className="icon-button" aria-label={label} onPress={onPress} isDisabled={isDisabled}>
        {icon}
      </Button>
      <Tooltip className="tooltip" offset={6}>
        {tooltip ?? label}
      </Tooltip>
    </TooltipTrigger>
  );
}

export interface Option<T extends Key> {
  value: T;
  label: string;
}

interface SelectFieldProps<T extends Key> {
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  className?: string;
}

/** Labelled single-choice select (button + listbox popover). */
export function SelectField<T extends Key>({ label, value, options, onChange, className }: SelectFieldProps<T>) {
  return (
    <Select
      className={`select-field${className ? ` ${className}` : ""}`}
      value={value}
      onChange={(key) => {
        if (key !== null) onChange(key as T);
      }}
    >
      <Label>{label}</Label>
      <Button className="select-button">
        <SelectValue />
        <ChevronIcon />
      </Button>
      <Popover className="popover" offset={4}>
        <ListBox className="listbox" items={options.map((o) => ({ id: o.value, label: o.label }))}>
          {(item) => (
            <ListBoxItem className="listbox-item" id={item.id} textValue={item.label}>
              {item.label}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </Select>
  );
}

/** Checkbox with a drawn box (works standalone or inside a CheckboxGroup). */
export function Checkbox({ children, className, ...props }: Omit<CheckboxProps, "children" | "className"> & {
  children: ReactNode;
  className?: string;
}) {
  return (
    <AriaCheckbox className={`checkbox${className ? ` ${className}` : ""}`} {...props}>
      {({ isIndeterminate }) => (
        <>
          <span className="checkbox-box" aria-hidden="true">
            <svg viewBox="0 0 12 12" width="12" height="12">
              {isIndeterminate ? <path d="M3 6h6" /> : <path d="M2.5 6.2 5 8.6l4.5-5" />}
            </svg>
          </span>
          {children}
        </>
      )}
    </AriaCheckbox>
  );
}
