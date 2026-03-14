'use client';

import type { ReactNode } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type ProductBasicInfoSectionProps = {
  surface?: 'card' | 'plain';
  title?: string;
  description?: string;
  topFields: ReactNode;
  seriesDraftFields?: ReactNode;
  relationshipFields: ReactNode;
  descriptionField: ReactNode;
  cardClassName?: string;
  contentClassName?: string;
  plainClassName?: string;
};

export default function ProductBasicInfoSection({
  surface = 'plain',
  title,
  description,
  topFields,
  seriesDraftFields,
  relationshipFields,
  descriptionField,
  cardClassName,
  contentClassName = 'space-y-4',
  plainClassName = 'space-y-4',
}: ProductBasicInfoSectionProps) {
  const body = (
    <div className={contentClassName}>
      {topFields}
      {seriesDraftFields}
      {relationshipFields}
      {descriptionField}
    </div>
  );

  if (surface === 'card') {
    return (
      <Card className={cardClassName ?? 'rounded-2xl border-neutral-200'}>
        {(title || description) ? (
          <CardHeader>
            {title ? <CardTitle className="text-lg">{title}</CardTitle> : null}
            {description ? <CardDescription>{description}</CardDescription> : null}
          </CardHeader>
        ) : null}
        <CardContent>{body}</CardContent>
      </Card>
    );
  }

  return <div className={plainClassName}>{body}</div>;
}
