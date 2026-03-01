export type Sex = 'male' | 'female';
export type NeedMatingStatus = 'normal' | 'need_mating' | 'warning';
export type BreederEventType = 'mating' | 'egg' | 'change_mate';

export type Series = {
  id: string;
  name: string;
  description?: string;
};

export type BreederImage = {
  id?: string;
  url: string;
  alt?: string;
  type?: string;
};

export type Breeder = {
  id: string;
  code: string;
  name: string;
  description?: string;
  seriesId: string;
  sex: Sex;
  offspringUnitPrice?: number;
  sireCode?: string;
  damCode?: string;
  currentMateCode?: string;
  currentMate?: { id: string; code: string };
  needMatingStatus?: NeedMatingStatus;
  lastEggAt?: string | null;
  lastMatingAt?: string | null;
  daysSinceEgg?: number;
  images: BreederImage[];
};

export type BreederEventItem = {
  id: string;
  eventType: BreederEventType;
  eventDate: string | null;
  maleCode?: string | null;
  eggCount?: number | null;
  note?: string | null;
  oldMateCode?: string | null;
  newMateCode?: string | null;
};

export type MaleMateLoadItem = {
  femaleId: string;
  femaleCode: string;
  femaleMainImageUrl?: string;
  femaleThumbnailUrl?: string;
  lastEggAt: string | null;
  lastMatingWithThisMaleAt: string | null;
  daysSinceEgg?: number;
  status: NeedMatingStatus;
  excludeFromBreeding?: boolean;
};

export type FamilyTreeNode = {
  id: string;
  code: string;
  name: string;
  sex: Sex;
  thumbnailUrl?: string;
  siblings?: FamilyTreeNode[];
};

export type FamilyTree = {
  current: FamilyTreeNode;
  currentMate?: { id: string; code: string } | null;
  ancestors: {
    father?: FamilyTreeNode;
    mother?: FamilyTreeNode;
    paternalGrandfather?: FamilyTreeNode;
    paternalGrandmother?: FamilyTreeNode;
    maternalGrandfather?: FamilyTreeNode;
    maternalGrandmother?: FamilyTreeNode;
  };
  offspring: FamilyTreeNode[];
  siblings: FamilyTreeNode[];
};
