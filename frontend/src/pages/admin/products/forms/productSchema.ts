import * as z from "zod";

export const productFormSchema = z.object({
  name: z.string().min(1, "产品名称不能为空"),
  code: z.string().min(1, "货号不能为空"),
  // Backend write key is series_id; frontend keeps seriesId then maps before submit.
  seriesId: z.string().optional().default(""),
  sex: z.enum(["", "male", "female"]).default(""),
  offspringUnitPrice: z.preprocess(
    (v) => {
      if (v === "" || v === null || v === undefined) return undefined;
      const n = typeof v === "string" ? Number(v) : (v as number);
      return Number.isFinite(n) ? n : undefined;
    },
    z.number().nonnegative().optional()
  ),
  // Backend write keys are sire_code/dam_code; frontend keeps camelCase then maps before submit.
  sireCode: z.string().optional().default(""),
  damCode: z.string().optional().default(""),
  // Create flow keeps description optional; edit flow can still fill it.
  description: z.string().optional().default(""),
  hasSample: z.boolean().default(false),
  inStock: z.boolean().default(true),
  popularityScore: z.coerce.number().min(0).max(100).default(0),
  isFeatured: z.boolean().default(false),
  stage: z.string().default("hatchling"),
  status: z.enum(["active", "reserved", "sold"]).default("active"),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

export const productFormDefaultValues: ProductFormValues = {
  name: "",
  code: "",
  seriesId: "",
  sex: "",
  offspringUnitPrice: undefined,
  sireCode: "",
  damCode: "",
  description: "",
  hasSample: false,
  inStock: true,
  popularityScore: 0,
  isFeatured: false,
  stage: "hatchling",
  status: "active",
};
