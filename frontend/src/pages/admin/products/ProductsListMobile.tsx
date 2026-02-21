import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import type { Product } from "@/types/products";
import type { Series } from "@/types/turtleAlbum";
import { Edit, Eye, Trash2 } from "lucide-react";

import { getPageNumbers } from "./pagination";

type Props = {
  products: Product[];
  seriesList: Series[];
  getPrimaryImageUrl: (product: Product) => string | null;
  onView: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (productId: string) => void;

  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function ProductsListMobile({
  products,
  seriesList,
  getPrimaryImageUrl,
  onView,
  onEdit,
  onDelete,
  currentPage,
  totalPages,
  onPageChange,
}: Props) {
  return (
    <div className="block md:hidden space-y-3">
      {products.length > 0 ? (
        products.map((product) => (
          <Card key={product.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex gap-3">
                <div className="h-20 w-20 rounded bg-gray-100 overflow-hidden flex-shrink-0">
                  {getPrimaryImageUrl(product) ? (
                    <img
                      src={getPrimaryImageUrl(product)!}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-gray-300">
                      <Eye className="h-6 w-6" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate mb-1">{product.name}</h3>
                  <p className="text-sm text-gray-600 mb-1">编号: {product.code}</p>
                  <div className="flex gap-2 text-sm text-gray-600">
                    <span>{product.sex === "male" ? "公" : product.sex === "female" ? "母" : "-"}</span>
                    <span>•</span>
                    <span>{seriesList.find((s) => s.id === product.seriesId)?.name || "-"}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onView(product)}
                    className="text-gray-600 hover:text-gray-900 h-8 w-8 p-0"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(product)}
                    className="text-gray-600 hover:text-gray-900 h-8 w-8 p-0"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(product.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <Card>
          <CardContent className="p-8 text-center text-gray-600">没有找到符合条件的产品</CardContent>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="pt-4">
          <Pagination>
            <PaginationContent>
              {currentPage > 1 && (
                <PaginationItem>
                  <PaginationPrevious onClick={() => onPageChange(currentPage - 1)} />
                </PaginationItem>
              )}

              {getPageNumbers(currentPage, totalPages).map((number, idx) =>
                number === "ellipsis" ? (
                  <PaginationItem key={`ellipsis-${idx}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={number}>
                    <PaginationLink isActive={currentPage === number} onClick={() => onPageChange(Number(number))}>
                      {number}
                    </PaginationLink>
                  </PaginationItem>
                )
              )}

              {currentPage < totalPages && (
                <PaginationItem>
                  <PaginationNext onClick={() => onPageChange(currentPage + 1)} />
                </PaginationItem>
              )}
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
