import React from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEditMode: boolean;
  titleEdit?: string;
  titleDetail?: string;
  descriptionEdit?: string;
  descriptionDetail?: string;
  detail: React.ReactNode;
  edit: React.ReactNode;
};

export function ProductSheet({
  open,
  onOpenChange,
  isEditMode,
  titleEdit = "编辑产品",
  titleDetail = "产品详情",
  descriptionEdit = "编辑产品的详细信息",
  descriptionDetail = "查看产品的详细信息",
  detail,
  edit,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditMode ? titleEdit : titleDetail}</SheetTitle>
          <SheetDescription>
            {isEditMode ? descriptionEdit : descriptionDetail}
          </SheetDescription>
        </SheetHeader>

        {isEditMode ? edit : detail}
      </SheetContent>
    </Sheet>
  );
}
