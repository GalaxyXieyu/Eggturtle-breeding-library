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
import type { Control } from "react-hook-form";
import { PRODUCT_STATUSES, TURTLE_STAGES } from "@/constants/filterOptions";

import type { ProductFormValues } from "./productSchema";

type Props = {
  control: Control<ProductFormValues>;
  mode: "create" | "edit";
};

export function ProductFormFields({ control, mode }: Props) {
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
              <FormLabel>货号</FormLabel>
              <FormControl>
                <Input {...field} placeholder="输入产品货号" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {mode === "edit" && (
          <>
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
          </>
        )}

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
