import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";

import { ProductImportDialog } from "@/components/admin/ProductImportDialog";

type Props = {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onCreateClick: () => void;
  onImportSuccess: () => void;
};

export function ProductsToolbar({
  searchQuery,
  onSearchQueryChange,
  onCreateClick,
  onImportSuccess,
}: Props) {
  return (
    <div className="mb-4 flex flex-col sm:flex-row gap-4 justify-between items-center">
      <div className="relative w-full sm:w-80">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-600 h-4 w-4" />
        <Input
          placeholder="搜索产品..."
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          className="pl-10 bg-white border-gray-200"
        />
      </div>
      <div className="flex gap-2 w-full sm:w-auto">
        <ProductImportDialog onSuccess={onImportSuccess} />
        <Button
          className="bg-gray-900 hover:bg-gray-800 text-white flex-1 sm:flex-none"
          onClick={onCreateClick}
        >
          <Plus className="mr-2 h-4 w-4" />
          添加产品
        </Button>
      </div>
    </div>
  );
}
