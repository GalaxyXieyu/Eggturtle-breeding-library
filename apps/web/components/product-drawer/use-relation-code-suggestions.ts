import { useEffect, useMemo, useState } from 'react';
import { listProductsResponseSchema } from '@eggturtle/shared';

import { apiRequest } from '@/lib/api-client';
import {
  uniqueNormalizedCodes,
  type RelationCodeFieldKey,
} from '@/components/product-drawer/shared';

type RelationCodeValues = Record<RelationCodeFieldKey, string>;

type UseRelationCodeSuggestionsOptions = {
  open: boolean;
  isDemoMode: boolean;
  productId?: string | null;
  values: RelationCodeValues;
};

export function useRelationCodeSuggestions({
  open,
  isDemoMode,
  productId,
  values,
}: UseRelationCodeSuggestionsOptions) {
  const [activeField, setActiveField] = useState<RelationCodeFieldKey>('sireCode');
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [relationCodeKeyword, setRelationCodeKeyword] = useState('');
  const [relationCodeOptions, setRelationCodeOptions] = useState<string[]>([]);
  const [loadingRelationCodes, setLoadingRelationCodes] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    setActiveField('sireCode');
    setIsSuggestionOpen(false);
    setRelationCodeKeyword('');
    setRelationCodeOptions([]);
    setLoadingRelationCodes(false);
  }, [open, productId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const keyword = relationCodeKeyword.trim();

    if (isDemoMode) {
      setRelationCodeOptions(
        uniqueNormalizedCodes([values.sireCode, values.damCode, values.mateCode]).slice(0, 12),
      );
      setLoadingRelationCodes(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    const waitMs = keyword ? 180 : 0;

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        setLoadingRelationCodes(true);

        try {
          const query = new URLSearchParams();
          query.set('page', '1');
          query.set('pageSize', keyword ? '30' : '80');
          query.set('type', 'breeder');
          query.set('sortBy', keyword ? 'code' : 'updatedAt');
          query.set('sortDir', keyword ? 'asc' : 'desc');
          if (keyword) {
            query.set('search', keyword);
          }

          const response = await apiRequest(`/products?${query.toString()}`, {
            responseSchema: listProductsResponseSchema,
            signal: controller.signal,
          });

          if (cancelled) {
            return;
          }

          setRelationCodeOptions(
            uniqueNormalizedCodes([
              values.sireCode,
              values.damCode,
              values.mateCode,
              ...response.products.filter((item) => item.id !== productId).map((item) => item.code),
            ]).slice(0, 30),
          );
        } catch (error) {
          if (cancelled || (error instanceof DOMException && error.name === 'AbortError')) {
            return;
          }

          setRelationCodeOptions(
            uniqueNormalizedCodes([values.sireCode, values.damCode, values.mateCode]).slice(0, 12),
          );
        } finally {
          if (!cancelled) {
            setLoadingRelationCodes(false);
          }
        }
      })();
    }, waitMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [
    isDemoMode,
    open,
    productId,
    relationCodeKeyword,
    values.damCode,
    values.mateCode,
    values.sireCode,
  ]);

  const visibleSuggestions = useMemo(() => relationCodeOptions.slice(0, 12), [relationCodeOptions]);

  function handleFocus(field: RelationCodeFieldKey, value: string) {
    setActiveField(field);
    setRelationCodeKeyword(value);
    setIsSuggestionOpen(true);
  }

  function handleInputChange(field: RelationCodeFieldKey, value: string) {
    setActiveField(field);
    setRelationCodeKeyword(value);
    setIsSuggestionOpen(true);
  }

  function handleBlur() {
    setIsSuggestionOpen(false);
  }

  function handleSelect(field: RelationCodeFieldKey, value: string) {
    setActiveField(field);
    setRelationCodeKeyword(value);
    setIsSuggestionOpen(false);
  }

  function isVisibleFor(field: RelationCodeFieldKey) {
    return isSuggestionOpen && activeField === field;
  }

  return {
    loadingRelationCodes,
    visibleSuggestions,
    isVisibleFor,
    handleFocus,
    handleInputChange,
    handleBlur,
    handleSelect,
  };
}
