import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Calendar } from "@/components/ui/calendar";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface MobileDatePickerProps {
  selected: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  children: React.ReactNode;
  disabled?: boolean;
}

const MobileDatePicker: React.FC<MobileDatePickerProps> = ({ selected, onSelect, children, disabled }) => {
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (isMobile) {
    return (
      <>
        <div onClick={() => !disabled && setSheetOpen(true)}>
          {children}
        </div>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="bottom" className="px-0 pb-8">
            <div className="flex justify-center pt-2">
              <Calendar
                mode="single"
                selected={selected}
                onSelect={(date) => {
                  onSelect(date);
                  setSheetOpen(false);
                }}
                locale={de}
                className={cn("p-3 pointer-events-auto rounded-md")}
              />
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="center">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={onSelect}
          initialFocus
          locale={de}
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
};

export default MobileDatePicker;
