/* eslint-disable @next/next/no-img-element */
'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEventHandler, MouseEventHandler, ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { type PetNeedMatingStatus, PetPriceBadge, PetSexBadge, PetStatusBadge, PetTimelineChips } from '@/components/pet/pet-card-badges';

type BasePetCardProps = {
  code: string;
  coverImageUrl?: string | null;
  coverFallbackImageUrl?: string | null;
  coverAlt?: string;
  imageLoading?: 'lazy' | 'eager';
  emptyCoverLabel?: string;
  sex?: string | null;
  sexEmptyLabel?: string;
  sexUnknownLabel?: string;
  needMatingStatus?: PetNeedMatingStatus | null;
  daysSinceEgg?: number | null;
  offspringUnitPrice?: number | null;
  description?: string | null;
  lastEggAt?: string | null;
  lastMatingAt?: string | null;
  sireCode?: string | null;
  damCode?: string | null;
  topRightSlot?: ReactNode;
  className?: string;
  variant?: 'tenant' | 'public';
  ariaLabel?: string;
};

type PetCardLinkProps = BasePetCardProps & {
  href: string;
  onClick?: never;
  onKeyDown?: never;
  role?: never;
  tabIndex?: never;
};

type PetCardActionProps = BasePetCardProps & {
  href?: undefined;
  onClick?: MouseEventHandler<HTMLElement>;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
  role?: string;
  tabIndex?: number;
};

export type PetCardProps = PetCardLinkProps | PetCardActionProps;

export default function PetCard(props: PetCardProps) {
  const {
    code,
    coverImageUrl,
    coverFallbackImageUrl,
    coverAlt,
    imageLoading,
    emptyCoverLabel = '暂无封面',
    sex,
    sexEmptyLabel = '未知',
    sexUnknownLabel = sexEmptyLabel,
    needMatingStatus,
    daysSinceEgg,
    offspringUnitPrice,
    description,
    lastEggAt,
    lastMatingAt,
    sireCode,
    damCode,
    topRightSlot,
    className,
    variant = 'tenant',
    ariaLabel
  } = props;
  const resolvedCover = coverImageUrl || coverFallbackImageUrl || null;
  const [imageLoaded, setImageLoaded] = useState(!resolvedCover);
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!resolvedCover) {
      setImageLoaded(true);
      return;
    }

    setImageLoaded(false);
    if (imageRef.current?.complete) {
      setImageLoaded(true);
    }
  }, [resolvedCover]);

  const rootClassName = cn(
    'group overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-[0_12px_34px_rgba(0,0,0,0.14)]',
    variant === 'tenant' ? 'cursor-pointer' : 'active:scale-[0.995]',
    className
  );
  const resolvedImageLoading = imageLoading ?? (variant === 'public' ? 'eager' : 'lazy');
  const imageFetchPriority = resolvedImageLoading === 'eager' ? 'high' : 'low';

  const content = (
    <>
      <div className="relative aspect-square bg-neutral-100">
        {resolvedCover ? (
          <>
            {!imageLoaded ? (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-neutral-200 via-neutral-100 to-neutral-200">
                <div className="flex h-full w-full items-center justify-center">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-500" />
                </div>
              </div>
            ) : null}
            <img
              ref={imageRef}
              src={resolvedCover}
              alt={coverAlt || code}
              className={`h-full w-full object-cover transition-[opacity,transform,filter] duration-500 ${
                imageLoaded ? 'scale-100 opacity-100 blur-0' : 'scale-[1.03] opacity-0 blur-[2px]'
              }`}
              loading={resolvedImageLoading}
              decoding="async"
              fetchPriority={imageFetchPriority}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageLoaded(true)}
            />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">
            {emptyCoverLabel}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent" />
        <PetStatusBadge status={needMatingStatus} daysSinceEgg={daysSinceEgg} className="absolute left-2 top-2" />
        <PetSexBadge
          sex={sex}
          emptyLabel={sexEmptyLabel}
          unknownLabel={sexUnknownLabel}
          className="absolute right-2 top-2"
        />
        {topRightSlot ? <span className="absolute bottom-2 right-2">{topRightSlot}</span> : null}
      </div>

      <div className="p-3 lg:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 text-sm font-semibold tracking-wide text-neutral-900 sm:text-base lg:text-lg">
            {code}
          </div>
          <PetPriceBadge price={offspringUnitPrice} />
        </div>

        <PetTimelineChips lastEggAt={lastEggAt} lastMatingAt={lastMatingAt} />

        {description ? (
          <div className="mt-2 rounded-xl bg-neutral-100/80 px-2.5 py-1.5 text-xs leading-relaxed text-neutral-700 sm:text-sm">
            <span className="line-clamp-2">{description}</span>
          </div>
        ) : null}

        {sireCode || damCode ? (
          <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-neutral-700">
            {sireCode ? <span className="rounded-full bg-neutral-100 px-2 py-0.5">父系 {sireCode}</span> : null}
            {damCode ? <span className="rounded-full bg-neutral-100 px-2 py-0.5">母系 {damCode}</span> : null}
          </div>
        ) : null}
      </div>
    </>
  );

  if ('href' in props && props.href) {
    return (
      <Link
        href={props.href}
        className={rootClassName}
        aria-label={ariaLabel}
        prefetch={variant === 'public' ? false : undefined}
      >
        {content}
      </Link>
    );
  }

  return (
    <article
      className={rootClassName}
      role={props.role}
      tabIndex={props.tabIndex}
      aria-label={ariaLabel}
      onClick={props.onClick}
      onKeyDown={props.onKeyDown}
    >
      {content}
    </article>
  );
}
