export const PRODUCT_EVENT_MUTABLE_FIELDS = {
  mating: ['eventDate', 'note', 'maleCode'] as const,
  egg: ['eventDate', 'note', 'eggCount'] as const,
  change_mate: ['eventDate', 'note', 'oldMateCode', 'newMateCode'] as const,
} as const;

export type ProductEventType = keyof typeof PRODUCT_EVENT_MUTABLE_FIELDS;
