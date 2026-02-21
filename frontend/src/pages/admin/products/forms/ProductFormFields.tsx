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
import { useWatch, type Control } from "react-hook-form";
import { PRODUCT_STATUSES, TURTLE_STAGES } from "@/constants/filterOptions";

import { turtleAlbumService } from '@/services/turtleAlbumService';

import type { ProductFormValues } from "./productSchema";

type Props = {
  control: Control<ProductFormValues>;
};

export function ProductFormFields({ control }: Props) {
  const seriesQ = useQuery({
    queryKey: ['admin', 'series'],
    queryFn: () => turtleAlbumService.adminListSeries({ includeInactive: true }),
  });

  const sex = useWatch({ control, name: 'sex' });

  return (
    <div className="space-y-6">
      <div className="space-y-4 border-b pb-6">
        <h3 className="text-lg font-medium text-gray-900">基本信息</h3>

        <FormField
          control={control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>产品名称</FormLabel>
              <FormControl>
                <Input {...field} placeholder="输入产品名称" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>编号</FormLabel>
              <FormControl>
                <Input {...field} placeholder="输入编号" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="seriesId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>系列</FormLabel>
              <Select value={field.value || ''} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={seriesQ.isLoading ? '加载系列中...' : '选择系列（可选）'} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="">不选择</SelectItem>
                  {(seriesQ.data || []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="sex"
          render={({ field }) => (
            <FormItem>
              <FormLabel>性别</FormLabel>
              <Select value={field.value || ''} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="选择性别（种龟必填）" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="">不填</SelectItem>
                  <SelectItem value="female">母</SelectItem>
                  <SelectItem value="male">公</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
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
                <Input {...field} placeholder="输入父本编号（可选）" />
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
                <Input {...field} placeholder="输入母本编号（可选）" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="stage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>阶段</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="选择阶段" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {TURTLE_STAGES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>状态</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="选择状态" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {PRODUCT_STATUSES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

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
