export type Sex = 'male' | 'female';

export interface Series {
  id: string;
  code?: string | null;
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
  isFeatured?: boolean | null;

  images?: Array<{ id?: string; url: string; alt: string; type: string; sortOrder?: number }>;

  createdAt?: string;
  updatedAt?: string;
}

export interface BreederSummary {
  id: string;
  code: string;
  name: string;
  mainImageUrl?: string | null;
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

export interface FamilyTreeNode {
  id: string;
  code: string;
  name: string;
  sex: Sex;
  thumbnailUrl?: string | null;
  generation: number;
  relationship: string;
  sireCode?: string | null;
  damCode?: string | null;
  siblings?: FamilyTreeNode[];
}

export interface FamilyTreeMatingRecord {
  id: string;
  maleId?: string;
  maleCode?: string;
  maleName?: string;
  femaleId?: string;
  femaleCode?: string;
  femaleName?: string;
  matedAt: string | null;
  notes?: string | null;
}

export interface FamilyTreeEggRecord {
  id: string;
  laidAt: string | null;
  count?: number | null;
  notes?: string | null;
}

export interface FamilyTree {
  current: FamilyTreeNode;
  ancestors: {
    father?: FamilyTreeNode;
    mother?: FamilyTreeNode;
    paternalGrandfather?: FamilyTreeNode;
    paternalGrandmother?: FamilyTreeNode;
    maternalGrandfather?: FamilyTreeNode;
    maternalGrandmother?: FamilyTreeNode;
    paternalPaternalGreatGrandfather?: FamilyTreeNode;
    paternalPaternalGreatGrandmother?: FamilyTreeNode;
    paternalMaternalGreatGrandfather?: FamilyTreeNode;
    paternalMaternalGreatGrandmother?: FamilyTreeNode;
    maternalPaternalGreatGrandfather?: FamilyTreeNode;
    maternalPaternalGreatGrandmother?: FamilyTreeNode;
    maternalMaternalGreatGrandfather?: FamilyTreeNode;
    maternalMaternalGreatGrandmother?: FamilyTreeNode;
  };
  offspring: FamilyTreeNode[];
  siblings: FamilyTreeNode[];
  matingRecords: FamilyTreeMatingRecord[];
  eggRecords: FamilyTreeEggRecord[];
}
