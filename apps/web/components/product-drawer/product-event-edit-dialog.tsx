'use client';

import { Loader2, X } from 'lucide-react';
import { type ProductEvent } from '@eggturtle/shared';

import {
  formatEventDateLabel,
  formatEventTypeLabel,
  type ProductEventEditFormState,
} from '@/components/product-drawer/event-shared';
import { Button } from '@/components/ui/button';
import { modalCloseButtonClass } from '@/components/ui/floating-actions';
import { Input } from '@/components/ui/input';

type ProductEventEditDialogProps = {
  editingEvent: ProductEvent | null;
  eventEditForm: ProductEventEditFormState | null;
  submittingEventAction: boolean;
  onClose: () => void;
  onChange: (patch: Partial<ProductEventEditFormState>) => void;
  onSubmit: () => void | Promise<void>;
};

export default function ProductEventEditDialog({
  editingEvent,
  eventEditForm,
  submittingEventAction,
  onClose,
  onChange,
  onSubmit,
}: ProductEventEditDialogProps) {
  if (!editingEvent || !eventEditForm) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 z-30 flex items-end bg-black/45 p-3 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <section
        className="mx-auto w-full max-w-xl rounded-2xl border border-neutral-200 bg-white p-4 shadow-2xl sm:p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-neutral-900">编辑事件</p>
            <p className="text-xs text-neutral-500">
              {formatEventTypeLabel(editingEvent.eventType)} · {formatEventDateLabel(editingEvent.eventDate)}
            </p>
          </div>
          <button
            type="button"
            className={modalCloseButtonClass}
            onClick={onClose}
            disabled={submittingEventAction}
            aria-label="关闭事件编辑弹窗"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid gap-1.5">
            <label htmlFor="event-edit-date" className="text-xs font-semibold text-neutral-600">
              事件日期
            </label>
            <Input
              id="event-edit-date"
              type="date"
              value={eventEditForm.eventDate}
              onChange={(event) => onChange({ eventDate: event.target.value })}
              disabled={submittingEventAction}
            />
          </div>

          {editingEvent.eventType === 'mating' ? (
            <div className="grid gap-1.5">
              <label htmlFor="event-edit-male-code" className="text-xs font-semibold text-neutral-600">
                公龟编码（可选）
              </label>
              <Input
                id="event-edit-male-code"
                value={eventEditForm.maleCode}
                onChange={(event) => onChange({ maleCode: event.target.value })}
                disabled={submittingEventAction}
              />
            </div>
          ) : null}

          {editingEvent.eventType === 'egg' ? (
            <div className="grid gap-1.5">
              <label htmlFor="event-edit-egg-count" className="text-xs font-semibold text-neutral-600">
                产蛋数量（可选）
              </label>
              <Input
                id="event-edit-egg-count"
                type="number"
                min={0}
                max={999}
                value={eventEditForm.eggCount}
                onChange={(event) => onChange({ eggCount: event.target.value })}
                disabled={submittingEventAction}
              />
            </div>
          ) : null}

          {editingEvent.eventType === 'change_mate' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <label htmlFor="event-edit-old-mate" className="text-xs font-semibold text-neutral-600">
                  旧配偶编码
                </label>
                <Input
                  id="event-edit-old-mate"
                  value={eventEditForm.oldMateCode}
                  onChange={(event) => onChange({ oldMateCode: event.target.value })}
                  disabled={submittingEventAction}
                />
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="event-edit-new-mate" className="text-xs font-semibold text-neutral-600">
                  新配偶编码
                </label>
                <Input
                  id="event-edit-new-mate"
                  value={eventEditForm.newMateCode}
                  onChange={(event) => onChange({ newMateCode: event.target.value })}
                  disabled={submittingEventAction}
                />
              </div>
            </div>
          ) : null}

          <div className="grid gap-1.5">
            <label htmlFor="event-edit-note" className="text-xs font-semibold text-neutral-600">
              事件备注（可选）
            </label>
            <textarea
              id="event-edit-note"
              rows={3}
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
              value={eventEditForm.note}
              onChange={(event) => onChange({ note: event.target.value })}
              disabled={submittingEventAction}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submittingEventAction}>
            取消
          </Button>
          <Button type="button" onClick={() => void onSubmit()} disabled={submittingEventAction}>
            {submittingEventAction ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                保存中...
              </>
            ) : (
              '保存事件'
            )}
          </Button>
        </div>
      </section>
    </div>
  );
}
