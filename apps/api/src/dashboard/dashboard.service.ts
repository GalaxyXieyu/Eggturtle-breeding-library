import { Injectable } from '@nestjs/common';
import { AuditAction, type DashboardOverviewResponse, type DashboardOverviewWindow } from '@eggturtle/shared';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma.service';
import { parseTaggedProductEventNote, resolveNeedMatingStatus } from '../products/product-event-utils';

type DashboardShareStats = {
  pv: number;
  uv: number;
  productClicksTop: Array<{
    productId: string;
    code: string;
    clicks: number;
  }>;
};

type WindowRange = {
  bucketDates: string[];
  startAt: Date;
  endExclusiveAt: Date;
};

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(tenantId: string, window: DashboardOverviewWindow): Promise<DashboardOverviewResponse> {
    const range = this.getWindowRange(window);

    const [events, needMatingStats, shareStats] = await Promise.all([
      this.prisma.productEvent.findMany({
        where: {
          tenantId,
          eventType: {
            in: ['egg', 'mating']
          },
          eventDate: {
            gte: range.startAt,
            lt: range.endExclusiveAt
          }
        },
        select: {
          eventType: true,
          eventDate: true,
          note: true
        }
      }),
      this.getNeedMatingStats(tenantId),
      this.getShareStats(tenantId, range.startAt)
    ]);

    const chartMap = new Map<string, { eggCount: number; matingCount: number }>();
    for (const date of range.bucketDates) {
      chartMap.set(date, { eggCount: 0, matingCount: 0 });
    }

    let eggEventCount = 0;
    let totalEggCount = 0;
    let matingEventCount = 0;

    for (const event of events) {
      const bucketDate = this.formatDateKey(event.eventDate);
      const bucket = chartMap.get(bucketDate);
      if (!bucket) {
        continue;
      }

      if (event.eventType === 'egg') {
        eggEventCount += 1;
        const eggCount = parseTaggedProductEventNote(event.note).eggCount ?? 0;
        totalEggCount += eggCount;
        bucket.eggCount += eggCount;
        continue;
      }

      if (event.eventType === 'mating') {
        matingEventCount += 1;
        bucket.matingCount += 1;
      }
    }

    return {
      eggs: {
        totalEggCount,
        eventCount: eggEventCount
      },
      matings: {
        eventCount: matingEventCount
      },
      needMating: needMatingStats,
      chart: range.bucketDates.map((date) => {
        const bucket = chartMap.get(date) ?? { eggCount: 0, matingCount: 0 };
        return {
          date,
          eggCount: bucket.eggCount,
          matingCount: bucket.matingCount
        };
      }),
      share: shareStats
    };
  }

  private async getNeedMatingStats(tenantId: string): Promise<{
    needMatingCount: number;
    warningCount: number;
  }> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        productId: string;
        excludeFromBreeding: boolean;
        lastEggAt: Date | null;
        lastMatingAt: Date | null;
      }>
    >(Prisma.sql`
      SELECT
        p.id AS "productId",
        p.exclude_from_breeding AS "excludeFromBreeding",
        MAX(CASE WHEN e.event_type = 'egg' THEN e.event_date END) AS "lastEggAt",
        MAX(CASE WHEN e.event_type = 'mating' THEN e.event_date END) AS "lastMatingAt"
      FROM "products" p
      LEFT JOIN "product_events" e
        ON e.tenant_id = p.tenant_id
       AND e.product_id = p.id
      WHERE p.tenant_id = ${tenantId}
        AND p.in_stock = true
        AND LOWER(COALESCE(p.sex, '')) = 'female'
      GROUP BY p.id, p.exclude_from_breeding
    `);

    let needMatingCount = 0;
    let warningCount = 0;

    for (const row of rows) {
      const status = resolveNeedMatingStatus(row.lastEggAt, row.lastMatingAt, row.excludeFromBreeding);
      if (status === 'need_mating') {
        needMatingCount += 1;
      } else if (status === 'warning') {
        warningCount += 1;
      }
    }

    return {
      needMatingCount,
      warningCount
    };
  }

  private async getShareStats(tenantId: string, since: Date): Promise<DashboardShareStats> {
    try {
      const [summaryRows, topRows] = await Promise.all([
        this.prisma.$queryRaw<Array<{ pv: number; uv: number }>>(Prisma.sql`
          SELECT
            COUNT(*)::int AS "pv",
            COUNT(
              DISTINCT (
                COALESCE(NULLIF(metadata->>'ip', ''), 'unknown')
                || '|'
                || COALESCE(NULLIF(metadata->>'userAgent', ''), 'unknown')
              )
            )::int AS "uv"
          FROM "audit_logs"
          WHERE "tenant_id" = ${tenantId}
            AND "action" = ${AuditAction.ShareAccess}
            AND "resource_type" = 'public_share'
            AND "created_at" >= ${since}
            AND metadata->>'phase' = 'entry'
        `),
        this.prisma.$queryRaw<Array<{ productId: string; clicks: number }>>(Prisma.sql`
          SELECT
            metadata->>'requestedProductId' AS "productId",
            COUNT(*)::int AS "clicks"
          FROM "audit_logs"
          WHERE "tenant_id" = ${tenantId}
            AND "action" = ${AuditAction.ShareAccess}
            AND "resource_type" = 'public_share'
            AND "created_at" >= ${since}
            AND metadata->>'phase' = 'data'
            AND COALESCE(metadata->>'requestedProductId', '') <> ''
          GROUP BY metadata->>'requestedProductId'
          ORDER BY COUNT(*) DESC, MAX("created_at") DESC
          LIMIT 5
        `)
      ]);

      const productIds = topRows.map((item) => item.productId);
      const products =
        productIds.length > 0
          ? await this.prisma.product.findMany({
              where: {
                tenantId,
                id: {
                  in: productIds
                }
              },
              select: {
                id: true,
                code: true
              }
            })
          : [];

      const productMap = new Map(products.map((item) => [item.id, item.code]));
      const productClicksTop = topRows
        .map((row) => {
          const code = productMap.get(row.productId);
          if (!code) {
            return null;
          }

          return {
            productId: row.productId,
            code,
            clicks: row.clicks
          };
        })
        .filter((item): item is { productId: string; code: string; clicks: number } => item !== null);

      const summary = summaryRows[0] ?? { pv: 0, uv: 0 };
      return {
        pv: summary.pv,
        uv: summary.uv,
        productClicksTop
      };
    } catch {
      return {
        pv: 0,
        uv: 0,
        productClicksTop: []
      };
    }
  }

  private getWindowRange(window: DashboardOverviewWindow): WindowRange {
    const now = new Date();
    const endExclusiveAt = this.startOfNextDay(now);

    if (window === 'today') {
      const today = this.startOfDay(now);
      return {
        startAt: today,
        endExclusiveAt,
        bucketDates: [this.formatDateKey(today)]
      };
    }

    const days = window === '7d' ? 7 : 30;
    const startAt = this.startOfDay(this.addDays(now, -(days - 1)));
    const bucketDates = this.createDateBuckets(startAt, days);

    return {
      startAt,
      endExclusiveAt,
      bucketDates
    };
  }

  private createDateBuckets(startAt: Date, count: number): string[] {
    const dates: string[] = [];
    for (let index = 0; index < count; index += 1) {
      dates.push(this.formatDateKey(this.addDays(startAt, index)));
    }

    return dates;
  }

  private addDays(value: Date, days: number): Date {
    const next = new Date(value);
    next.setDate(next.getDate() + days);
    return next;
  }

  private startOfDay(value: Date): Date {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  private startOfNextDay(value: Date): Date {
    const dayStart = this.startOfDay(value);
    dayStart.setDate(dayStart.getDate() + 1);
    return dayStart;
  }

  private formatDateKey(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
