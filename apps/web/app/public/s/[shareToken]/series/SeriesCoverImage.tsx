/* eslint-disable @next/next/no-img-element */
'use client';

import PublicImageWithRetry from '@/app/public/_shared/PublicImageWithRetry';

type SeriesCoverImageProps = {
  coverUrl: string;
  seriesName: string;
};

export default function SeriesCoverImage({ coverUrl, seriesName }: SeriesCoverImageProps) {
  return (
    <PublicImageWithRetry
      src={coverUrl}
      alt={`${seriesName} 系列封面`}
      className="h-full w-full object-cover"
      loading="lazy"
      decoding="async"
      fetchPriority="low"
    />
  );
}
