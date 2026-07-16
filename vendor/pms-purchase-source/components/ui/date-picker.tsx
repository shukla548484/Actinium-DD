"use client"

import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface DatePickerProps {
  value?: string | Date | null
  onChange?: (dateStr: string) => void
  onDateChange?: (date: Date | null) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  triggerClassName?: string
  fromYear?: number
  toYear?: number
  id?: string
}

function toDate(v: string | Date | null | undefined): Date | undefined {
  if (!v) return undefined
  if (v instanceof Date) return isValid(v) ? v : undefined
  const d = parse(v, "yyyy-MM-dd", new Date())
  return isValid(d) ? d : undefined
}

function DatePicker({
  value,
  onChange,
  onDateChange,
  placeholder = "Pick a date",
  disabled = false,
  className,
  triggerClassName,
  fromYear = 2000,
  toYear = 2040,
  id,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = toDate(value)

  const handleSelect = (day: Date | undefined) => {
    if (day) {
      const str = format(day, "yyyy-MM-dd")
      onChange?.(str)
      onDateChange?.(day)
    } else {
      onChange?.("")
      onDateChange?.(null)
    }
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-start text-left font-normal",
            !selected && "text-muted-foreground",
            triggerClassName,
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selected ? format(selected, "dd/MM/yyyy") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          captionLayout="dropdown"
          fromYear={fromYear}
          toYear={toYear}
          defaultMonth={selected}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
