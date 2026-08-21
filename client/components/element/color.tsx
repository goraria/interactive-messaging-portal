"use client"

import type { ComponentProps, CSSProperties, ReactNode } from "react"
import { useCallback, useState } from "react"
import { cn } from "@/lib/utils"
import {
  Building,
  CreditCard,
  PaintBucket,
  Settings2,
} from "@gorth/primitive/cores/lucide"
import { Label } from "@/components/primitive/default"
import { RadioGroupItem } from "@/components/primitive/default"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/primitive/default"
import { Separator } from "@/components/primitive/default"
import { Badge } from "@/components/primitive/custom"
import { RadioGroup } from "@/components/primitive/default"

import { Button } from "@/components/primitive/custom"

const COLOR_COOKIE_NAME = "color_state"
const COLOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const COLOR_SHEET_WIDTH = "328px"
const COLOR_WIDTH_MOBILE = "18rem"
const COLOR_WIDTH_ICON = "3.25rem"
const COLOR_KEYBOARD_SHORTCUT = "c"

const COLOR_OPTIONS = [
  {
    label: "Professional Main",
    value: "professional-main",
    swatchClassName: "bg-professional-main",
    ringClassName: "ring-professional-main",
  },
  {
    label: "Primary 1",
    value: "professional-primary-1",
    swatchClassName: "bg-professional-primary-1",
    ringClassName: "ring-professional-primary-1",
  },
  {
    label: "Primary 2",
    value: "professional-primary-2",
    swatchClassName: "bg-professional-primary-2",
    ringClassName: "ring-professional-primary-2",
  },
  {
    label: "Primary 3",
    value: "professional-primary-3",
    swatchClassName: "bg-professional-primary-3",
    ringClassName: "ring-professional-primary-3",
  },
  {
    label: "Primary 4",
    value: "professional-primary-4",
    swatchClassName: "bg-professional-primary-4",
    ringClassName: "ring-professional-primary-4",
  },
  {
    label: "Primary 5",
    value: "professional-primary-5",
    swatchClassName: "bg-professional-primary-5",
    ringClassName: "ring-professional-primary-5",
  },
  {
    label: "Primary",
    value: "primary",
    swatchClassName: "bg-primary",
    ringClassName: "ring-primary",
  },
]

