import { useCallback, useEffect, useState } from 'react';
import { listSeriesResponseSchema } from '@eggturtle/shared';

import { apiRequest } from '@/lib/api-client';
import { formatApiError } from '@/lib/error-utils';
import {
  toSuggestedSeriesCode,
  type ProductSeriesOption,
} from '@/components/product-drawer/shared';

type UseProductSeriesManagementOptions = {
  open: boolean;
  isDemoMode: boolean;
  initialOptions?: ProductSeriesOption[];
  shouldLoadRemote?: boolean;
  onError?: (message: string) => void;
};

function sortSeriesOptions(options: ProductSeriesOption[]) {
  return [...options].sort((left, right) => left.code.localeCompare(right.code, 'zh-CN'));
}

export function useProductSeriesManagement({
  open,
  isDemoMode,
  initialOptions = [],
  shouldLoadRemote = false,
  onError,
}: UseProductSeriesManagementOptions) {
  const [seriesOptions, setSeriesOptions] = useState<ProductSeriesOption[]>(() =>
    sortSeriesOptions(initialOptions),
  );
  const [loadingSeries, setLoadingSeries] = useState(false);
  const [isCreatingSeries, setIsCreatingSeries] = useState(false);
  const [newSeriesCode, setNewSeriesCode] = useState('');
  const [newSeriesName, setNewSeriesName] = useState('');
  const [newSeriesDescription, setNewSeriesDescription] = useState('');
  const [newSeriesSortOrder, setNewSeriesSortOrder] = useState('');
  const [newSeriesIsActive, setNewSeriesIsActive] = useState(true);

  const resetSeriesDraft = useCallback(() => {
    setNewSeriesCode('');
    setNewSeriesName('');
    setNewSeriesDescription('');
    setNewSeriesSortOrder('');
    setNewSeriesIsActive(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSeriesOptions(sortSeriesOptions(initialOptions));
  }, [initialOptions, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setIsCreatingSeries(false);
    resetSeriesDraft();
  }, [open, resetSeriesDraft]);

  useEffect(() => {
    if (!open || isDemoMode || !shouldLoadRemote || initialOptions.length > 0) {
      return;
    }

    let cancelled = false;
    setLoadingSeries(true);

    void (async () => {
      try {
        const response = await apiRequest('/series?page=1&pageSize=100', {
          responseSchema: listSeriesResponseSchema,
        });

        if (!cancelled) {
          setSeriesOptions(
            sortSeriesOptions(
              response.items.map((item) => ({
                id: item.id,
                code: item.code,
                name: item.name,
              })),
            ),
          );
        }
      } catch (error) {
        if (!cancelled) {
          onError?.(formatApiError(error));
        }
      } finally {
        if (!cancelled) {
          setLoadingSeries(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialOptions.length, isDemoMode, onError, open, shouldLoadRemote]);

  const appendSeriesOption = useCallback((nextOption: ProductSeriesOption) => {
    setSeriesOptions((current) => {
      if (current.some((item) => item.id === nextOption.id)) {
        return current;
      }

      return sortSeriesOptions([...current, nextOption]);
    });
  }, []);

  const handleNewSeriesNameChange = useCallback((value: string) => {
    setNewSeriesName(value);
    setNewSeriesCode((current) => (current.trim() ? current : toSuggestedSeriesCode(value)));
  }, []);

  return {
    seriesOptions,
    loadingSeries,
    isCreatingSeries,
    setIsCreatingSeries,
    newSeriesCode,
    setNewSeriesCode,
    newSeriesName,
    setNewSeriesName: handleNewSeriesNameChange,
    newSeriesDescription,
    setNewSeriesDescription,
    newSeriesSortOrder,
    setNewSeriesSortOrder,
    newSeriesIsActive,
    setNewSeriesIsActive,
    resetSeriesDraft,
    appendSeriesOption,
  };
}
