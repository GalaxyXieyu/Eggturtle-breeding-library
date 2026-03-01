import type {
  Breeder,
  BreederEventItem,
  FamilyTree,
  MaleMateLoadItem,
  NeedMatingStatus,
  Series,
} from './types';

const seriesList: Series[] = [
  {
    id: 'series-gh',
    name: '果核',
    description: '果核系列选育记录，长期追踪体态、花纹和稳定性。\n本页为 legacy UI 迁移演示数据。',
  },
  {
    id: 'series-jx',
    name: '金线',
    description: '金线系列用于演示筛选 chips 与瀑布流布局。',
  },
];

const breeders: Breeder[] = [
  {
    id: 'b-f-001',
    code: 'GH-F01',
    name: '果核母 01',
    description: '背甲花纹稳定，近期产蛋后进入待配窗口。',
    seriesId: 'series-gh',
    sex: 'female',
    offspringUnitPrice: 299,
    sireCode: 'GH-M88',
    damCode: 'GH-F66',
    currentMateCode: 'GH-M02',
    currentMate: { id: 'b-m-002', code: 'GH-M02' },
    needMatingStatus: 'need_mating',
    lastEggAt: '2026-02-10',
    lastMatingAt: '2026-01-28',
    daysSinceEgg: 20,
    images: [
      { id: '1', url: '/images/mg_01.jpg', alt: 'GH-F01', type: 'main' },
      { id: '2', url: '/images/mg_02.jpg', alt: 'GH-F01 side', type: 'gallery' },
      { id: '3', url: '/images/mg_03.jpg', alt: 'GH-F01 shell', type: 'gallery' },
    ],
  },
  {
    id: 'b-f-002',
    code: 'GH-F02',
    name: '果核母 02',
    description: '产蛋后超过推荐配对窗口，状态预警。',
    seriesId: 'series-gh',
    sex: 'female',
    offspringUnitPrice: 320,
    sireCode: 'GH-M66',
    damCode: 'GH-F21',
    currentMateCode: 'GH-M02',
    currentMate: { id: 'b-m-002', code: 'GH-M02' },
    needMatingStatus: 'warning',
    lastEggAt: '2026-01-20',
    lastMatingAt: '2026-01-01',
    daysSinceEgg: 40,
    images: [
      { id: '1', url: '/images/mg_04.jpg', alt: 'GH-F02', type: 'main' },
      { id: '2', url: '/images/mg_05.jpg', alt: 'GH-F02 side', type: 'gallery' },
    ],
  },
  {
    id: 'b-m-002',
    code: 'GH-M02',
    name: '果核公 02',
    description: '配对活跃，负载中。',
    seriesId: 'series-gh',
    sex: 'male',
    offspringUnitPrice: 360,
    sireCode: 'GH-M11',
    damCode: 'GH-F10',
    needMatingStatus: 'normal',
    images: [
      { id: '1', url: '/images/mg_03.jpg', alt: 'GH-M02', type: 'main' },
      { id: '2', url: '/images/mg_01.jpg', alt: 'GH-M02 side', type: 'gallery' },
    ],
  },
  {
    id: 'b-m-101',
    code: 'JX-M01',
    name: '金线公 01',
    description: '金线系列示例公龟。',
    seriesId: 'series-jx',
    sex: 'male',
    offspringUnitPrice: 260,
    needMatingStatus: 'normal',
    images: [{ id: '1', url: '/images/mg_02.jpg', alt: 'JX-M01', type: 'main' }],
  },
  {
    id: 'b-f-101',
    code: 'JX-F01',
    name: '金线母 01',
    description: '金线系列示例母龟。',
    seriesId: 'series-jx',
    sex: 'female',
    offspringUnitPrice: 240,
    needMatingStatus: 'normal',
    lastEggAt: '2026-02-25',
    lastMatingAt: '2026-02-18',
    daysSinceEgg: 5,
    images: [{ id: '1', url: '/images/mg_05.jpg', alt: 'JX-F01', type: 'main' }],
  },
];

const eventsByBreeder: Record<string, BreederEventItem[]> = {
  'b-f-001': [
    {
      id: 'ev-001',
      eventType: 'egg',
      eventDate: '2026-02-10',
      eggCount: 8,
      note: '孵化箱 A-1',
    },
    {
      id: 'ev-002',
      eventType: 'mating',
      eventDate: '2026-01-28',
      maleCode: 'GH-M02',
      note: '状态稳定',
    },
    {
      id: 'ev-003',
      eventType: 'change_mate',
      eventDate: '2026-01-15',
      oldMateCode: 'GH-M03',
      newMateCode: 'GH-M02',
      note: '调整配对策略',
    },
  ],
  'b-f-002': [
    {
      id: 'ev-101',
      eventType: 'egg',
      eventDate: '2026-01-20',
      eggCount: 6,
      note: '本批次偏小',
    },
    {
      id: 'ev-102',
      eventType: 'mating',
      eventDate: '2026-01-01',
      maleCode: 'GH-M02',
    },
  ],
  'b-m-002': [
    {
      id: 'ev-201',
      eventType: 'mating',
      eventDate: '2026-02-12',
      maleCode: 'GH-M02',
      note: '与 GH-F01 交配',
    },
    {
      id: 'ev-202',
      eventType: 'mating',
      eventDate: '2026-02-02',
      maleCode: 'GH-M02',
      note: '与 GH-F02 交配',
    },
  ],
};

