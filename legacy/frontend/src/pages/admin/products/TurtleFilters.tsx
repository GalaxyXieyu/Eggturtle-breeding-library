import React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import type { Series } from "@/types/turtleAlbum";

type Filters = {
  sex?: string;
  series_id?: string;
};

type Props = {
  filters: Filters;
  seriesList: Series[];
  onChange: (next: Filters) => void;
  onClear: () => void;
};

export function TurtleFilters({ filters, seriesList, onChange, onClear }: Props) {
  return (
    <div className="mb-4 flex flex-col sm:flex-row gap-3">
      <Select
        value={filters.sex || "all"}
        onValueChange={(value) => {
          onChange({
            ...filters,
            sex: value === "all" ? undefined : value,
          });
        }}
      >
        <SelectTrigger className="w-full sm:w-[180px] bg-white border-gray-200">
          <SelectValue placeholder="性别" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部性别</SelectItem>
          <SelectItem value="male">公</SelectItem>
          <SelectItem value="female">母</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.series_id || "all"}
        onValueChange={(value) => {
          onChange({
            ...filters,
            series_id: value === "all" ? undefined : value,
          });
        }}
      >
        <SelectTrigger className="w-full sm:w-[200px] bg-white border-gray-200">
          <SelectValue placeholder="种类" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部种类</SelectItem>
          {seriesList.map((series) => (
            <SelectItem key={series.id} value={series.id}>
              {series.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {(filters.sex || filters.series_id) && (
        <Button
          variant="outline"
          size="sm"
          onClick={onClear}
          className="border-gray-200"
        >
          <X className="h-4 w-4 mr-1" />
          清除筛选
        </Button>
      )}
    </div>
  );
}
