import { z } from 'zod';

export const dashboardOverviewWindowSchema = z.enum(['today', '7d', '30d']);

export const dashboardOverviewQuerySchema = z.object({
  window: dashboardOverviewWindowSchema.default('today')
});

export const dashboardOverviewChartItemSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  eggCount: z.number().int().nonnegative(),
  matingCount: z.number().int().nonnegative()
});

export const dashboardOverviewProductClicksTopItemSchema = z.object({
  productId: z.string().trim().min(1),
  code: z.string().trim().min(1),
  clicks: z.number().int().nonnegative()
});

export const dashboardOverviewResponseSchema = z.object({
  eggs: z.object({
    totalEggCount: z.number().int().nonnegative(),
    eventCount: z.number().int().nonnegative()
  }),
  matings: z.object({
    eventCount: z.number().int().nonnegative()
  }),
  needMating: z.object({
    needMatingCount: z.number().int().nonnegative(),
    warningCount: z.number().int().nonnegative()
  }),
  chart: z.array(dashboardOverviewChartItemSchema),
  share: z.object({
    pv: z.number().int().nonnegative(),
    uv: z.number().int().nonnegative(),
    productClicksTop: z.array(dashboardOverviewProductClicksTopItemSchema)
  })
});

export type DashboardOverviewWindow = z.infer<typeof dashboardOverviewWindowSchema>;
export type DashboardOverviewQuery = z.infer<typeof dashboardOverviewQuerySchema>;
export type DashboardOverviewResponse = z.infer<typeof dashboardOverviewResponseSchema>;
export type DashboardOverviewChartItem = z.infer<typeof dashboardOverviewChartItemSchema>;
export type DashboardOverviewProductClicksTopItem = z.infer<typeof dashboardOverviewProductClicksTopItemSchema>;
