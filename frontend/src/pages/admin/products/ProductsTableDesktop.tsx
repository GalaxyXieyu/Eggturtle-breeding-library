import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationInfo, PaginationItem, PaginationLast, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Product } from "@/types/products";
import type { Series } from "@/types/turtleAlbum";
import { ArrowUpDown, Edit, Eye, Trash2 } from "lucide-react";
import { getStageLabel, getStatusLabel } from "@/constants/filterOptions";

import { getPageNumbers } from "./pagination";

type Props = {
  products: Product[];
  totalProducts: number;
  seriesList: Series[];
  getPrimaryImageUrl: (product: Product) => string | null;
  onView: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (productId: string) => void;

  onSort: (field: keyof Product) => void;

  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  onItemsPerPageChange: (n: number) => void;
  onPageChange: (page: number) => void;
};

export function ProductsTableDesktop({
  products,
  totalProducts,
  seriesList,
  getPrimaryImageUrl,
  onView,
  onEdit,
  onDelete,
  onSort,
  currentPage,
  totalPages,
  itemsPerPage,
  onItemsPerPageChange,
  onPageChange,
}: Props) {
  return (
    <div className="hidden md:block bg-white rounded-lg shadow-card border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">图片</TableHead>
              <TableHead onClick={() => onSort("name")} className="cursor-pointer">
                <div className="flex items-center">
                  名称
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </div>
              </TableHead>
              <TableHead onClick={() => onSort("code")} className="cursor-pointer">
                <div className="flex items-center">
                  货号
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </div>
              </TableHead>
              <TableHead>性别</TableHead>
              <TableHead>种类</TableHead>
              <TableHead>阶段</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length > 0 ? (
              products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="h-10 w-10 rounded bg-gray-100 overflow-hidden">
                      {getPrimaryImageUrl(product) ? (
                        <img
                          src={getPrimaryImageUrl(product)!}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-gray-300">
                          <Eye className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.code}</TableCell>
                  <TableCell>
                    {product.sex === "male" ? "公" : product.sex === "female" ? "母" : "-"}
                  </TableCell>
                  <TableCell>{seriesList.find((s) => s.id === product.seriesId)?.name || "-"}</TableCell>
                  <TableCell>{product.stage ? getStageLabel(product.stage) : "-"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {getStatusLabel(product.status || "active")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onView(product)}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(product)}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(product.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  没有找到符合条件的产品
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="border-t px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-sm text-gray-600">共 {totalProducts} 条</div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">每页</span>
          <Select value={itemsPerPage.toString()} onValueChange={(value) => onItemsPerPageChange(Number(value))}>
            <SelectTrigger className="w-20 h-8 bg-white border-gray-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {totalPages > 1 && <PaginationInfo currentPage={currentPage} totalPages={totalPages} />}
      </div>

      {totalPages > 1 && (
        <div className="pb-6">
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

              {currentPage < totalPages && totalPages > 3 && (
                <PaginationItem>
                  <PaginationLast onClick={() => onPageChange(totalPages)} />
                </PaginationItem>
              )}
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
