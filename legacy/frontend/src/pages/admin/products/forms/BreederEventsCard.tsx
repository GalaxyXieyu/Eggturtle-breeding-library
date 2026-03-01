import React from "react";

import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

import { turtleAlbumService } from "@/services/turtleAlbumService";
import type { BreederEventItem } from "@/types/turtleAlbum";

type Props = {
  productId: string;
  sex?: string | null;
  mateCode?: string | null;
};

type FormEventType = "mating" | "egg";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function normalizeEventDate(raw: string): { value?: string; error?: string } {
  const v = (raw || "").trim();
  if (!v) return { error: "请输入日期" };

  // Operator-friendly format: mm.dd (use local current year)
  const mmdd = v.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (mmdd) {
    const mm = Number(mmdd[1]);
    const dd = Number(mmdd[2]);
    const year = new Date().getFullYear();
    if (!Number.isFinite(mm) || !Number.isFinite(dd) || mm < 1 || mm > 12 || dd < 1 || dd > 31) {
      return { error: "日期格式不正确（mm.dd）" };
    }

    // Let Date validate month/day combinations.
    const d = new Date(year, mm - 1, dd);
    if (d.getFullYear() !== year || d.getMonth() !== mm - 1 || d.getDate() !== dd) {
      return { error: "日期无效" };
    }

    return { value: `${year}-${pad2(mm)}-${pad2(dd)}` };
  }

  // ISO date: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return { value: v };
  }

  // Accept full ISO strings too; backend supports datetime.fromisoformat.
  if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
    return { value: v };
  }

  return { error: "日期格式不正确，请用 mm.dd 或 YYYY-MM-DD" };
}

function eventTypeLabel(t: BreederEventItem["eventType"]) {
  if (t === "mating") return "交配";
  if (t === "egg") return "产蛋";
  if (t === "change_mate") return "更换配偶";
  return t;
}

function formatEventDate(dt: string | null | undefined) {
  if (!dt) return "-";
  // dt is ISO string; show YYYY-MM-DD
  return dt.slice(0, 10);
}

export function BreederEventsCard({ productId, sex, mateCode }: Props) {
  const { toast } = useToast();

  const shouldShow = sex === "female";

  const eventsQ = useQuery({
    queryKey: ["admin", "breeder-events", productId],
    queryFn: () => turtleAlbumService.getBreederEvents(productId, { limit: 10 }),
    enabled: shouldShow && !!productId,
  });

  const [eventType, setEventType] = React.useState<FormEventType>("mating");
  const [eventDateRaw, setEventDateRaw] = React.useState<string>("");
  const [maleCode, setMaleCode] = React.useState<string>("");
  const [eggCountRaw, setEggCountRaw] = React.useState<string>("");
  const [note, setNote] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    // Use current mateCode as default for mating events.
    if (eventType !== "mating") return;
    const v = (mateCode || "").trim();
    setMaleCode((prev) => (prev.trim() ? prev : v));
  }, [eventType, mateCode]);

  if (!shouldShow) return null;

  const items = eventsQ.data?.items || [];

  const submit = async () => {
    const normalized = normalizeEventDate(eventDateRaw);
    if (!normalized.value) {
      toast({
        title: "日期错误",
        description: normalized.error || "日期格式不正确",
        variant: "destructive",
      });
      return;
    }

    const eggCount = (eggCountRaw || "").trim();
    const eggCountNum = eggCount ? Number(eggCount) : null;

    if (eventType === "egg" && !eggCount) {
      toast({
        title: "数量错误",
        description: "请输入产蛋数量",
        variant: "destructive",
      });
      return;
    }

    if (
      eventType === "egg" &&
      (!Number.isFinite(eggCountNum) ||
        eggCountNum === null ||
        eggCountNum <= 0 ||
        !Number.isInteger(eggCountNum))
    ) {
      toast({
        title: "数量错误",
        description: "产蛋数量必须是正整数",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await turtleAlbumService.adminCreateBreederEvent({
        productId,
        eventType,
        eventDate: normalized.value,
        maleCode: eventType === "mating" ? (maleCode || "").trim() || undefined : undefined,
        eggCount: eventType === "egg" ? (eggCountNum ?? undefined) : undefined,
        note: (note || "").trim() || undefined,
      });

      toast({
        title: "已新增",
        description: eventType === "mating" ? "交配事件已记录" : "产蛋事件已记录",
      });

      setEventDateRaw("");
      if (eventType === "egg") setEggCountRaw("");
      setNote("");

      await eventsQ.refetch();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "新增事件失败";
      toast({
        title: "操作失败",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">种龟事件管理</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-900">类型</div>
              <Select value={eventType} onValueChange={(v) => setEventType(v as FormEventType)}>
                <SelectTrigger>
                  <SelectValue placeholder="选择事件类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mating">交配</SelectItem>
                  <SelectItem value="egg">产蛋</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium text-gray-900">日期</div>
              <Input
                value={eventDateRaw}
                onChange={(e) => setEventDateRaw(e.target.value)}
                placeholder="mm.dd 或 YYYY-MM-DD"
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.preventDefault();
                }}
              />
            </div>

            {eventType === "mating" ? (
              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-900">公龟编号</div>
                <Input
                  value={maleCode}
                  onChange={(e) => setMaleCode(e.target.value.toUpperCase())}
                  placeholder={((mateCode || "").trim() && `默认：${(mateCode || "").trim()}`) || "输入公龟编号"}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.preventDefault();
                  }}
                />
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-900">产蛋数量</div>
                <Input
                  value={eggCountRaw}
                  onChange={(e) => setEggCountRaw(e.target.value)}
                  placeholder="例如：6"
                  inputMode="numeric"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.preventDefault();
                  }}
                />
              </div>
            )}

            <div className="space-y-1 sm:col-span-2">
              <div className="text-sm font-medium text-gray-900">备注（可选）</div>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="备注信息"
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="button" onClick={submit} disabled={isSubmitting}>
              {isSubmitting ? "提交中..." : "新增事件"}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-900">最近事件</div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => eventsQ.refetch()}
              disabled={eventsQ.isFetching}
            >
              刷新
            </Button>
          </div>

          {eventsQ.isLoading ? (
            <div className="text-sm text-gray-500">加载中...</div>
          ) : eventsQ.isError ? (
            <div className="text-sm text-red-600">加载失败：{(eventsQ.error as Error).message}</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-gray-500">暂无事件</div>
          ) : (
            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.id} className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-medium text-gray-900">{eventTypeLabel(it.eventType)}</span>
                    <span className="text-gray-600">{formatEventDate(it.eventDate)}</span>
                    {it.eventType === "mating" && (it.maleCode || "").trim() ? (
                      <span className="text-gray-600">公龟：{it.maleCode}</span>
                    ) : null}
                    {it.eventType === "egg" && typeof it.eggCount === "number" ? (
                      <span className="text-gray-600">数量：{it.eggCount}</span>
                    ) : null}
                  </div>
                  {(it.note || "").trim() ? (
                    <div className="mt-1 text-gray-700 whitespace-pre-wrap">{it.note}</div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