export function Customizer({
  className,
  ...props
}: ComponentProps<"span"> & {
  className?: string
}) {
  const [selectedColor, setSelectedColor] = useState("primary")
  const [selectedOption, setSelectedOption] = useState("")
  const setColor = useCallback((color: string) => {
    setSelectedColor(color)
    document.cookie = `${COLOR_COOKIE_NAME}=${encodeURIComponent(color)}; path=/; max-age=${COLOR_COOKIE_MAX_AGE}`
  }, [])

  return (
    <span className={className} {...props}>
      <Sheet>
        <SheetTrigger
          render={
            <Button variant="default" className="cursor-pointer" size="icon" />
          }
        >
          <Settings2 />
          <span className="sr-only">Quick Setting</span>
        </SheetTrigger>
        <SheetContent
          className="w-auto"
          style={{
            width: COLOR_SHEET_WIDTH,
            maxWidth: COLOR_SHEET_WIDTH,
          }}
        >
          <SheetHeader className="pb-0">
            <SheetTitle>Theme Customizer</SheetTitle>
            <SheetDescription>
              Customize & Preview in Real Time
            </SheetDescription>
          </SheetHeader>
          <Separator />
          <div className="flex flex-col gap-1.5 p-4 pb-0">
            <Badge variant="secondary" className="rounded">
              Theming
            </Badge>
          </div>
          <div className="flex flex-col gap-1.5 p-4">
            <RadioGroup value={selectedColor} onValueChange={setColor}>
              <div className="grid grid-cols-6 gap-4">
                {COLOR_OPTIONS.map((color) => (
                  <Button
                    key={color.value}
                    variant="outline"
                    onClick={() => setColor(color.value)}
                    className={cn(
                      "hover:bg-accent flex h-9 w-9 cursor-pointer bg-transparent p-0 shadow-none transition-[box-shadow,transform] hover:scale-105 hover:shadow-none",
                      selectedColor === color.value &&
                        "ring-offset-background ring-3 ring-offset-2"
                    )}
                    style={
                      {
                        "--tw-ring-color": `var(--${color.value})`,
                      } as CSSProperties
                    }
                  >
                    <span
                      className={cn(
                        "h-4 w-4 rounded-sm",
                        color.swatchClassName
                      )}
                    />
                    <span className="sr-only">{color.label}</span>
                  </Button>
                ))}
                <Button
                  variant="outline"
                  onClick={() => setColor("custom")}
                  className={cn(
                    "hover:bg-accent flex h-9 w-9 cursor-pointer border bg-transparent p-0 transition-[box-shadow,transform] hover:scale-105",
                    selectedColor === "custom"
                      ? "ring-primary ring-offset-background ring-3 ring-offset-2"
                      : "hover:border-primary/50"
                  )}
                >
                  <PaintBucket className="h-4 w-4" />
                  <span className="sr-only">Custom color</span>
                </Button>
              </div>
            </RadioGroup>
          </div>
          <div className="flex flex-col gap-1.5 p-4">
            <RadioGroup
              value={selectedOption}
              onValueChange={setSelectedOption}
            >
              <div className="space-y-4">
                <div
                  onClick={() => setSelectedOption("payment")}
                  className={cn(
                    "flex cursor-pointer items-center space-x-2 rounded border-2 p-3 transition-colors",
                    selectedOption === "payment"
                      ? "border-primary"
                      : "hover:border-primary/50"
                  )}
                >
                  <RadioInputOption
                    label="Payment Data"
                    description="Basic payment information"
                    value="payment"
                    onSelect={setSelectedOption}
                    flip="horizontal"
                    pull="center"
                    border="square"
                    icon={<CreditCard className="h-4 w-4" />}
                  />
                </div>

                <div
                  onClick={() => setSelectedOption("business")}
                  className={cn(
                    "flex cursor-pointer items-center space-x-2 rounded border-2 p-3 transition-colors",
                    selectedOption === "business"
                      ? "border-primary"
                      : "hover:border-primary/50"
                  )}
                >
                  <RadioInputOption
                    label="For Business Sharks"
                    description="Advanced business features"
                    value="business"
                    onSelect={setSelectedOption}
                    flip="vertical"
                    pull="right"
                    border="square"
                    type="hidden"
                    icon={<Building className="h-4 w-4" />}
                  />
                </div>
              </div>
            </RadioGroup>
          </div>
        </SheetContent>
      </Sheet>
    </span>
  )
}

type Flip = "horizontal" | "vertical"
type Pull = "left" | "right" | "center"
type Border = "square" | "circle"
type InputVisibility = "visible" | "hidden"

const flipClasses: Record<Flip, string> = {
  horizontal: "flex-row-reverse",
  vertical: "flex-col-reverse",
}

const pullClasses: Record<Pull, string> = {
  left: "justify-start",
  right: "justify-end",
  center: "justify-center",
}

const borderClasses: Record<Border, string> = {
  square: "rounded",
  circle: "rounded-full",
}

interface RadioInputOptionProps {
  label: string
  description?: string
  value: string
  type?: InputVisibility
  className?: string
  icon?: ReactNode
  flip?: Flip
  pull?: Pull
  border?: Border
  onSelect: (value: string) => void
}

export function RadioInputOption({
  label = "",
  description = "",
  value,
  type = "visible",
  icon,
  flip,
  pull = "left",
  border = "square",
  onSelect,
  className,
}: RadioInputOptionProps) {
  return (
    <div
      onClick={() => onSelect(value)}
      className={cn(
        "flex cursor-pointer border-transparent transition-colors",
        flip && flipClasses[flip],
        pullClasses[pull],
        borderClasses[border],
        className
      )}
    >
      <RadioGroupItem
        className={cn(type === "hidden" && "hidden")}
        value={value}
        id={value}
      />
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          {icon}
          <Label htmlFor={value}>{label}</Label>
        </div>
        {description && (
          <span className="text-muted-foreground text-sm">{description}</span>
        )}
      </div>
    </div>
  )
}
