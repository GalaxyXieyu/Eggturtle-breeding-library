export type PageNumber = number | "ellipsis";

export function getPageNumbers(currentPage: number, totalPages: number): PageNumber[] {
  const pageNumbers: PageNumber[] = [];

  if (totalPages <= 0) return pageNumbers;

  pageNumbers.push(1);

  if (currentPage > 3) {
    pageNumbers.push("ellipsis");
  }

  for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
    if (i !== 1 && i !== totalPages) {
      pageNumbers.push(i);
    }
  }

  if (currentPage < totalPages - 2) {
    pageNumbers.push("ellipsis");
  }

  if (totalPages > 1) {
    pageNumbers.push(totalPages);
  }

  return pageNumbers;
}
