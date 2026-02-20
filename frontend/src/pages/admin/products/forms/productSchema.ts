import * as z from "zod";

export const productFormSchema = z.object({
  name: z.string().min(1, "产品名称不能为空"),
  code: z.string().min(1, "货号不能为空"),
  // Create flow keeps description optional; edit flow can still fill it.
  description: z.string().optional().default(""),
  hasSample: z.boolean().default(false),
  inStock: z.boolean().default(true),
  popularityScore: z.coerce.number().min(0).max(100).default(0),
  isFeatured: z.boolean().default(false),
  stage: z.string().default("hatchling"),
  status: z.enum(["draft", "active", "reserved", "sold"]).default("active"),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

export const productFormDefaultValues: ProductFormValues = {
  name: "",
  code: "",
  description: "",
  hasSample: false,
  inStock: true,
  popularityScore: 0,
  isFeatured: false,
  stage: "hatchling",
  status: "active",
};
