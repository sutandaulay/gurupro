"use client"

import * as React from "react"
import { format } from "date-fns"
import { id } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface DateRange {
  from: Date | undefined
  to: Date | undefined
}

interface DateRangePickerProps {
  dateRange: DateRange
  onDateRangeChange: (range: DateRange) => void
  className?: string
}

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label className="text-xs font-medium text-gray-700">Rentang Tanggal</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date-range"
            variant={"outline"}
            className={cn(
              "h-9 w-full justify-between text-left font-normal bg-white",
              !dateRange && "text-muted-foreground"
            )}
          >
            <span className="truncate">
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "dd MMM yyyy", { locale: id })} -{" "}
                    {format(dateRange.to, "dd MMM yyyy", { locale: id })}
                  </>
                ) : (
                  format(dateRange.from, "dd MMM yyyy", { locale: id })
                )
              ) : (
                <span className="text-gray-400">Pilih rentang tanggal</span>
              )}
            </span>
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0 text-gray-500" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-4 bg-white text-gray-900" align="start">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-gray-500">Dari</Label>
              <input
                type="date"
                value={dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : ""}
                onChange={(e) => {
                  const from = e.target.value ? new Date(e.target.value + "T00:00:00") : undefined
                  onDateRangeChange({ from, to: dateRange?.to })
                }}
                className="h-9 w-full rounded-md border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-gray-500">Sampai</Label>
              <input
                type="date"
                value={dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : ""}
                onChange={(e) => {
                  const to = e.target.value ? new Date(e.target.value + "T00:00:00") : undefined
                  onDateRangeChange({ from: dateRange?.from, to })
                }}
                className="h-9 w-full rounded-md border border-gray-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
