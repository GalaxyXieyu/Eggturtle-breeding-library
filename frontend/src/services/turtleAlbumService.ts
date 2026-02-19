import apiClient, { ApiResponse, handleApiError } from '@/lib/api';
import type { Breeder, BreederRecords, Series, Sex } from '@/types/turtleAlbum';

const ENDPOINTS = {
  SERIES: '/api/series',
  BREEDERS: '/api/breeders',
  BREEDER_DETAIL: (id: string) => `/api/breeders/${id}`,
  BREEDER_RECORDS: (id: string) => `/api/breeders/${id}/records`,
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
};
