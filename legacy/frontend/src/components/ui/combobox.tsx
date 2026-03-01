import * as React from "react"
import { Check, ChevronsUpDown, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface ComboboxProps {
  options: string[]
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  emptyMessage?: string
  allowCustom?: boolean
  onAddCustom?: (value: string) => void
  className?: string
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "选择选项...",
  emptyMessage = "没有找到选项",
  allowCustom = false,
  onAddCustom,
  className
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

  // 确保 options 是数组
  const safeOptions = Array.isArray(options) ? options : []

  const filteredOptions = safeOptions.filter(option =>
    option && option.toLowerCase().includes(searchValue.toLowerCase())
  )

  const handleSelect = (currentValue: string) => {
    onValueChange(currentValue === value ? "" : currentValue)
    setOpen(false)
    setSearchValue("")
  }

  const handleAddCustom = () => {
    if (searchValue.trim() && !safeOptions.includes(searchValue.trim())) {
      if (onAddCustom) {
        onAddCustom(searchValue.trim())
      }
      onValueChange(searchValue.trim())
      setOpen(false)
      setSearchValue("")
    }
  }

  const showAddCustom = allowCustom &&
    searchValue.trim() &&
    !safeOptions.some(option => option && option.toLowerCase() === searchValue.toLowerCase()) &&
    filteredOptions.length === 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput 
            placeholder={`搜索${placeholder}...`}
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            {filteredOptions.length === 0 && !showAddCustom && (
              <CommandEmpty>{emptyMessage}</CommandEmpty>
            )}
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => handleSelect(option)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option}
                </CommandItem>
              ))}
              {showAddCustom && (
                <CommandItem onSelect={handleAddCustom}>
                  <Plus className="mr-2 h-4 w-4" />
                  添加 "{searchValue}"
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
} 