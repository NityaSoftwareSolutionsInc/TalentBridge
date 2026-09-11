"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn, FieldSelect } from "./workspace-ui";
import { PAGE_SIZES, type PageSlice } from "@/lib/paging";

export function ListPager<T>({
  slice,
  onPageChange,
  onPageSizeChange,
  sizes = PAGE_SIZES,
}: {
  slice: PageSlice<T>;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  sizes?: readonly number[];
}) {
  const atStart = slice.page <= 1;
  const atEnd = slice.page >= slice.pages;
  return (
    <div className="px-2.5 py-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] text-[12px] text-[var(--color-text-muted)] min-w-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <div className="shrink-0 whitespace-nowrap">
          <span className="text-[var(--color-text-muted)]">Total</span>{" "}
          <span className="font-semibold text-[var(--color-text)] tabular-nums">{slice.total}</span>
        </div>
        <div className="flex-1 flex items-center justify-center gap-0.5 min-w-0">
          <PagerIconButton
            label="Previous page"
            disabled={atStart || slice.total === 0}
            onClick={() => onPageChange(slice.page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </PagerIconButton>
          <span className="px-1 text-center tabular-nums whitespace-nowrap">
            {slice.pages ? (
              <>
                <span className="font-semibold text-slate-900">{slice.page}</span>
                <span className="text-slate-400">/</span>
                <span>{slice.pages}</span>
              </>
            ) : (
              "0/0"
            )}
          </span>
          <PagerIconButton
            label="Next page"
            disabled={atEnd || slice.total === 0}
            onClick={() => onPageChange(slice.page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </PagerIconButton>
        </div>
        <FieldSelect
          aria-label="Page size"
          title="Page size"
          wrapClassName="w-[4.25rem] shrink-0"
          className="h-7 text-[12px] pl-2 pr-7 hover:border-blue-400"
          value={String(slice.pageSize)}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          {sizes.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </FieldSelect>
      </div>
    </div>
  );
}

function PagerIconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700",
        "transition-colors cursor-pointer hover:border-blue-500 hover:bg-blue-50 hover:text-blue-700",
        "disabled:opacity-35 disabled:cursor-not-allowed disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-700",
      )}
    >
      {children}
    </button>
  );
}