const familyTreeByBreeder: Record<string, FamilyTree> = {
  'b-f-001': {
    current: { id: 'b-f-001', code: 'GH-F01', name: '果核母 01', sex: 'female', thumbnailUrl: '/images/mg_01.jpg' },
    currentMate: { id: 'b-m-002', code: 'GH-M02' },
    ancestors: {
      father: { id: 'b-m-088', code: 'GH-M88', name: '果核公 88', sex: 'male', thumbnailUrl: '/images/mg_03.jpg' },
      mother: { id: 'b-f-066', code: 'GH-F66', name: '果核母 66', sex: 'female', thumbnailUrl: '/images/mg_04.jpg' },
      paternalGrandfather: { id: 'b-m-018', code: 'GH-M18', name: '果核公 18', sex: 'male', thumbnailUrl: '/images/mg_03.jpg' },
      paternalGrandmother: { id: 'b-f-017', code: 'GH-F17', name: '果核母 17', sex: 'female', thumbnailUrl: '/images/mg_05.jpg' },
      maternalGrandfather: { id: 'b-m-011', code: 'GH-M11', name: '果核公 11', sex: 'male', thumbnailUrl: '/images/mg_02.jpg' },
      maternalGrandmother: { id: 'b-f-010', code: 'GH-F10', name: '果核母 10', sex: 'female', thumbnailUrl: '/images/mg_01.jpg' },
    },
    offspring: [
      { id: 'c-001', code: 'GH-C01', name: '子代 01', sex: 'female', thumbnailUrl: '/images/mg_05.jpg' },
      { id: 'c-002', code: 'GH-C02', name: '子代 02', sex: 'male', thumbnailUrl: '/images/mg_02.jpg' },
    ],
    siblings: [{ id: 'sib-001', code: 'GH-F03', name: '同窝 03', sex: 'female', thumbnailUrl: '/images/mg_04.jpg' }],
  },
  'b-f-002': {
    current: { id: 'b-f-002', code: 'GH-F02', name: '果核母 02', sex: 'female', thumbnailUrl: '/images/mg_04.jpg' },
    currentMate: { id: 'b-m-002', code: 'GH-M02' },
    ancestors: {},
    offspring: [],
    siblings: [],
  },
  'b-m-002': {
    current: { id: 'b-m-002', code: 'GH-M02', name: '果核公 02', sex: 'male', thumbnailUrl: '/images/mg_03.jpg' },
    ancestors: {},
    offspring: [{ id: 'c-003', code: 'GH-C03', name: '子代 03', sex: 'female', thumbnailUrl: '/images/mg_01.jpg' }],
    siblings: [],
  },
};

const maleMateLoadByBreeder: Record<string, MaleMateLoadItem[]> = {
  'b-m-002': [
    {
      femaleId: 'b-f-001',
      femaleCode: 'GH-F01',
      femaleMainImageUrl: '/images/mg_01.jpg',
      femaleThumbnailUrl: '/images/mg_01.jpg',
      lastEggAt: '2026-02-10',
      lastMatingWithThisMaleAt: '2026-01-28',
      daysSinceEgg: 20,
      status: 'need_mating',
    },
    {
      femaleId: 'b-f-002',
      femaleCode: 'GH-F02',
      femaleMainImageUrl: '/images/mg_04.jpg',
      femaleThumbnailUrl: '/images/mg_04.jpg',
      lastEggAt: '2026-01-20',
      lastMatingWithThisMaleAt: '2026-01-01',
      daysSinceEgg: 40,
      status: 'warning',
    },
  ],
};

export function listSeries() {
  return seriesList;
}

export function listBreeders(params?: {
  seriesId?: string;
  sex?: 'all' | 'male' | 'female';
  status?: 'all' | NeedMatingStatus;
}) {
  const sex = params?.sex ?? 'all';
  const status = params?.status ?? 'all';

  return breeders.filter((b) => {
    if (params?.seriesId && b.seriesId !== params.seriesId) return false;
    if (sex !== 'all' && b.sex !== sex) return false;
    if (status !== 'all' && (b.needMatingStatus || 'normal') !== status) return false;
    return true;
  });
}

export function getBreeder(id: string) {
  return breeders.find((item) => item.id === id) || null;
}

export function listBreederEvents(id: string) {
  return eventsByBreeder[id] || [];
}

export function getBreederFamilyTree(id: string) {
  return familyTreeByBreeder[id] || null;
}

export function getMaleMateLoad(id: string) {
  return maleMateLoadByBreeder[id] || [];
}

export function getNeedMatingStatus(lastEggAt?: string | null, lastMatingAt?: string | null): {
  status: NeedMatingStatus;
  daysSinceEgg: number | null;
} {
  if (!lastEggAt) {
    return { status: 'normal', daysSinceEgg: null };
  }

  const eggDate = new Date(lastEggAt);
  const now = new Date();
  const daysSinceEgg = Math.max(0, Math.floor((now.getTime() - eggDate.getTime()) / (1000 * 60 * 60 * 24)));

  if (!lastMatingAt || new Date(lastMatingAt).getTime() < eggDate.getTime()) {
    if (daysSinceEgg >= 28) return { status: 'warning', daysSinceEgg };
    if (daysSinceEgg >= 12) return { status: 'need_mating', daysSinceEgg };
  }

  return { status: 'normal', daysSinceEgg };
}
