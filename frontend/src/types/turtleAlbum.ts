export type Sex = 'male' | 'female';

export interface Series {
  id: string;
  name: string;
  sortOrder: number;
  description?: string | null;
  isActive: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface Breeder {
  id: string;
  name: string;
  code: string;
  description?: string | null;

  seriesId?: string | null;
  sex?: Sex | null;
  offspringUnitPrice?: number | null;

  sireCode?: string | null;
  damCode?: string | null;
  sireImageUrl?: string | null;
  damImageUrl?: string | null;

  images?: Array<{ id?: string; url: string; alt: string; type: string; sortOrder?: number }>;

  createdAt?: string;
  updatedAt?: string;
}

export interface MatingRecord {
  id: string;
  femaleId: string;
  maleId: string;
  male?: { id: string; name: string; code: string } | null;
  female?: { id: string; name: string; code: string } | null;
  matedAt: string | null;
  notes?: string | null;
  createdAt?: string | null;
}

export interface EggRecord {
  id: string;
  femaleId: string;
  laidAt: string | null;
  count?: number | null;
  notes?: string | null;
  createdAt?: string | null;
}

export interface BreederRecords {
  breederId: string;
  sex: Sex;
  matingRecordsAsFemale: MatingRecord[];
  matingRecordsAsMale: MatingRecord[];
  eggRecords: EggRecord[];
}
