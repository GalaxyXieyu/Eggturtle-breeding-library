import type { Product } from "@/types/products";

export type SortDirection = "asc" | "desc";

function compareString(a: string, b: string, dir: SortDirection) {
  return dir === "asc" ? a.localeCompare(b) : b.localeCompare(a);
}

function compareNumber(a: number, b: number, dir: SortDirection) {
  return dir === "asc" ? a - b : b - a;
}

export function sortProductsByField(
  products: Product[],
  field: keyof Product,
  dir: SortDirection
): Product[] {
  // Stable-ish sort: copy then compare; if equal, keep original order.
  return products
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const av = a.p[field] as unknown;
      const bv = b.p[field] as unknown;

      if (typeof av === "string" && typeof bv === "string") {
        const c = compareString(av, bv, dir);
        return c !== 0 ? c : a.i - b.i;
      }
      if (typeof av === "number" && typeof bv === "number") {
        const c = compareNumber(av, bv, dir);
        return c !== 0 ? c : a.i - b.i;
      }

      // Fallback: keep original order.
      return a.i - b.i;
    })
    .map(({ p }) => p);
}
