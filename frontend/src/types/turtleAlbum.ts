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
  mateCode?: string | null;
  currentMateCode?: string | null;
  currentMate?: { id: string; code: string } | null;
  sireImageUrl?: string | null;
  damImageUrl?: string | null;
  isFeatured?: boolean | null;

  // Computed breeding reminders (bulk-computed by /api/breeders list to avoid N+1)
  needMatingStatus?: NeedMatingStatus;
  lastEggAt?: string | null;
  lastMatingAt?: string | null;
  daysSinceEgg?: number | null;

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
  currentMate?: { id: string; code: string } | null;
  matingRecordsAsFemale: MatingRecord[];
  matingRecordsAsMale: MatingRecord[];
  eggRecords: EggRecord[];
}

export type BreederEventType = 'mating' | 'egg' | 'change_mate';

export interface BreederEventItem {
  id: string;
  productId: string;
  eventType: BreederEventType;
  eventDate: string | null;
  maleCode?: string | null;
  eggCount?: number | null;
  note?: string | null;
  oldMateCode?: string | null;
  newMateCode?: string | null;
  createdAt?: string | null;
}

export interface BreederEventListResponse {
  items: BreederEventItem[];
  nextCursor?: string | null;
  hasMore: boolean;
}

export type NeedMatingStatus = 'normal' | 'need_mating' | 'warning';

export interface MaleMateLoadItem {
  femaleId: string;
  femaleCode: string;
  femaleMainImageUrl?: string | null;
  lastEggAt: string | null;
  lastMatingAt: string | null;
  lastMatingWithThisMaleAt: string | null;
  daysSinceEgg?: number | null;
  status: NeedMatingStatus;
}

export interface MaleMateLoadResponse {
  maleId: string;
  maleCode: string;
  totals: {
    relatedFemales: number;
    needMating: number;
    warning: number;
  };
  items: MaleMateLoadItem[];
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
  currentMate?: { id: string; code: string } | null;
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
