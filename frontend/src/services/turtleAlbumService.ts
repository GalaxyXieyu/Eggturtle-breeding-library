import apiClient, { ApiResponse, handleApiError } from '@/lib/api';
import type { Breeder, BreederRecords, Series, Sex, FamilyTree, BreederSummary } from '@/types/turtleAlbum';

const ENDPOINTS = {
  SERIES: '/api/series',
  ADMIN_SERIES: '/api/admin/series',
  BREEDERS: '/api/breeders',
  BREEDER_BY_CODE: (code: string) => `/api/breeders/by-code/${encodeURIComponent(code)}`,
  BREEDER_DETAIL: (id: string) => `/api/breeders/${id}`,
  BREEDER_RECORDS: (id: string) => `/api/breeders/${id}/records`,
  BREEDER_FAMILY_TREE: (id: string) => `/api/breeders/${id}/family-tree`,
};

export class ApiRequestError extends Error {
  status?: number;
  code?: string;

  constructor(message: string, options?: { status?: number; code?: string }) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = options?.status;
    this.code = options?.code;
  }
}

export const turtleAlbumService = {
  async listSeries(): Promise<Series[]> {
    try {
      const res = await apiClient.get<ApiResponse<Series[]>>(ENDPOINTS.SERIES);
      return res.data.data || [];
    } catch (e) {
      const err = handleApiError(e);
      throw new ApiRequestError(err.message, { status: err.status, code: err.code });
    }
  },

  async adminListSeries(params?: { includeInactive?: boolean }): Promise<Series[]> {
    try {
      const res = await apiClient.get<ApiResponse<Series[]>>(ENDPOINTS.ADMIN_SERIES, {
        params: { include_inactive: params?.includeInactive ?? true },
      });
      return res.data.data || [];
    } catch (e) {
      const err = handleApiError(e);
      throw new ApiRequestError(err.message, { status: err.status, code: err.code });
    }
  },

  async adminCreateSeries(payload: {
    code?: string | null;
    name: string;
    description?: string | null;
    sort_order?: number | null;
    is_active?: boolean;
  }): Promise<Series> {
    try {
      const res = await apiClient.post<ApiResponse<Series>>(ENDPOINTS.ADMIN_SERIES, payload);
      return res.data.data;
    } catch (e) {
      const err = handleApiError(e);
      throw new ApiRequestError(err.message, { status: err.status, code: err.code });
    }
  },

  async adminUpdateSeries(
    seriesId: string,
    payload: {
      code?: string | null;
      name?: string | null;
      description?: string | null;
      sort_order?: number | null;
      is_active?: boolean | null;
    }
  ): Promise<Series> {
    try {
      const res = await apiClient.put<ApiResponse<Series>>(`${ENDPOINTS.ADMIN_SERIES}/${seriesId}`, payload);
      return res.data.data;
    } catch (e) {
      const err = handleApiError(e);
      throw new ApiRequestError(err.message, { status: err.status, code: err.code });
    }
  },

  async listBreeders(params?: { seriesId?: string; sex?: Sex; limit?: number }): Promise<Breeder[]> {
    try {
      const res = await apiClient.get<ApiResponse<Breeder[]>>(ENDPOINTS.BREEDERS, {
        params: {
          series_id: params?.seriesId,
          sex: params?.sex,
          limit: params?.limit ?? 200,
        },
      });
      return res.data.data || [];
    } catch (e) {
      const err = handleApiError(e);
      throw new ApiRequestError(err.message, { status: err.status, code: err.code });
    }
  },

  async getBreederByCode(code: string): Promise<BreederSummary> {
    try {
      const res = await apiClient.get<ApiResponse<BreederSummary>>(ENDPOINTS.BREEDER_BY_CODE(code));
      return res.data.data;
    } catch (e) {
      const err = handleApiError(e);
      throw new ApiRequestError(err.message, { status: err.status, code: err.code });
    }
  },

  async getBreeder(id: string): Promise<Breeder> {
    try {
      const res = await apiClient.get<ApiResponse<Breeder>>(ENDPOINTS.BREEDER_DETAIL(id));
      return res.data.data;
    } catch (e) {
      const err = handleApiError(e);
      throw new ApiRequestError(err.message, { status: err.status, code: err.code });
    }
  },

  async getBreederRecords(id: string): Promise<BreederRecords> {
    try {
      const res = await apiClient.get<ApiResponse<BreederRecords>>(ENDPOINTS.BREEDER_RECORDS(id));
      return res.data.data;
    } catch (e) {
      const err = handleApiError(e);
      throw new ApiRequestError(err.message, { status: err.status, code: err.code });
    }
  },

  async getBreederFamilyTree(id: string): Promise<FamilyTree> {
    try {
      const res = await apiClient.get<ApiResponse<FamilyTree>>(ENDPOINTS.BREEDER_FAMILY_TREE(id));
      return res.data.data;
    } catch (e) {
      const err = handleApiError(e);
      throw new ApiRequestError(err.message, { status: err.status, code: err.code });
    }
  },
};
