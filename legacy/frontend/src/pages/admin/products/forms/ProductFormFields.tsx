import React from "react";

import { Input } from "@/components/ui/input";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useQuery } from '@tanstack/react-query';
import { useFormContext, useWatch, type Control } from "react-hook-form";

import { turtleAlbumService } from '@/services/turtleAlbumService';

import type { ProductFormValues } from "./productSchema";

type Props = {
  control: Control<ProductFormValues>;
  initialSeriesId?: string | null;
  initialSeriesName?: string | null;
};

export function ProductFormFields({ control, initialSeriesId, initialSeriesName }: Props) {
  const { getValues, setValue } = useFormContext<ProductFormValues>();
  const seriesQ = useQuery({
    queryKey: ['admin', 'series'],
    queryFn: () => turtleAlbumService.adminListSeries({ includeInactive: true }),
  });

  const seriesId = useWatch({ control, name: 'seriesId' });
  const sex = useWatch({ control, name: 'sex' });
  const seriesUserTouchedRef = React.useRef(false);

  React.useEffect(() => {
    if (!initialSeriesId) return;
    if (seriesUserTouchedRef.current) return;

    // Keep edit-mode initial value stable before user interaction.
    if (!getValues("seriesId")) {
      setValue("seriesId", initialSeriesId, {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    }
  }, [getValues, initialSeriesId, seriesId, setValue]);

  return (
    <div className="space-y-6">
      <div className="space-y-4 border-b pb-6">
        <h3 className="text-lg font-medium text-gray-900">基本信息</h3>

        <FormField
          control={control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>编号</FormLabel>
              <FormControl>
                <Input {...field} placeholder="输入编号" onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="seriesId"
          render={({ field }) => {
            const NONE_VALUE = "__none__";

            const selectedId = field.value || "";
            const seriesList = seriesQ.data || [];
            const hasSelectedOption =
              !!selectedId && seriesList.some((s) => s.id === selectedId);
            const selectedIdShort =
              selectedId.length > 8 ? `${selectedId.slice(0, 8)}...` : selectedId;

            return (
              <FormItem>
                <FormLabel>系列</FormLabel>
                <Select
                  value={selectedId || NONE_VALUE}
                  onOpenChange={(open) => {
                    if (open) seriesUserTouchedRef.current = true;
                  }}
                  onValueChange={(v) => {
                    // Guard against Radix's mount-time "__none__" sync event
                    // overriding an already reset form value in edit mode.
                    if (
                      v === NONE_VALUE &&
                      selectedId &&
                      !seriesUserTouchedRef.current
                    ) {
                      return;
                    }
                    field.onChange(v === NONE_VALUE ? "" : v);
                  }}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          seriesQ.isLoading ? "加载系列中..." : "选择系列（可选）"
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>不选择</SelectItem>

                    {selectedId && !hasSelectedOption ? (
                      <SelectItem value={selectedId}>
                        {initialSeriesName
                          ? `当前系列：${initialSeriesName}`
                          : `当前系列：${selectedIdShort}`}
                      </SelectItem>
                    ) : null}

                    {seriesQ.isError ? (
                      <SelectItem value="__series_error__" disabled>
                        系列列表加载失败，请刷新/重新登录
                      </SelectItem>
                    ) : null}

                    {seriesList.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            );
          }}
        />

        <FormField
          control={control}
          name="sex"
          render={({ field }) => {
            const NONE_VALUE = "__none__";
            return (
              <FormItem>
                <FormLabel>性别</FormLabel>
                <Select
                  value={field.value || NONE_VALUE}
                  onValueChange={(v) => field.onChange(v === NONE_VALUE ? "" : v)}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="选择性别（种龟必填）" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NONE_VALUE}>不填</SelectItem>
                    <SelectItem value="female">母</SelectItem>
                    <SelectItem value="male">公</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            );
          }}
        />

        {sex === 'female' ? (
          <FormField
            control={control}
            name="offspringUnitPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>子代单价</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    inputMode="decimal"
                    placeholder="例如：18000"
                    value={field.value === undefined ? '' : String(field.value)}
                    onChange={(e) => field.onChange(e.target.value)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}

        <FormField
          control={control}
          name="sireCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>父本编号</FormLabel>
              <FormControl>
                <Input {...field} placeholder="输入父本编号（可选）" onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="damCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>母本编号</FormLabel>
              <FormControl>
                <Input {...field} placeholder="输入母本编号（可选）" onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="mateCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>配偶编号</FormLabel>
              <FormControl>
                <Input {...field} placeholder="输入配偶编号（可选，仅母龟）" onChange={(e) => field.onChange(e.target.value.toUpperCase())} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {sex === 'female' ? (
          <FormField
            control={control}
            name="excludeFromBreeding"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">已退休（不参与繁殖）</FormLabel>
                  <div className="text-sm text-muted-foreground">勾选后将不会出现在公龟配偶/交配任务列表，也不会触发待配/逾期提醒（历史谱系不受影响）</div>
                </div>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              </FormItem>
            )}
          />
        ) : null}

        <FormField
          control={control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>产品描述</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="输入产品描述"
                  className="min-h-[100px]"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="isFeatured"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">精选产品</FormLabel>
                <div className="text-sm text-muted-foreground">
                  将此产品标记为精选产品，在首页展示
                </div>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>

      {/* 详细参数部分 (placeholder) */}
    </div>
  );
}
