import { Product } from "../types/products";

export const mockProducts: Product[] = [
  {
    id: "prod-001",
    name: "经典圆柱口红管",
    code: "RL-CL001",
    description: "简约大气的经典圆柱形口红管，适合各种高端口红产品，磁吸设计，开合流畅。",
    tubeType: "口红管",
    functionalDesigns: ["磁吸"],
    shape: "圆形",
    material: "petg",
    dimensions: {
      weight: 15,
      length: 70,
      width: 20,
      height: 20,
      capacity: {
        min: 3,
        max: 5
      }
    },
    images: [
      {
        id: "img-001-1",
        url: "/placeholder.svg",
        alt: "经典圆柱口红管主图",
        type: "main"
      },
      {
        id: "img-001-2",
        url: "/placeholder.svg",
        alt: "经典圆柱口红管细节图",
        type: "detail"
      },
      {
        id: "img-001-3",
        url: "/placeholder.svg",
        alt: "经典圆柱口红管尺寸图",
        type: "dimensions"
      }
    ],
    pricing: {
      costPrice: 2.5,
      factoryPrice: 3.8,
      hasSample: true,
      boxDimensions: "300x200x150mm",
      boxQuantity: 1000
    },
    inStock: true,
    popularityScore: 95,
    createdAt: "2023-05-10T08:00:00Z",
    updatedAt: "2023-06-15T10:30:00Z"
  },
  {
    id: "prod-002",
    name: "方形磁吸气垫盒",
    code: "CB-SQ002",
    description: "高端方形气垫盒，配有精美镜子和专用海绵垫，磁吸设计使用便捷。",
    boxType: "气垫盒",
    functionalDesigns: ["磁吸", "带镜子"],
    shape: "正方形",
    material: "petg",
    dimensions: {
      weight: 30,
      length: 65,
      width: 65,
      height: 15,
      capacity: {
        min: 10,
        max: 15
      }
    },
    images: [
      {
        id: "img-002-1",
        url: "/placeholder.svg",
        alt: "方形磁吸气垫盒主图",
        type: "main"
      },
      {
        id: "img-002-2",
        url: "/placeholder.svg",
        alt: "方形磁吸气垫盒细节图",
        type: "detail"
      },
      {
        id: "img-002-3",
        url: "/placeholder.svg",
        alt: "方形磁吸气垫盒尺寸图",
        type: "dimensions"
      }
    ],
    pricing: {
      costPrice: 3.8,
      factoryPrice: 5.5,
      hasSample: true,
      boxDimensions: "350x350x200mm",
      boxQuantity: 500
    },
    inStock: true,
    popularityScore: 88,
    createdAt: "2023-07-22T14:20:00Z",
    updatedAt: "2023-08-05T09:15:00Z"
  },
  {
    id: "prod-003",
    name: "双层腮红粉盒",
    code: "BD-DL003",
    description: "创新双层设计腮红粉盒，上层腮红下层收纳刷具，一盒多用。",
    boxType: "腮红盒",
    functionalDesigns: ["双层", "带刷位"],
    shape: "圆形",
    material: "petg",
    dimensions: {
      weight: 35,
      length: 75,
      width: 75,
      height: 25,
      capacity: {
        min: 15,
        max: 20
      },
      compartments: 2
    },
    images: [
      {
        id: "img-003-1",
        url: "/placeholder.svg",
        alt: "双层腮红粉盒主图",
        type: "main"
      },
      {
        id: "img-003-2",
        url: "/placeholder.svg",
        alt: "双层腮红粉盒细节图",
        type: "detail"
      },
      {
        id: "img-003-3",
        url: "/placeholder.svg",
        alt: "双层腮红粉盒尺寸图",
        type: "dimensions"
      }
    ],
    pricing: {
      costPrice: 4.2,
      factoryPrice: 6.8,
      hasSample: true,
      boxDimensions: "400x400x300mm",
      boxQuantity: 400
    },
    inStock: true,
    popularityScore: 90,
    createdAt: "2023-06-10T11:30:00Z",
    updatedAt: "2023-07-20T16:45:00Z"
  },
  {
    id: "prod-004",
    name: "透明唇釉管",
    code: "LG-TR004",
    description: "高透明度唇釉管，可清晰看到内容物颜色，适合各种唇釉产品。",
    tubeType: "唇釉管",
    functionalDesigns: ["透明/透色"],
    shape: "圆形",
    material: "petg",
    dimensions: {
      weight: 12,
      length: 80,
      width: 15,
      height: 15,
      capacity: {
        min: 2,
        max: 8
      }
    },
    images: [
      {
        id: "img-004-1",
        url: "/placeholder.svg",
        alt: "透明唇釉管主图",
        type: "main"
      },
      {
        id: "img-004-2",
        url: "/placeholder.svg",
        alt: "透明唇釉管细节图",
        type: "detail"
      },
      {
        id: "img-004-3",
        url: "/placeholder.svg",
        alt: "透明唇釉管尺寸图",
        type: "dimensions"
      }
    ],
    pricing: {
      costPrice: 2.0,
      factoryPrice: 3.2,
      hasSample: true,
      boxDimensions: "250x150x100mm",
      boxQuantity: 1200
    },
    inStock: true,
    popularityScore: 82,
    createdAt: "2023-08-15T09:20:00Z",
    updatedAt: "2023-09-01T14:10:00Z"
  },
  {
    id: "prod-005",
    name: "椭圆形粉饼盒",
    code: "PD-EL005",
    description: "时尚椭圆形粉饼盒，带有高清镜面，适用于各类粉饼、高光产品。",
    boxType: "粉饼高光盒",
    functionalDesigns: ["带镜子", "卡扣"],
    shape: "椭圆形",
    material: "注塑/吹瓶",
    dimensions: {
      weight: 28,
      length: 90,
      width: 65,
      height: 12,
      capacity: {
        min: 12,
        max: 18
      }
    },
    images: [
      {
        id: "img-005-1",
        url: "/placeholder.svg",
        alt: "椭圆形粉饼盒主图",
        type: "main"
      },
      {
        id: "img-005-2",
        url: "/placeholder.svg",
        alt: "椭圆形粉饼盒细节图",
        type: "detail"
      },
      {
        id: "img-005-3",
        url: "/placeholder.svg",
        alt: "椭圆形粉饼盒尺寸图",
        type: "dimensions"
      }
    ],
    pricing: {
      costPrice: 3.5,
      factoryPrice: 5.2,
      hasSample: true,
      boxDimensions: "380x280x200mm",
      boxQuantity: 600
    },
    inStock: true,
    popularityScore: 87,
    createdAt: "2023-04-25T13:40:00Z",
    updatedAt: "2023-06-02T11:20:00Z"
  },
  {
    id: "prod-006",
    name: "迷你口红管套装",
    code: "RL-MN006",
    description: "小巧可爱的迷你口红管，适合旅行装或试用装口红，磁吸设计。",
    tubeType: "口红管",
    functionalDesigns: ["磁吸"],
    shape: "迷你",
    material: "petg",
    dimensions: {
      weight: 8,
      length: 45,
      width: 12,
      height: 12,
      capacity: {
        min: 1,
        max: 3
      },
      compartments: 1
    },
    images: [
      {
        id: "img-006-1",
        url: "/placeholder.svg",
        alt: "迷你口红管套装主图",
        type: "main"
      },
      {
        id: "img-006-2",
        url: "/placeholder.svg",
        alt: "迷你口红管套装细节图",
        type: "detail"
      },
      {
        id: "img-006-3",
        url: "/placeholder.svg",
        alt: "迷你口红管套装尺寸图",
        type: "dimensions"
      }
    ],
    pricing: {
      costPrice: 1.8,
      factoryPrice: 2.9,
      hasSample: true,
      boxDimensions: "200x150x100mm",
      boxQuantity: 2000
    },
    inStock: true,
    popularityScore: 93,
    createdAt: "2023-09-10T10:00:00Z",
    updatedAt: "2023-10-05T15:30:00Z"
  },
  {
    id: "prod-007",
    name: "波浪纹散粉盒",
    code: "LP-WV007",
    description: "创意波浪纹设计散粉盒，带有细腻粉扑，时尚外观备受追捧。",
    boxType: "散粉盒",
    functionalDesigns: ["带刷位"],
    shape: "波浪纹",
    material: "注塑/吹瓶",
    dimensions: {
      weight: 40,
      length: 80,
      width: 80,
      height: 30,
      capacity: {
        min: 20,
        max: 30
      }
    },
    images: [
      {
        id: "img-007-1",
        url: "/placeholder.svg",
        alt: "波浪纹散粉盒主图",
        type: "main"
      },
      {
        id: "img-007-2",
        url: "/placeholder.svg",
        alt: "波浪纹散粉盒细节图",
        type: "detail"
      },
      {
        id: "img-007-3",
        url: "/placeholder.svg",
        alt: "波浪纹散粉盒尺寸图",
        type: "dimensions"
      }
    ],
    pricing: {
      costPrice: 4.5,
      factoryPrice: 7.2,
      hasSample: true,
      boxDimensions: "420x420x350mm",
      boxQuantity: 350
    },
    inStock: true,
    popularityScore: 85,
    createdAt: "2023-05-30T16:15:00Z",
    updatedAt: "2023-07-12T09:40:00Z"
  },
  {
    id: "prod-008",
    name: "双头眼线液笔",
    code: "EL-DH008",
    description: "创新双头设计，一端细线一端粗线，满足不同眼线需求。",
    tubeType: "眼线液瓶",
    functionalDesigns: ["双头"],
    shape: "长方形",
    material: "petg",
    dimensions: {
      weight: 14,
      length: 140,
      width: 10,
      height: 10,
      capacity: {
        min: 1,
        max: 3
      },
      compartments: 2
    },
    images: [
      {
        id: "img-008-1",
        url: "/placeholder.svg",
        alt: "双头眼线液笔主图",
        type: "main"
      },
      {
        id: "img-008-2",
        url: "/placeholder.svg",
        alt: "双头眼线液笔细节图",
        type: "detail"
      },
      {
        id: "img-008-3",
        url: "/placeholder.svg",
        alt: "双头眼线液笔尺寸图",
        type: "dimensions"
      }
    ],
    pricing: {
      costPrice: 2.8,
      factoryPrice: 4.5,
      hasSample: true,
      boxDimensions: "300x150x100mm",
      boxQuantity: 1000
    },
    inStock: true,
    popularityScore: 89,
    createdAt: "2023-08-05T11:25:00Z",
    updatedAt: "2023-09-10T14:50:00Z"
  },
  {
    id: "prod-009",
    name: "便携式眼影盘",
    code: "EP-PT009",
    description: "小巧便携的四色眼影盘，适合日常使用和旅行携带。",
    boxType: "粉饼高光盒",
    functionalDesigns: ["带镜子", "卡扣"],
    shape: "正方形",
    material: "注塑/吹瓶",
    dimensions: {
      weight: 25,
      length: 60,
      width: 60,
      height: 10,
      capacity: {
        min: 8,
        max: 12
      },
      compartments: 4
    },
    images: [
      {
        id: "img-009-1",
        url: "/placeholder.svg",
        alt: "便携式眼影盘主图",
        type: "main"
      },
      {
        id: "img-009-2",
        url: "/placeholder.svg",
        alt: "便携式眼影盘细节图",
        type: "detail"
      },
      {
        id: "img-009-3",
        url: "/placeholder.svg",
        alt: "便携式眼影盘尺寸图",
        type: "dimensions"
      }
    ],
    pricing: {
      costPrice: 3.2,
      factoryPrice: 5.0,
      hasSample: true,
      boxDimensions: "320x320x150mm",
      boxQuantity: 800
    },
    inStock: true,
    popularityScore: 91,
    createdAt: "2023-08-15T09:00:00Z",
    updatedAt: "2023-09-20T14:30:00Z"
  },
  {
    id: "prod-010",
    name: "六角形唇釉管",
    code: "LG-HX010",
    description: "创意六角形设计唇釉管，外观别致，手感舒适，适合各种高端唇釉产品。",
    tubeType: "唇釉管",
    functionalDesigns: ["透明/透色"],
    shape: "长方形",
    material: "petg",
    dimensions: {
      weight: 14,
      length: 85,
      width: 18,
      height: 18,
      capacity: {
        min: 3,
        max: 6
      }
    },
    images: [
      {
        id: "img-010-1",
        url: "/placeholder.svg",
        alt: "六角形唇釉管主图",
        type: "main"
      },
      {
        id: "img-010-2",
        url: "/placeholder.svg",
        alt: "六角形唇釉管细节图",
        type: "detail"
      },
      {
        id: "img-010-3",
        url: "/placeholder.svg",
        alt: "六角形唇釉管尺寸图",
        type: "dimensions"
      }
    ],
    pricing: {
      costPrice: 2.2,
      factoryPrice: 3.6,
      hasSample: true,
      boxDimensions: "270x180x120mm",
      boxQuantity: 1100
    },
    inStock: true,
    popularityScore: 86,
    createdAt: "2023-09-05T13:45:00Z",
    updatedAt: "2023-10-10T10:20:00Z"
  },
  {
    id: "prod-011",
    name: "儿童卡通唇膏管",
    code: "CB-CT011",
    description: "可爱卡通设计的儿童唇膏管，安全无毒材质，适合儿童彩妆市场。",
    tubeType: "口红管",
    functionalDesigns: ["卡扣"],
    shape: "儿童卡通",
    material: "petg",
    dimensions: {
      weight: 10,
      length: 60,
      width: 15,
      height: 15,
      capacity: {
        min: 2,
        max: 4
      }
    },
    images: [
      {
        id: "img-011-1",
        url: "/placeholder.svg",
        alt: "儿童卡通唇膏管主图",
        type: "main"
      },
      {
        id: "img-011-2",
        url: "/placeholder.svg",
        alt: "儿童卡通唇膏管细节图",
        type: "detail"
      },
      {
        id: "img-011-3",
        url: "/placeholder.svg",
        alt: "儿童卡通唇膏管尺寸图",
        type: "dimensions"
      }
    ],
    pricing: {
      costPrice: 1.6,
      factoryPrice: 2.8,
      hasSample: true,
      boxDimensions: "220x140x90mm",
      boxQuantity: 1500
    },
    inStock: true,
    popularityScore: 94,
    createdAt: "2023-10-01T08:30:00Z",
    updatedAt: "2023-11-15T16:20:00Z"
  },
  {
    id: "prod-012",
    name: "磨砂质感唇釉管",
    code: "LG-MT012",
    description: "磨砂质感设计的唇釉管，手感细腻，外观高级，适合各种中高端唇釉产品。",
    tubeType: "唇釉管",
    functionalDesigns: ["磁吸"],
    shape: "圆形",
    material: "petg",
    dimensions: {
      weight: 13,
      length: 78,
      width: 16,
      height: 16,
      capacity: {
        min: 3,
        max: 7
      }
    },
    images: [
      {
        id: "img-012-1",
        url: "/placeholder.svg",
        alt: "磨砂质感唇釉管主图",
        type: "main"
      },
      {
        id: "img-012-2",
        url: "/placeholder.svg",
        alt: "磨砂质感唇釉管细节图",
        type: "detail"
      },
      {
        id: "img-012-3",
        url: "/placeholder.svg",
        alt: "磨砂质感唇釉管尺寸图",
        type: "dimensions"
      }
    ],
    pricing: {
      costPrice: 2.3,
      factoryPrice: 3.8,
      hasSample: true,
      boxDimensions: "260x170x110mm",
      boxQuantity: 1000
    },
    inStock: true,
    popularityScore: 88,
    createdAt: "2023-07-18T11:30:00Z",
    updatedAt: "2023-08-25T09:15:00Z"
  },
  {
    id: "prod-013",
    name: "不规则几何气垫盒",
    code: "CB-GE013",
    description: "创意不规则几何设计气垫盒，时尚前卫，带有高清镜面和海绵垫。",
    boxType: "气垫盒",
    functionalDesigns: ["带镜子", "磁吸"],
    shape: "不规则",
    material: "注塑/吹瓶",
    dimensions: {
      weight: 32,
      length: 70,
      width: 70,
      height: 18,
      capacity: {
        min: 12,
        max: 16
      }
    },
    images: [
      {
        id: "img-013-1",
        url: "/placeholder.svg",
        alt: "不规则几何气垫盒主图",
        type: "main"
      },
      {
        id: "img-013-2",
        url: "/placeholder.svg",
        alt: "不规则几何气垫盒细节图",
        type: "detail"
      },
      {
        id: "img-013-3",
        url: "/placeholder.svg",
        alt: "不规则几何气垫盒尺寸图",
        type: "dimensions"
      }
    ],
    pricing: {
      costPrice: 4.0,
      factoryPrice: 6.2,
      hasSample: true,
      boxDimensions: "360x360x220mm",
      boxQuantity: 480
    },
    inStock: true,
    popularityScore: 92,
    createdAt: "2023-11-05T14:20:00Z",
    updatedAt: "2023-12-10T11:45:00Z"
  },
  {
    id: "prod-014",
    name: "多功能睫毛膏瓶",
    code: "MS-MF014",
    description: "创新设计的睫毛膏瓶，带有特殊梳子设计，能够有效分离睫毛，提供更佳上妆效果。",
    tubeType: "睫毛膏瓶",
    functionalDesigns: ["双层"],
    shape: "长方形",
    material: "petg",
    dimensions: {
      weight: 18,
      length: 110,
      width: 14,
      height: 14,
      capacity: {
        min: 5,
        max: 10
      }
    },
    images: [
      {
        id: "img-014-1",
        url: "/placeholder.svg",
        alt: "多功能睫毛膏瓶主图",
        type: "main"
      },
      {
        id: "img-014-2",
        url: "/placeholder.svg",
        alt: "多功能睫毛膏瓶细节图",
        type: "detail"
      },
      {
        id: "img-014-3",
        url: "/placeholder.svg",
        alt: "多功能睫毛膏瓶尺寸图",
        type: "dimensions"
      }
    ],
    pricing: {
      costPrice: 2.6,
      factoryPrice: 4.3,
      hasSample: true,
      boxDimensions: "280x180x150mm",
      boxQuantity: 900
    },
    inStock: true,
    popularityScore: 90,
    createdAt: "2023-06-28T09:15:00Z",
    updatedAt: "2023-08-03T13:40:00Z"
  },
  {
    id: "prod-015",
    name: "复古风粉饼盒",
    code: "CP-RT015",
    description: "欧式复古风格设计的粉饼盒，镂空雕花图案，带有高清镜面，尽显奢华风范。",
    boxType: "粉饼高光盒",
    functionalDesigns: ["带镜子", "贴片"],
    shape: "圆形",
    material: "注塑/吹瓶",
    dimensions: {
      weight: 30,
      length: 75,
      width: 75,
      height: 15,
      capacity: {
        min: 12,
        max: 18
      }
    },
    images: [
      {
        id: "img-015-1",
        url: "/placeholder.svg",
        alt: "复古风粉饼盒主图",
        type: "main"
      },
      {
        id: "img-015-2",
        url: "/placeholder.svg",
        alt: "复古风粉饼盒细节图",
        type: "detail"
      },
      {
        id: "img-015-3",
        url: "/placeholder.svg",
        alt: "复古风粉饼盒尺寸图",
        type: "dimensions"
      }
    ],
    pricing: {
      costPrice: 3.9,
      factoryPrice: 6.0,
      hasSample: true,
      boxDimensions: "350x350x180mm",
      boxQuantity: 550
    },
    inStock: true,
    popularityScore: 87,
    createdAt: "2023-07-01T10:45:00Z",
    updatedAt: "2023-08-12T14:30:00Z"
  },
  {
    id: "prod-016",
    name: "果冻色唇釉管",
    code: "LG-JC016",
    description: "透明果冻色设计的唇釉管，时尚可爱，能够清晰看到内容物颜色。",
    tubeType: "唇釉管",
    functionalDesigns: ["透明/透色"],
    shape: "圆形",
    material: "petg",
    dimensions: {
      weight: 12,
      length: 82,
      width: 15,
      height: 15,
      capacity: {
        min: 3,
        max: 8
      }
    },
    images: [
      {
        id: "img-016-1",
        url: "/placeholder.svg",
        alt: "果冻色唇釉管主图",
        type: "main"
      },
      {
        id: "img-016-2",
        url: "/placeholder.svg",
        alt: "果冻色唇釉管细节图",
        type: "detail"
      },
      {
        id: "img-016-3",
        url: "/placeholder.svg",
        alt: "果冻色唇釉管尺寸图",
        type: "dimensions"
      }
    ],
    pricing: {
      costPrice: 2.1,
      factoryPrice: 3.4,
      hasSample: true,
      boxDimensions: "240x160x110mm",
      boxQuantity: 1200
    },
    inStock: true,
    popularityScore: 91,
    createdAt: "2023-09-15T15:20:00Z",
    updatedAt: "2023-10-20T09:30:00Z"
  },
  {
    id: "prod-017",
    name: "轻奢风睫毛膏瓶",
    code: "MS-LX017",
    description: "轻奢风格设计的睫毛膏瓶，精致纹路，手感舒适，彰显高级质感。",
    tubeType: "睫毛膏瓶",
    functionalDesigns: ["卡扣"],
    shape: "长方形",
    material: "petg",
    dimensions: {
      weight: 17,
      length: 105,
      width: 15,
      height: 15,
      capacity: {
        min: 6,
        max: 9
      }
    },
    images: [
      {
        id: "img-017-1",
        url: "/placeholder.svg",
        alt: "轻奢风睫毛膏瓶主图",
        type: "main"
      },
      {
        id: "img-017-2",
        url: "/placeholder.svg",
        alt: "轻奢风睫毛膏瓶细节图",
        type: "detail"
      },
      {
        id: "img-017-3",
        url: "/placeholder.svg",
        alt: "轻奢风睫毛膏瓶尺寸图",
        type: "dimensions"
      }
    ],
    pricing: {
      costPrice: 2.5,
      factoryPrice: 4.1,
      hasSample: true,
      boxDimensions: "270x170x140mm",
      boxQuantity: 950
    },
    inStock: true,
    popularityScore: 89,
    createdAt: "2023-08-20T12:30:00Z",
    updatedAt: "2023-09-25T10:15:00Z"
  },
  {
    id: "prod-018",
    name: "方形组合眼影盘",
    code: "EP-SQ018",
    description: "时尚方形设计的组合眼影盘，可容纳12色眼影，附带高质量眼影刷。",
    boxType: "腮红盒",
    functionalDesigns: ["带镜子", "带刷位"],
    shape: "正方形",
    material: "注塑/吹瓶",
    dimensions: {
      weight: 45,
      length: 100,
      width: 100,
      height: 18,
      capacity: {
        min: 20,
        max: 25
      },
      compartments: 12
    },
    images: [
      {
        id: "img-018-1",
        url: "/placeholder.svg",
        alt: "方形组合眼影盘主图",
        type: "main"
      },
      {
        id: "img-018-2",
        url: "/placeholder.svg",
        alt: "方形组合眼影盘细节图",
        type: "detail"
      },
      {
        id: "img-018-3",
        url: "/placeholder.svg",
        alt: "方形组合眼影盘尺寸图",
        type: "dimensions"
      }
    ],
    pricing: {
      costPrice: 5.2,
      factoryPrice: 8.5,
      hasSample: true,
      boxDimensions: "450x450x250mm",
      boxQuantity: 300
    },
    inStock: true,
    popularityScore: 93,
    createdAt: "2023-10-10T09:00:00Z",
    updatedAt: "2023-11-18T14:45:00Z"
  },
  {
    id: "prod-019",
    name: "流线型固体棒管",
    code: "ST-ST019",
    description: "时尚流线型设计的固体棒管，适用于各种固体香水、防晒、粉底等产品。",
    tubeType: "固体棒",
    functionalDesigns: ["卡扣"],
    shape: "椭圆形",
    material: "注塑/吹瓶",
    dimensions: {
      weight: 20,
      length: 90,
      width: 25,
      height: 25,
      capacity: {
        min: 10,
        max: 15
      }
    },
    images: [
      {
        id: "img-019-1",
        url: "/placeholder.svg",
        alt: "流线型固体棒管主图",
        type: "main"
      },
      {
        id: "img-019-2",
        url: "/placeholder.svg",
        alt: "流线型固体棒管细节图",
        type: "detail"
      },
      {
        id: "img-019-3",
        url: "/placeholder.svg",
        alt: "流线型固体棒管尺寸图",
        type: "dimensions"
      }
    ],
    pricing: {
      costPrice: 2.9,
      factoryPrice: 4.8,
      hasSample: true,
      boxDimensions: "300x220x170mm",
      boxQuantity: 700
    },
    inStock: true,
    popularityScore: 85,
    createdAt: "2023-07-25T16:15:00Z",
    updatedAt: "2023-09-05T11:30:00Z"
  },
  {
    id: "prod-020",
    name: "高级三合一散粉盒",
    code: "LP-TH020",
    description: "创新三层设计的散粉盒，上层散粉，中层收纳粉扑，下层可放置其他化妆品。",
    boxType: "散粉盒",
    functionalDesigns: ["双层", "带刷位"],
    shape: "圆形",
    material: "注塑/吹瓶",
    dimensions: {
      weight: 50,
      length: 85,
      width: 85,
      height: 40,
      capacity: {
        min: 25,
        max: 35
      },
      compartments: 3
    },
    images: [
      {
        id: "img-020-1",
        url: "/placeholder.svg",
        alt: "高级三合一散粉盒主图",
        type: "main"
      },
      {
        id: "img-020-2",
        url: "/placeholder.svg",
        alt: "高级三合一散粉盒细节图",
        type: "detail"
      },
      {
        id: "img-020-3",
        url: "/placeholder.svg",
        alt: "高级三合一散粉盒尺寸图",
        type: "dimensions"
      }
    ],
    pricing: {
      costPrice: 5.5,
      factoryPrice: 9.0,
      hasSample: true,
      boxDimensions: "430x430x320mm",
      boxQuantity: 280
    },
    inStock: true,
    popularityScore: 94,
    createdAt: "2023-11-10T11:20:00Z",
    updatedAt: "2023-12-15T16:45:00Z"
  },
  {
    id: "prod-021",
    name: "豪华版唇膏管",
    code: "RL-LX021",
    description: "奢华设计的唇膏管，金属质感外壳，彰显高端品质。",
    tubeType: "口红管",
    functionalDesigns: ["磁吸", "贴片"],
    shape: "圆形",
    material: "注塑/吹瓶",
    dimensions: {
      weight: 22,
      length: 75,
      width: 22,
      height: 22,
      capacity: {
        min: 3,
        max: 6
      }
    },
    images: [
      {
        id: "img-021-1",
        url: "/placeholder.svg",
        alt: "豪华版唇膏管主图",
        type: "main"
      }
    ],
    pricing: {
      costPrice: 3.5,
      factoryPrice: 5.8,
      hasSample: true,
      boxDimensions: "320x220x160mm",
      boxQuantity: 800
    },
    inStock: true,
    popularityScore: 96,
    createdAt: "2023-12-01T09:00:00Z",
    updatedAt: "2023-12-20T14:30:00Z"
  },
  {
    id: "prod-022",
    name: "星空渐变气垫盒",
    code: "CB-SG022",
    description: "梦幻星空渐变设计的气垫盒，独特美观，深受年轻用户喜爱。",
    boxType: "气垫盒",
    functionalDesigns: ["带镜子", "透明/透色"],
    shape: "圆形",
    material: "petg",
    dimensions: {
      weight: 28,
      length: 68,
      width: 68,
      height: 16,
      capacity: {
        min: 11,
        max: 14
      }
    },
    images: [
      {
        id: "img-022-1",
        url: "/placeholder.svg",
        alt: "星空渐变气垫盒主图",
        type: "main"
      }
    ],
    pricing: {
      costPrice: 4.1,
      factoryPrice: 6.5,
      hasSample: true,
      boxDimensions: "340x340x210mm",
      boxQuantity: 520
    },
    inStock: true,
    popularityScore: 89,
    createdAt: "2023-11-20T10:30:00Z",
    updatedAt: "2023-12-15T16:45:00Z"
  },
  {
    id: "prod-023",
    name: "竹制环保散粉盒",
    code: "LP-BZ023",
    description: "采用天然竹制材料的环保散粉盒，绿色环保，质感自然。",
    boxType: "散粉盒",
    functionalDesigns: ["带刷位", "卡扣"],
    shape: "圆形",
    material: "注塑/吹瓶",
    dimensions: {
      weight: 45,
      length: 82,
      width: 82,
      height: 28,
      capacity: {
        min: 18,
        max: 28
      }
    },
    images: [
      {
        id: "img-023-1",
        url: "/placeholder.svg",
        alt: "竹制环保散粉盒主图",
        type: "main"
      }
    ],
    pricing: {
      costPrice: 5.8,
      factoryPrice: 8.2,
      hasSample: true,
      boxDimensions: "410x410x330mm",
      boxQuantity: 320
    },
    inStock: true,
    popularityScore: 85,
    createdAt: "2023-10-15T11:45:00Z",
    updatedAt: "2023-11-28T09:20:00Z"
  },
  {
    id: "prod-024",
    name: "霓虹彩色唇釉管",
    code: "LG-NH024",
    description: "炫彩霓虹设计的唇釉管，色彩鲜艳，适合潮流彩妆品牌。",
    tubeType: "唇釉管",
    functionalDesigns: ["透明/透色", "双头"],
    shape: "长方形",
    material: "petg",
    dimensions: {
      weight: 16,
      length: 88,
      width: 17,
      height: 17,
      capacity: {
        min: 4,
        max: 9
      }
    },
    images: [
      {
        id: "img-024-1",
        url: "/placeholder.svg",
        alt: "霓虹彩色唇釉管主图",
        type: "main"
      }
    ],
    pricing: {
      costPrice: 2.7,
      factoryPrice: 4.2,
      hasSample: true,
      boxDimensions: "280x190x130mm",
      boxQuantity: 950
    },
    inStock: true,
    popularityScore: 83,
    createdAt: "2023-09-28T13:15:00Z",
    updatedAt: "2023-11-05T15:40:00Z"
  },
  {
    id: "prod-025",
    name: "玫瑰金腮红盒",
    code: "BD-RG025",
    description: "优雅玫瑰金色腮红盒，高档质感，适合高端化妆品品牌。",
    boxType: "腮红盒",
    functionalDesigns: ["带镜子", "磁吸"],
    shape: "正方形",
    material: "注塑/吹瓶",
    dimensions: {
      weight: 33,
      length: 72,
      width: 72,
      height: 20,
      capacity: {
        min: 14,
        max: 19
      }
    },
    images: [
      {
        id: "img-025-1",
        url: "/placeholder.svg",
        alt: "玫瑰金腮红盒主图",
        type: "main"
      }
    ],
    pricing: {
      costPrice: 4.3,
      factoryPrice: 6.9,
      hasSample: true,
      boxDimensions: "360x360x250mm",
      boxQuantity: 450
    },
    inStock: true,
    popularityScore: 91,
    createdAt: "2023-08-12T08:30:00Z",
    updatedAt: "2023-10-18T12:15:00Z"
  },
  {
    id: "prod-026",
    name: "水晶透明粉饼盒",
    code: "PD-SJ026",
    description: "水晶般透明的粉饼盒，时尚美观，展现产品内容的同时保持包装美感。",
    boxType: "粉饼高光盒",
    functionalDesigns: ["透明/透色", "带镜子"],
    shape: "椭圆形",
    material: "petg",
    dimensions: {
      weight: 26,
      length: 85,
      width: 62,
      height: 13,
      capacity: {
        min: 10,
        max: 16
      }
    },
    images: [
      {
        id: "img-026-1",
        url: "/placeholder.svg",
        alt: "水晶透明粉饼盒主图",
        type: "main"
      }
    ],
    pricing: {
      costPrice: 3.2,
      factoryPrice: 4.9,
      hasSample: true,
      boxDimensions: "370x270x190mm",
      boxQuantity: 650
    },
    inStock: true,
    popularityScore: 87,
    createdAt: "2023-07-30T16:20:00Z",
    updatedAt: "2023-09-14T11:50:00Z"
  },
  {
    id: "prod-027",
    name: "多格收纳眼影盘",
    code: "EP-DG027",
    description: "大容量多格设计的眼影盘，可容纳24色眼影，专业化妆师首选。",
    boxType: "腮红盒",
    functionalDesigns: ["带镜子", "带刷位", "双层"],
    shape: "长方形",
    material: "注塑/吹瓶",
    dimensions: {
      weight: 65,
      length: 120,
      width: 90,
      height: 25,
      capacity: {
        min: 30,
        max: 40
      },
      compartments: 24
    },
    images: [
      {
        id: "img-027-1",
        url: "/placeholder.svg",
        alt: "多格收纳眼影盘主图",
        type: "main"
      }
    ],
    pricing: {
      costPrice: 7.5,
      factoryPrice: 12.0,
      hasSample: true,
      boxDimensions: "520x420x300mm",
      boxQuantity: 200
    },
    inStock: true,
    popularityScore: 95,
    createdAt: "2023-06-18T14:45:00Z",
    updatedAt: "2023-08-22T09:30:00Z"
  },
  {
    id: "prod-028",
    name: "便携旅行装口红管",
    code: "RL-BX028",
    description: "专为旅行设计的便携口红管，小巧轻便，方便携带。",
    tubeType: "口红管",
    functionalDesigns: ["卡扣"],
    shape: "迷你",
    material: "petg",
    dimensions: {
      weight: 6,
      length: 40,
      width: 10,
      height: 10,
      capacity: {
        min: 1,
        max: 2
      }
    },
    images: [
      {
        id: "img-028-1",
        url: "/placeholder.svg",
        alt: "便携旅行装口红管主图",
        type: "main"
      }
    ],
    pricing: {
      costPrice: 1.2,
      factoryPrice: 2.1,
      hasSample: true,
      boxDimensions: "180x120x80mm",
      boxQuantity: 2500
    },
    inStock: true,
    popularityScore: 92,
    createdAt: "2023-05-25T10:15:00Z",
    updatedAt: "2023-07-08T13:45:00Z"
  },
  {
    id: "prod-029",
    name: "钻石切面唇釉管",
    code: "LG-ZS029",
    description: "钻石切面设计的唇釉管，多面反光，奢华美观。",
    tubeType: "唇釉管",
    functionalDesigns: ["透明/透色", "贴片"],
    shape: "不规则",
    material: "petg",
    dimensions: {
      weight: 18,
      length: 85,
      width: 20,
      height: 20,
      capacity: {
        min: 4,
        max: 7
      }
    },
    images: [
      {
        id: "img-029-1",
        url: "/placeholder.svg",
        alt: "钻石切面唇釉管主图",
        type: "main"
      }
    ],
    pricing: {
      costPrice: 3.1,
      factoryPrice: 4.9,
      hasSample: true,
      boxDimensions: "290x210x140mm",
      boxQuantity: 850
    },
    inStock: true,
    popularityScore: 88,
    createdAt: "2023-04-12T12:30:00Z",
    updatedAt: "2023-06-25T16:20:00Z"
  },
  {
    id: "prod-030",
    name: "LED照明气垫盒",
    code: "CB-LED030",
    description: "内置LED照明的气垫盒，方便在各种光线下使用，科技感十足。",
    boxType: "气垫盒",
    functionalDesigns: ["带镜子", "双层"],
    shape: "正方形",
    material: "注塑/吹瓶",
    dimensions: {
      weight: 48,
      length: 70,
      width: 70,
      height: 22,
      capacity: {
        min: 12,
        max: 17
      }
    },
    images: [
      {
        id: "img-030-1",
        url: "/placeholder.svg",
        alt: "LED照明气垫盒主图",
        type: "main"
      }
    ],
    pricing: {
      costPrice: 8.5,
      factoryPrice: 13.2,
      hasSample: true,
      boxDimensions: "380x380x280mm",
      boxQuantity: 250
    },
    inStock: true,
    popularityScore: 94,
    createdAt: "2023-03-20T09:45:00Z",
    updatedAt: "2023-05-15T14:30:00Z"
  },
  {
    id: "prod-031",
    name: "渐变色睫毛膏瓶",
    code: "MS-JB031",
    description: "渐变色设计的睫毛膏瓶，颜色过渡自然，视觉效果佳。",
    tubeType: "睫毛膏瓶",
    functionalDesigns: ["透明/透色"],
    shape: "圆形",
    material: "petg",
    dimensions: {
      weight: 15,
      length: 100,
      width: 13,
      height: 13,
      capacity: {
        min: 4,
        max: 8
      }
    },
    images: [
      {
        id: "img-031-1",
        url: "/placeholder.svg",
        alt: "渐变色睫毛膏瓶主图",
        type: "main"
      }
    ],
    pricing: {
      costPrice: 2.4,
      factoryPrice: 3.9,
      hasSample: true,
      boxDimensions: "260x160x120mm",
      boxQuantity: 1050
    },
    inStock: true,
    popularityScore: 86,
    createdAt: "2023-02-28T15:20:00Z",
    updatedAt: "2023-04-18T10:40:00Z"
  },
  {
    id: "prod-032",
    name: "磁悬浮散粉盒",
    code: "LP-CX032",
    description: "创新磁悬浮设计的散粉盒，开合顺滑，科技感满满。",
    boxType: "散粉盒",
    functionalDesigns: ["磁吸", "双层"],
    shape: "圆形",
    material: "注塑/吹瓶",
    dimensions: {
      weight: 52,
      length: 88,
      width: 88,
      height: 32,
      capacity: {
        min: 22,
        max: 32
      }
    },
    images: [
      {
        id: "img-032-1",
        url: "/placeholder.svg",
        alt: "磁悬浮散粉盒主图",
        type: "main"
      }
    ],
    pricing: {
      costPrice: 6.8,
      factoryPrice: 10.5,
      hasSample: true,
      boxDimensions: "440x440x360mm",
      boxQuantity: 280
    },
    inStock: true,
    popularityScore: 93,
    createdAt: "2023-01-15T11:30:00Z",
    updatedAt: "2023-03-22T16:15:00Z"
  },
  {
    id: "prod-033",
    name: "可替换内芯眼线笔",
    code: "EL-KT033",
    description: "环保可替换内芯设计的眼线笔，减少浪费，经济实用。",
    tubeType: "眼线液瓶",
    functionalDesigns: ["卡扣", "双层"],
    shape: "长方形",
    material: "petg",
    dimensions: {
      weight: 12,
      length: 135,
      width: 8,
      height: 8,
      capacity: {
        min: 1,
        max: 2
      }
    },
    images: [
      {
        id: "img-033-1",
        url: "/placeholder.svg",
        alt: "可替换内芯眼线笔主图",
        type: "main"
      }
    ],
    pricing: {
      costPrice: 2.1,
      factoryPrice: 3.4,
      hasSample: true,
      boxDimensions: "240x140x90mm",
      boxQuantity: 1400
    },
    inStock: true,
    popularityScore: 90,
    createdAt: "2022-12-08T14:20:00Z",
    updatedAt: "2023-02-14T12:30:00Z"
  },
  {
    id: "prod-034",
    name: "蝴蝶造型腮红盒",
    code: "BD-HD034",
    description: "优雅蝴蝶造型的腮红盒，艺术性与实用性并存。",
    boxType: "腮红盒",
    functionalDesigns: ["带镜子", "贴片"],
    shape: "不规则",
    material: "注塑/吹瓶",
    dimensions: {
      weight: 38,
      length: 78,
      width: 65,
      height: 18,
      capacity: {
        min: 13,
        max: 18
      }
    },
    images: [
      {
        id: "img-034-1",
        url: "/placeholder.svg",
        alt: "蝴蝶造型腮红盒主图",
        type: "main"
      }
    ],
    pricing: {
      costPrice: 4.7,
      factoryPrice: 7.3,
      hasSample: true,
      boxDimensions: "390x330x230mm",
      boxQuantity: 380
    },
    inStock: true,
    popularityScore: 89,
    createdAt: "2022-11-25T09:15:00Z",
    updatedAt: "2023-01-30T15:45:00Z"
  },
  {
    id: "prod-035",
    name: "智能温控固体棒",
    code: "ST-ZN035",
    description: "智能温控技术的固体棒管，根据环境温度调节产品质地。",
    tubeType: "固体棒",
    functionalDesigns: ["双层", "贴片"],
    shape: "圆形",
    material: "注塑/吹瓶",
    dimensions: {
      weight: 25,
      length: 95,
      width: 28,
      height: 28,
      capacity: {
        min: 12,
        max: 18
      }
    },
    images: [
      {
        id: "img-035-1",
        url: "/placeholder.svg",
        alt: "智能温控固体棒主图",
        type: "main"
      }
    ],
    pricing: {
      costPrice: 6.2,
      factoryPrice: 9.8,
      hasSample: true,
      boxDimensions: "320x240x180mm",
      boxQuantity: 450
    },
    inStock: true,
    popularityScore: 92,
    createdAt: "2022-10-18T13:50:00Z",
    updatedAt: "2022-12-28T11:20:00Z"
  },
  {
    id: "prod-036",
    name: "复古铜制粉饼盒",
    code: "CP-FG036",
    description: "复古铜制风格的粉饼盒，古典美感，适合复古风格品牌。",
    boxType: "粉饼高光盒",
    functionalDesigns: ["带镜子", "卡扣"],
    shape: "圆形",
    material: "注塑/吹瓶",
    dimensions: {
      weight: 35,
      length: 80,
      width: 80,
      height: 16,
      capacity: {
        min: 14,
        max: 20
      }
    },
    images: [
      {
        id: "img-036-1",
        url: "/placeholder.svg",
        alt: "复古铜制粉饼盒主图",
        type: "main"
      }
    ],
    pricing: {
      costPrice: 4.5,
      factoryPrice: 7.1,
      hasSample: true,
      boxDimensions: "400x400x200mm",
      boxQuantity: 480
    },
    inStock: true,
    popularityScore: 85,
    createdAt: "2022-09-12T16:30:00Z",
    updatedAt: "2022-11-20T14:15:00Z"
  },
  {
    id: "prod-037",
    name: "液晶显示气垫盒",
    code: "CB-YJ037",
    description: "配备液晶显示屏的气垫盒，可显示产品信息和使用提醒。",
    boxType: "气垫盒",
    functionalDesigns: ["带镜子", "双层", "贴片"],
    shape: "正方形",
    material: "注塑/吹瓶",
    dimensions: {
      weight: 58,
      length: 72,
      width: 72,
      height: 25,
      capacity: {
        min: 13,
        max: 18
      }
    },
    images: [
      {
        id: "img-037-1",
        url: "/placeholder.svg",
        alt: "液晶显示气垫盒主图",
        type: "main"
      }
    ],
    pricing: {
      costPrice: 12.5,
      factoryPrice: 18.9,
      hasSample: true,
      boxDimensions: "390x390x300mm",
      boxQuantity: 180
    },
    inStock: true,
    popularityScore: 96,
    createdAt: "2022-08-05T10:45:00Z",
    updatedAt: "2022-10-15T09:30:00Z"
  },
  {
    id: "prod-038",
    name: "香水型唇釉管",
    code: "LG-XS038",
    description: "香水瓶造型的唇釉管，优雅精致，提升产品档次。",
    tubeType: "唇釉管",
    functionalDesigns: ["透明/透色", "磁吸"],
    shape: "椭圆形",
    material: "petg",
    dimensions: {
      weight: 19,
      length: 92,
      width: 18,
      height: 18,
      capacity: {
        min: 5,
        max: 9
      }
    },
    images: [
      {
        id: "img-038-1",
        url: "/placeholder.svg",
        alt: "香水型唇釉管主图",
        type: "main"
      }
    ],
    pricing: {
      costPrice: 3.4,
      factoryPrice: 5.2,
      hasSample: true,
      boxDimensions: "310x200x150mm",
      boxQuantity: 720
    },
    inStock: true,
    popularityScore: 91,
    createdAt: "2022-07-22T12:15:00Z",
    updatedAt: "2022-09-18T16:40:00Z"
  },
  {
    id: "prod-039",
    name: "太空银睫毛膏瓶",
    code: "MS-TK039",
    description: "太空银色设计的睫毛膏瓶，未来感十足，科技风格。",
    tubeType: "睫毛膏瓶",
    functionalDesigns: ["磁吸", "双头"],
    shape: "长方形",
    material: "注塑/吹瓶",
    dimensions: {
      weight: 21,
      length: 115,
      width: 16,
      height: 16,
      capacity: {
        min: 7,
        max: 11
      }
    },
    images: [
      {
        id: "img-039-1",
        url: "/placeholder.svg",
        alt: "太空银睫毛膏瓶主图",
        type: "main"
      }
    ],
    pricing: {
      costPrice: 3.8,
      factoryPrice: 5.9,
      hasSample: true,
      boxDimensions: "290x180x160mm",
      boxQuantity: 650
    },
    inStock: true,
    popularityScore: 87,
    createdAt: "2022-06-30T14:50:00Z",
    updatedAt: "2022-08-25T11:25:00Z"
  },
  {
    id: "prod-040",
    name: "彩虹渐变散粉盒",
    code: "LP-CH040",
    description: "彩虹渐变色设计的散粉盒，色彩丰富，青春活力。",
    boxType: "散粉盒",
    functionalDesigns: ["带刷位", "透明/透色"],
    shape: "圆形",
    material: "petg",
    dimensions: {
      weight: 42,
      length: 86,
      width: 86,
      height: 29,
      capacity: {
        min: 19,
        max: 29
      }
    },
    images: [
      {
        id: "img-040-1",
        url: "/placeholder.svg",
        alt: "彩虹渐变散粉盒主图",
        type: "main"
      }
    ],
    pricing: {
      costPrice: 5.1,
      factoryPrice: 7.8,
      hasSample: true,
      boxDimensions: "430x430x320mm",
      boxQuantity: 350
    },
    inStock: true,
    popularityScore: 84,
    createdAt: "2022-05-18T08:30:00Z",
    updatedAt: "2022-07-12T13:15:00Z"
  }
];

export const filterOptions = {
  capacityRange: {
    min: 1,
    max: 30
  },
  compartmentRange: {
    min: 1,
    max: 20
  }
};
