import {
  getBreeder,
  getBreederFamilyTree,
  getMaleMateLoad,
  listBreederEvents,
  listBreeders,
  listSeries,
} from './mock-data';
import type { NeedMatingStatus } from './types';

export type FeedQuery = {
  demo: boolean;
  seriesId?: string;
  sex?: 'all' | 'male' | 'female';
  status?: 'all' | NeedMatingStatus;
};

export async function getPublicFeedData(query: FeedQuery) {
  if (query.demo) {
    return {
      series: listSeries(),
      breeders: listBreeders({ seriesId: query.seriesId, sex: query.sex, status: query.status }),
    };
  }

  // TODO(phase-b): wire real public API + auth/tenant/share scope.
  return {
    series: [],
    breeders: [],
  };
}

export async function getPublicBreederDetailData(id: string, demo: boolean) {
  if (demo) {
    const breeder = getBreeder(id);

    return {
      breeder,
      events: breeder ? listBreederEvents(id) : [],
      familyTree: breeder ? getBreederFamilyTree(id) : null,
      maleMateLoad: breeder ? getMaleMateLoad(id) : [],
      fallbackBreeders: listBreeders().slice(0, 4),
    };
  }

  // TODO(phase-b): wire real public API + auth/tenant/share scope.
  return {
    breeder: null,
    events: [],
    familyTree: null,
    maleMateLoad: [],
    fallbackBreeders: [],
  };
}
