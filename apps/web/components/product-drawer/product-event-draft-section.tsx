'use client';

import {
  PRODUCT_EVENT_ENTRY_OPTIONS,
  type ProductEventEntryType,
  type ProductEventFormState,
} from '@/components/product-drawer/event-shared';
import { Input } from '@/components/ui/input';
import { buildInteractivePillClass } from '@/components/ui/pill';

type ProductEventDraftSectionProps = {
  canRecordEvent: boolean;
  eventForm: ProductEventFormState;
  excludeFromBreeding: boolean;
  submitting: boolean;
  onSelectDraftType: (nextType: ProductEventEntryType) => void;
  onResetDraft: () => void;
  onToggleExcludeFromBreeding: () => void;
  onChange: (patch: Partial<ProductEventFormState>) => void;
};

export default function ProductEventDraftSection({
  canRecordEvent,
  eventForm,
  excludeFromBreeding,
  submitting,
  onSelectDraftType,
  onResetDraft,
  onToggleExcludeFromBreeding,
  onChange,
}: ProductEventDraftSectionProps) {
  const selectedEventEntry =
    eventForm.eventType === 'none'
      ? null
      : PRODUCT_EVENT_ENTRY_OPTIONS.find((item) => item.key === eventForm.eventType) ?? null;

  return (
    <section className="space-y-3 rounded-2xl border border-neutral-200 bg-neutral-50/70 p-3">
      <div className="space-y-1">
        <p className="text-xs font-semibold text-neutral-600">添加事件（可选）</p>
        <p className="text-xs text-neutral-500">
          用于补录历史交配/产蛋/换公。修改“配偶编号”仍会自动记录换公事件。
        </p>
      </div>

      {!canRecordEvent ? (
        <p className="rounded-md border border-dashed border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-500">
          仅母龟支持录入种龟事件。请先将性别设置为母。
        </p>
      ) : null}

      {canRecordEvent ? (
        <>
          <div className="space-y-2 rounded-xl border border-neutral-200 bg-white p-2.5">
            <p className="text-[11px] font-semibold text-neutral-500">快捷操作（单行）</p>
            <div className="grid grid-cols-4 gap-1.5">
              {PRODUCT_EVENT_ENTRY_OPTIONS.map((item) => (
                <button
                  key={`edit-drawer-event-type-${item.key}`}
                  type="button"
                  className={buildInteractivePillClass(eventForm.eventType === item.key, {
                    baseClassName:
                      'flex h-8 w-full items-center justify-center rounded-full border px-1 text-center text-[11px] font-semibold leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD400]/80 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
                    activeClassName:
                      'border-[#D7B411] bg-[#FFE680] text-neutral-900 shadow-[0_8px_18px_rgba(215,180,17,0.18)] whitespace-nowrap',
                    idleClassName:
                      'border-neutral-200 bg-[#FFFBE8] text-neutral-700 hover:border-[#E7C94C] hover:bg-[#FFF6C2] hover:text-neutral-900 whitespace-nowrap',
                  })}
                  onClick={() => {
                    if (eventForm.eventType === item.key) {
                      onResetDraft();
                      return;
                    }

                    onSelectDraftType(item.key);
                  }}
                  disabled={submitting}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                className={buildInteractivePillClass(excludeFromBreeding, {
                  baseClassName:
                    'flex h-8 w-full items-center justify-center rounded-full border px-1 text-center text-[11px] font-semibold leading-none transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD400]/80 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
                  activeClassName:
                    'border-red-300 bg-red-50 text-red-700 shadow-[0_8px_18px_rgba(248,113,113,0.18)] whitespace-nowrap',
                  idleClassName:
                    'border-neutral-200 bg-[#FFFBE8] text-neutral-700 hover:border-red-200 hover:bg-red-50/70 hover:text-red-700 whitespace-nowrap',
                })}
                onClick={onToggleExcludeFromBreeding}
                disabled={submitting}
              >
                不再繁殖
              </button>
            </div>
            <p className="text-[11px] text-neutral-500">
              前三个按钮互斥，点击其他会切换，再点当前可取消；只有前三个会展开下方录入内容。
            </p>
            {selectedEventEntry ? (
              <p className="text-xs text-neutral-600">{selectedEventEntry.hint}</p>
            ) : null}
          </div>

          {eventForm.eventType === 'none' ? (
            <div className="rounded-md border border-dashed border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-500">
              当前未选择新增事件。你可以直接保存资料，或继续向下查看历史事件。
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-[#FFD400]/35 bg-[#FFF9D8] p-3">
              <p className="text-[11px] font-semibold text-neutral-600">
                新增{selectedEventEntry?.label ?? ''}事件
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <label htmlFor="edit-drawer-event-date" className="text-xs font-semibold text-neutral-600">
                    事件日期
                  </label>
                  <Input
                    id="edit-drawer-event-date"
                    type="date"
                    value={eventForm.eventDate}
                    onChange={(event) => onChange({ eventDate: event.target.value })}
                    disabled={submitting}
                  />
                </div>

                {eventForm.eventType === 'mating' ? (
                  <div className="grid gap-1.5">
                    <label
                      htmlFor="edit-drawer-event-male-code"
                      className="text-xs font-semibold text-neutral-600"
                    >
                      公龟编码（可选）
                    </label>
                    <Input
                      id="edit-drawer-event-male-code"
                      value={eventForm.maleCode}
                      placeholder="留空时使用配偶编号"
                      onChange={(event) => onChange({ maleCode: event.target.value })}
                      disabled={submitting}
                    />
                  </div>
                ) : null}

                {eventForm.eventType === 'egg' ? (
                  <div className="grid gap-1.5">
                    <label
                      htmlFor="edit-drawer-event-egg-count"
                      className="text-xs font-semibold text-neutral-600"
                    >
                      产蛋数量（可选）
                    </label>
                    <Input
                      id="edit-drawer-event-egg-count"
                      type="number"
                      min={0}
                      max={999}
                      value={eventForm.eggCount}
                      onChange={(event) => onChange({ eggCount: event.target.value })}
                      disabled={submitting}
                    />
                  </div>
                ) : null}

                {eventForm.eventType === 'change_mate' ? (
                  <>
                    <div className="grid gap-1.5">
                      <label
                        htmlFor="edit-drawer-event-old-mate"
                        className="text-xs font-semibold text-neutral-600"
                      >
                        旧配偶编码
                      </label>
                      <Input
                        id="edit-drawer-event-old-mate"
                        value={eventForm.oldMateCode}
                        onChange={(event) => onChange({ oldMateCode: event.target.value })}
                        disabled={submitting}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <label
                        htmlFor="edit-drawer-event-new-mate"
                        className="text-xs font-semibold text-neutral-600"
                      >
                        新配偶编码
                      </label>
                      <Input
                        id="edit-drawer-event-new-mate"
                        value={eventForm.newMateCode}
                        onChange={(event) => onChange({ newMateCode: event.target.value })}
                        disabled={submitting}
                      />
                    </div>
                  </>
                ) : null}
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="edit-drawer-event-note" className="text-xs font-semibold text-neutral-600">
                  事件备注（可选）
                </label>
                <textarea
                  id="edit-drawer-event-note"
                  rows={3}
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
                  value={eventForm.note}
                  onChange={(event) => onChange({ note: event.target.value })}
                  disabled={submitting}
                  placeholder="例如：本次为补录历史数据。"
                />
              </div>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}
