# TurtleAlbum UI Style Guide

本文件定义了整个系统的 UI 设计语言，作为所有新页面开发的参考依据。

---

## 设计理念

**温暖质感 + 超大反差 + 动态现代**

- **简洁、现代、有质感** - 通过柔和的阴影、圆润的边角、精心调配的中性色与高亮色，营造专业而温暖的视觉体验
- **超大反差强调重点** - 核心数据用超大字号，辅助信息用极小字号，通过强烈的视觉对比突出重点
- **中英文混排** - 中文大字体粗体，英文小字宽间距作为点缀装饰
- **动态现代** - Apple 官网风格滚动动效，随滚动渐入、数字滚动、视差效果
- **灵活运用** - 以上元素可根据页面需求自由组合，不局限于特定页面类型

---

## 色彩系统

### 主调色板

| 颜色 | Hex | 角色 | 用法 |
|------|-----|------|------|
| **亮黄** | `#FFD400` | primary accent | 选中状态、重要标签、高亮文字、CTA按钮 |
| **纯白** | `#FFFFFF` | surface | 卡片背景、弹窗背景 |
| **纯黑** | `#000000` | ink | 深色容器、反向文字背景 |
| **浅灰** | `#F3F4F6` (neutral-100) | background | 占位图、次背景 |
| **中灰** | `#E5E7EB` (neutral-200) | border | 默认边框、分割线 |

### 背景渐变

页面背景采用柔和的三色渐变：
```
from-stone-100 → via-white → to-amber-50/40
```
营造温暖、有层次的底色。

### 中性文字层次

| 层级 | 颜色 | 用途 |
|------|------|------|
| 一级 | `neutral-900` / `black` | 标题、名称、主要数据 |
| 二级 | `neutral-700` | 正文、描述 |
| 三级 | `neutral-500` / `neutral-600` | 辅助说明、时间戳、编号 |
| 四级 | `neutral-400` | 禁用态、装饰性文字 |

### 功能状态色

| 状态 | 背景色 | 文字色 | 场景 |
|------|--------|--------|------|
| **待配** | `#FFD400` (90%) | `black` | 可交配状态 |
| **逾期** | `red-600` (90%) | `white` | 异常状态 |
| **成功/完成** | `emerald-50` | `emerald-800` | 交配记录 |
| **产蛋/孵化** | `amber-50` | `amber-800` | 产蛋记录 |

### 标签系统色

| 类型 | 背景 | 边框 | 文字 |
|------|------|------|------|
| **父本** | `sky-50` (70%) | `sky-200` | `sky-700` |
| **母本** | `rose-50` (70%) | `rose-200` | `rose-700` |
| **配偶** | `amber-50` (70%) | `amber-200` | `amber-800` |

### 色彩使用规则

1. **高亮色节制使用**：`#FFD400` 仅用于最重要的交互反馈和数据突出，不要滥用
2. **背景层次**：通过白色卡片在渐变背景上形成清晰的视觉层级
3. **边框克制**：优先用阴影和间距区分元素，边框只用在确实需要边界的地方
4. **透明度运用**：重要元素用纯色，次要元素可用 70%-90% 透明度

---

## 字体系统

### 字体栈

| 用途 | 字体 | 风格 |
|------|------|------|
| **标题** | Playfair Display | serif, 优雅有品质感 |
| **正文** | Inter | sans-serif, 现代易读 |

CSS 规则：
```css
h1, h2, h3, h4, h5, h6 { font-family: 'Playfair Display', serif; }
body, p, span, div { font-family: 'Inter', sans-serif; }
```

### 字体大小层级

| 级别 | 移动端 | 桌面端 | 字重 | 用途 |
|------|--------|--------|------|------|
| **Display** | 26px | 34px | 600 | 页面主标题 |
| **XL** | 24px | 30px | 600 | 卡片大标题 |
| **LG** | 18px | 20px | 600 | 卡片标题 |
| **Base** | 14px | 16px | 400 | 正文 |
| **SM** | 12px | 14px | 400-500 | 辅助说明 |
| **XS** | 10px | 11px | 400-500 | 标签、装饰文字 |

### 字体颜色与样式

- **标题**：`neutral-900` / `black`，适当字间距收紧
- **正文**：`neutral-700`，行高 1.5-1.6
- **辅助文字**：`neutral-500`，可适当增加字间距

---

## 圆角系统

### 圆角尺度

| 圆角 | 尺寸 | 用途 |
|------|------|------|
| **Full** | `rounded-full` | 按钮、徽章、标签、悬浮按钮 |
| **3XL** | `rounded-3xl` (24px) | 大卡片、轮播图、主容器 |
| **2XL** | `rounded-2xl` (16px) | 标准卡片、弹窗 |
| **LG** | `rounded-lg` (8px) | 小卡片、图片预览、节点 |
| **MD** | `rounded-md` (6px) | 按钮、输入框 |

### 圆角使用规则

1. **外大内小**：外层容器用大圆角，内部元素用小圆角
2. **胶囊风格**：可点击的筛选器、标签、小按钮一律用 `rounded-full`
3. **图片与容器一致**：图片圆角应与外层卡片圆角匹配

---

## 阴影系统

### 阴影层次

| 层级 | 阴影值 | 用途 |
|------|--------|------|
| **Surface** | `0 4px 20px rgba(0,0,0,0.06)` | 常态卡片、筛选条 |
| **Elevated** | `0 12px 34px rgba(0,0,0,0.14)` | 悬停卡片、浮层 |
| **Prominent** | `0 14px 38px rgba(0,0,0,0.14)` | 主轮播、重要容器 |
| **Hero** | `0 18px 50px rgba(0,0,0,0.22)` | 页面头图 |
| **Glow** | `0 6px 20px rgba(255,212,0,0.22)` | 选中态、高亮按钮 |

### 阴影使用规则

1. **交互反馈**：常态用 Surface，悬停用 Elevated，形成高度变化感
2. **高亮光晕**：选中状态配合黄色 `#FFD400` 使用 Glow 阴影
3. **克制深阴影**：避免过于强烈的阴影，保持轻盈感

---

## 间距系统

### 间距尺度

使用 Tailwind 标准间距：

| 间距 | 尺寸 | 用途 |
|------|------|------|
| **XS** | `gap-2` (8px) | 紧凑元素间距 |
| **SM** | `gap-3` / `gap-4` (12-16px) | 卡片间距（移动端） |
| **MD** | `gap-5` / `gap-6` (20-24px) | 卡片间距（桌面） |
| **LG** | `gap-8` (32px) | 区块间距 |
| **XL** | `gap-12` (48px) | 大区块间距 |

### 内边距

| 容器 | 内边距 |
|------|--------|
| 大卡片 | `p-6 md:p-8` |
| 标准卡片 | `p-5 sm:p-6` |
| 小卡片 | `p-4` |

---

## 组件设计规范

### 按钮 (Buttons)

#### 胶囊筛选按钮
```
常态:  border-neutral-200 bg-white text-neutral-700
选中:  border-[#FFD400] bg-white text-black + glow shadow
尺寸:  h-8 px-3 text-xs (移动端) / lg:h-9 lg:px-4 lg:text-sm (桌面)
圆角:  rounded-full
```

#### 主操作按钮
```
背景:  amber 渐变 (from-amber-400 to-yellow-500)
文字:  neutral-900
阴影:  0 4px 12px rgba(251,191,36,0.4)
圆角:  rounded-full
```

### 卡片 (Cards)

#### 标准卡片
```
背景:     bg-white
边框:     border-neutral-200/90
圆角:     rounded-2xl
阴影:     0 4px 20px rgba(0,0,0,0.06)
悬停:     -translate-y-0.5 + 边框加深 + 阴影增强
```

#### 大卡片/主容器
```
背景:     bg-white / bg-white/90 (带模糊)
圆角:     rounded-3xl
阴影:     0 12px 34px rgba(0,0,0,0.14)
```

### 标签 (Badges)

#### 状态标签
```
圆角:     rounded-full
边框:     ring-1 (细边框)
文字:     小号字 (11px / 12px)
字重:     font-semibold
```

#### 价格标签
```
背景:     bg-neutral-900
文字:     text-[#FFD400]
边框:     ring-1 ring-white/10
圆角:     rounded-full
```

### 筛选栏 (Filter Bar)

```
定位:     sticky top-[calc(env(safe-area-inset-top)+10px)]
背景:     bg-white/95 backdrop-blur-md
边框:     border-black/5
阴影:     0 4px 20px rgba(0,0,0,0.06)
圆角:     sm:rounded-2xl
```

---

## 布局模式

### 瀑布流网格 (Masonry Grid)

```
移动端:   grid-cols-2 gap-3
平板:     grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4
大屏:     grid-cols-[repeat(auto-fill,minmax(240px,1fr))]
```

### 详情页布局 (Detail Layout)

```
移动端:   单列 stack
桌面端:   lg:grid-cols-[minmax(340px,420px)_1fr] gap-4
          左列固定宽度, 右列自适应
```

### 横向滚动 (Horizontal Scroll)

用于时间线、家族树等：
```
overflow-x-auto overflow-y-hidden
inline-flex gap-8 px-4 py-6
```

---

## 动效系统

### 过渡时长

| 时长 | 用途 |
|------|------|
| **0.2s** | 快速反馈 (accordion) |
| **0.3s** | 标准交互 (hover, filter) |
| **0.5s** | 慢动作 (hero, expand) |

### 缓动函数

- **标准**: `ease-out` / `ease`
- **弹性**: `cubic-bezier(0.175, 0.885, 0.32, 1.275)` (用于悬停放大)

### 常用动效

#### 卡片悬停
```css
.product-card:hover {
  transform: translateY(-5px);
  transition: all 0.3s ease;
}
```

#### 渐显动画
```css
.reveal {
  opacity: 0;
  transform: translateY(30px);
  transition: opacity 0.8s ease-out, transform 0.8s ease-out;
}
.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}
```

#### 折叠动画
```
transition-[max-height,opacity,transform] duration-300/500 ease-out
```

---

## 特殊设计元素

### 背景模糊 (Backdrop Blur)

用于悬浮元素、吸顶筛选栏：
```
bg-white/95 backdrop-blur-md
```

### 渐变遮罩 (Gradient Overlay)

用于图片上的文字层：
```
from-black/35 via-black/25 to-black/40 (Hero)
from-black/70 via-black/60 to-black/50 (介绍卡)
```

### 装饰性光晕

用于重点区域的背景装饰：
```
absolute -top-20 -right-20 w-64 h-64 bg-[#FFD400]/20 rounded-full blur-3xl
```

---

## 响应式断点

| 断点 | 宽度 | 描述 |
|------|------|------|
| **sm** | 640px | 手机横屏 / 小平板 |
| **md** | 768px | 平板 |
| **lg** | 1024px | 小桌面 |
| **xl** | 1280px | 大桌面 |

---

## 色彩增强运用

### 设计原则

1. **超大反差** - 核心数据用超大字号，辅助信息用极小字号
2. **中英文混排** - 中文大字体粗体，英文小字作为点缀装饰
3. **简洁勾线** - 用线条图形做数据可视化，拒绝复杂装饰
4. **同色透明渐变** - 只有高亮色自身透明度变化，不做颜色混合
5. **滚动动效** - Apple 官网风格，随滚动渐入、数字滚动、视差

### 透明度层级运用

在原有配色基础上，增加透明度变化的运用：

| 颜色 | Hex | 透明度层级 | 用途 |
|------|-----|-----------|------|
| **亮黄** | `#FFD400` | 100% | 核心高亮、大数字、主标题 |
| | | 80% | 次重要元素 |
| | | 60% | 装饰元素、背景光晕 |
| | | 40% | 次要边框、弱装饰 |
| | | 20% | 背景光晕、弱填充 |
| | | 10% | 极弱背景 |
| **纯白** | `#FFFFFF` | 100% | 主标题、正文 |
| | | 80% | 次要文字 |
| | | 60% | 辅助说明 |
| | | 40% | 装饰性文字、边框 |
| | | 20% | 极弱装饰 |
| **纯黑** | `#000000` | 100% | 深色容器、反向文字背景 |
| **中性灰** | `neutral-900` | 100% | 深灰容器 |

**重要规则**: 只做同色透明度变化，**禁止**不同颜色互渐变。

---

## 字体系统增强

### 超大反差层级

| 层级 | 移动端 | 桌面端 | 字重 | 用途 |
|------|--------|--------|------|------|
| **Mega** | 48-64px | 80-120px | 800-900 | 核心大数字、Hero 标题 |
| **Display** | 36-40px | 56-72px | 700-800 | 区块大标题 |
| **XL** | 28-32px | 40-48px | 600-700 | 卡片标题 |
| **Base** | 16-18px | 18-20px | 400-500 | 正文 |
| **SM** | 12-14px | 14-16px | 400 | 辅助说明 |
| **Micro** | 10-11px | 11-12px | 300-400 | 装饰英文、标签 |

#### 中英文混排规范

```
中文大字体粗体 + 英文小字点缀

示例结构:
┌─────────────────────────────────┐
│   繁育数据                      │  <-- 中文大粗体
│   BREEDING DATA                 │  <-- 英文小字，浅色，宽字间距
│                                 │
│   1,247                         │  <-- 超大数字 (Mega)
│   Total Eggs                    │  <-- 英文小字在下
└─────────────────────────────────┘
```

实现代码:
```html
<div>
  <h2 class="text-4xl md:text-6xl font-bold text-neutral-900">繁育数据</h2>
  <p class="text-sm tracking-[0.3em] text-neutral-500 uppercase mt-1">BREEDING DATA</p>

  <div class="mt-8">
    <span class="text-6xl md:text-8xl lg:text-[120px] font-black text-[#FFD400]">1,247</span>
    <p class="text-sm text-neutral-600 tracking-wider mt-2">Total Eggs</p>
  </div>
</div>
```

英文装饰文字要点:
- 全部大写 (`uppercase`)
- 宽字间距 (`tracking-[0.2em]` ~ `tracking-[0.4em]`)
- 浅色 (`neutral-400` ~ `neutral-600`)
- 细字重 (`font-light` / `font-normal`)

---

## Bento Grid 布局系统

#### 响应式网格

| 断点 | 列数 | Gap |
|------|------|-----|
| 移动端 | 1 | `gap-4` (16px) |
| 平板 | 2 | `gap-5` (20px) |
| 小桌面 | 3 | `gap-6` (24px) |
| 大桌面 | 4 | `gap-6` (24px) |

#### 卡片尺寸比例

| 尺寸名称 | Grid跨度 | 比例 | 用途 |
|----------|----------|------|------|
| **Small** | `1x1` | 1:1 | 小数据卡、图标卡 |
| **Horizontal** | `2x1` | 2:1 | 横向图表、时间线 |
| **Vertical** | `1x2` | 1:2 | 纵向列表、排名 |
| **Big** | `2x2` | 1:1 | Hero 卡、主数据展示 |
| **Wide** | `3-4 x 1` | 全宽 | 页头、大图表 |

#### 基础布局代码

```html
<div class="min-h-screen bg-gradient-to-br from-stone-100 via-white to-amber-50/40 p-4 md:p-6 lg:p-8">
  <div class="max-w-7xl mx-auto">

    <!-- Bento Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 lg:gap-6">

      <!-- Big Card (2x2) - Hero 数据 -->
      <div class="col-span-1 md:col-span-2 lg:col-span-2 row-span-1 md:row-span-2
                  bg-white rounded-3xl border border-neutral-200 p-6 md:p-8
                  overflow-hidden relative">
        <!-- 装饰光晕 -->
        <div class="absolute -top-20 -right-20 w-64 h-64 bg-[#FFD400]/20 rounded-full blur-3xl"></div>

        <div class="relative z-10">
          <h2 class="text-3xl md:text-4xl lg:text-5xl font-bold text-neutral-900">2026 繁育报告</h2>
          <p class="text-sm tracking-[0.3em] text-neutral-500 uppercase mt-2">BREEDING REPORT 2026</p>

          <div class="mt-10 md:mt-16">
            <div class="text-7xl md:text-8xl lg:text-[120px] font-black text-neutral-900 leading-none">
              1,247
            </div>
            <p class="text-lg text-neutral-600 mt-4">总产蛋数 Total Eggs</p>
          </div>

          <div class="flex gap-8 mt-12">
            <div>
              <div class="text-3xl font-bold text-[#FFD400]">847</div>
              <div class="text-xs text-neutral-500 mt-1">Hatched</div>
            </div>
            <div>
              <div class="text-3xl font-bold text-neutral-900">68%</div>
              <div class="text-xs text-neutral-500 mt-1">Rate</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Small Card (1x1) - 数据统计 -->
      <div class="col-span-1 bg-white rounded-3xl border border-neutral-200 p-6
                  flex flex-col justify-between">
        <div class="w-12 h-12 rounded-2xl bg-[#FFD400]/10 flex items-center justify-center">
          <i class="fas fa-egg text-[#FFD400] text-xl"></i>
        </div>
        <div class="mt-6">
          <div class="text-4xl md:text-5xl font-bold text-neutral-900">342</div>
          <p class="text-sm text-neutral-600 mt-1">
            <span class="font-bold text-[#FFD400]">+12%</span> vs last month
          </p>
        </div>
        <p class="text-[10px] text-neutral-400 uppercase tracking-wider mt-6">CURRENT STOCK</p>
      </div>

      <!-- Horizontal Card (2x1) - 趋势图 -->
      <div class="col-span-1 md:col-span-2 bg-white rounded-3xl border border-neutral-200 p-6 md:p-8">
        <div class="flex items-start justify-between mb-6">
          <div>
            <h3 class="text-xl font-bold text-neutral-900">产蛋趋势</h3>
            <p class="text-xs text-neutral-500 uppercase tracking-wider mt-1">EGG TREND</p>
          </div>
          <span class="text-sm text-[#FFD400] font-medium">+24%</span>
        </div>

        <!-- 勾线图表 -->
        <div class="h-32 flex items-end gap-2">
          <div class="flex-1 bg-[#FFD400]/20 rounded-t-lg" style="height: 40%"></div>
          <div class="flex-1 bg-[#FFD400]/30 rounded-t-lg" style="height: 55%"></div>
          <div class="flex-1 bg-[#FFD400]/40 rounded-t-lg" style="height: 45%"></div>
          <div class="flex-1 bg-[#FFD400]/60 rounded-t-lg" style="height: 70%"></div>
          <div class="flex-1 bg-[#FFD400]/70 rounded-t-lg" style="height: 65%"></div>
          <div class="flex-1 bg-[#FFD400]/80 rounded-t-lg" style="height: 80%"></div>
          <div class="flex-1 bg-[#FFD400] rounded-t-lg" style="height: 95%"></div>
        </div>

        <div class="flex justify-between mt-3 text-xs text-neutral-500">
          <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span>
        </div>
      </div>

    </div>
  </div>
</div>
```

---

## 图形与数据可视化

### 简洁勾线风格

只使用线条和简单几何形状，不做复杂填充：

**条形图 (纯 CSS)**:
```html
<div class="space-y-3">
  <div class="flex items-center gap-3">
    <span class="text-sm text-neutral-600 w-12">Q1</span>
    <div class="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
      <div class="h-full bg-[#FFD400] rounded-full" style="width: 65%"></div>
    </div>
    <span class="text-sm text-neutral-900 font-mono w-12">65%</span>
  </div>
  <div class="flex items-center gap-3">
    <span class="text-sm text-neutral-600 w-12">Q2</span>
    <div class="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
      <div class="h-full bg-[#FFD400]/80 rounded-full" style="width: 82%"></div>
    </div>
    <span class="text-sm text-neutral-900 font-mono w-12">82%</span>
  </div>
</div>
```

**圆环图 (SVG)**:
```html
<div class="relative w-32 h-32">
  <svg class="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
    <!-- 背景圆环 -->
    <circle cx="50" cy="50" r="40" stroke="#F3F4F6" stroke-width="8" fill="none"/>
    <!-- 进度圆环 (亮黄 60%) -->
    <circle cx="50" cy="50" r="40" stroke="#FFD400" stroke-width="8" fill="none"
            stroke-dasharray="251.2" stroke-dashoffset="100.5"
            stroke-linecap="round"/>
  </svg>
  <div class="absolute inset-0 flex items-center justify-center">
    <span class="text-2xl font-bold text-neutral-900">60%</span>
  </div>
</div>
```

**时间线 (勾线)**:
```html
<div class="relative pl-8 border-l border-neutral-200 space-y-8">
  <div class="relative">
    <div class="absolute -left-[41px] w-3 h-3 bg-[#FFD400] rounded-full"></div>
    <p class="text-sm text-neutral-500 uppercase tracking-wider">Jan 2026</p>
    <p class="text-lg text-neutral-900 font-medium mt-1">First Egg Laid</p>
  </div>
  <div class="relative">
    <div class="absolute -left-[41px] w-3 h-3 bg-neutral-300 rounded-full"></div>
    <p class="text-sm text-neutral-500 uppercase tracking-wider">Feb 2026</p>
    <p class="text-lg text-neutral-900 font-medium mt-1">Hatching Season</p>
  </div>
</div>
```

#### 图标系统

使用专业图标库（不使用 emoji）：
- **Font Awesome** (Solid 风格)
- **Material Icons** (Outlined 风格)

图标尺寸:
- 小: `text-lg` (18px)
- 中: `text-2xl` (24px)
- 大: `text-4xl` (36px)
- 超大: `text-6xl` (60px)

图标颜色:
- 默认: `text-neutral-500` / `text-neutral-600`
- 高亮: `text-[#FFD400]`
- 装饰: `text-neutral-300` / `text-neutral-400`

---

## 动效系统 (Apple 风格)

#### 技术栈

- **CSS/原生 JS** - 基础动效优先使用
- **Framer Motion** - 复杂动效通过 CDN 引入
- **GSAP** - 可选，用于高级时间线控制

CDN 引入:
```html
<!-- TailwindCSS -->
<script src="https://cdn.tailwindcss.com"></script>

<!-- Font Awesome -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

<!-- Framer Motion (可选) -->
<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/framer-motion/dist/framer-motion.umd.js"></script>

<!-- GSAP (可选) -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js"></script>
```

#### 滚动触发动画 (Scroll Reveal)

```javascript
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, {
  threshold: 0.1,
  rootMargin: '0px 0px -50px 0px'
});

document.querySelectorAll('.reveal').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(30px)';
  el.style.transition = 'opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), ' +
                         'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
  observer.observe(el);
});

// CSS 类
.reveal.visible {
  opacity: 1 !important;
  transform: translateY(0) !important;
}
```

#### Stagger 依次出现

```html
<div class="space-y-4">
  <div class="reveal" style="transition-delay: 0s">Item 1</div>
  <div class="reveal" style="transition-delay: 0.1s">Item 2</div>
  <div class="reveal" style="transition-delay: 0.2s">Item 3</div>
</div>
```

#### 数字滚动动画 (Apple 风格)

```javascript
function animateNumber(element, target, duration = 2000) {
  const start = 0;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeOutQuart = 1 - Math.pow(1 - progress, 4);
    const current = Math.floor(start + (target - start) * easeOutQuart);
    element.textContent = current.toLocaleString();

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }
  requestAnimationFrame(update);
}

// 使用
window.addEventListener('load', () => {
  document.querySelectorAll('[data-animate-number]').forEach(el => {
    const target = parseInt(el.dataset.animateNumber);
    setTimeout(() => animateNumber(el, target), 500);
  });
});
```

#### 卡片悬停动效

```css
.bento-card {
  transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275),
              box-shadow 0.4s ease,
              border-color 0.4s ease;
}

.bento-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 40px rgba(255, 212, 0, 0.12);
  border-color: rgba(255, 212, 0, 0.3);
}
```

#### 视差滚动 (Parallax)

```javascript
window.addEventListener('scroll', () => {
  const scrolled = window.pageYOffset;
  document.querySelectorAll('.parallax').forEach(el => {
    const speed = el.dataset.speed || 0.5;
    el.style.transform = `translateY(${scrolled * speed}px)`;
  });
});
```

---

## 完整起始模板

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TurtleAlbum - Dashboard</title>

  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Playfair+Display:wght@400;500;600;700&display=swap" rel="stylesheet">

  <style>
    * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif; }
    h1, h2, h3, h4, h5, h6 { font-family: 'Playfair Display', serif; }

    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: #F3F4F6; }
    ::-webkit-scrollbar-thumb { background: #D1D5DB; border-radius: 4px; }

    .reveal {
      opacity: 0;
      transform: translateY(30px);
      transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1),
                  transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .reveal.visible { opacity: 1; transform: translateY(0); }

    .bento-card {
      transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275),
                  box-shadow 0.4s ease,
                  border-color 0.4s ease;
    }
    .bento-card:hover {
      transform: translateY(-8px);
      box-shadow: 0 20px 40px rgba(255, 212, 0, 0.12);
      border-color: rgba(255, 212, 0, 0.3);
    }
  </style>
</head>
<body class="bg-gradient-to-br from-stone-100 via-white to-amber-50/40 text-neutral-900 min-h-screen">

  <div class="p-4 md:p-6 lg:p-8">
    <div class="max-w-7xl mx-auto">

      <!-- 页面标题 -->
      <header class="mb-8 md:mb-12 reveal">
        <p class="text-xs tracking-[0.4em] text-neutral-500 uppercase mb-3">Dashboard</p>
        <h1 class="text-4xl md:text-6xl lg:text-7xl font-black text-neutral-900">
          繁育数据中心
        </h1>
      </header>

      <!-- Bento Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 lg:gap-6">

        <!-- 插入你的 Bento 卡片... -->

      </div>

    </div>
  </div>

  <script>
    // 滚动触发动画
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    // 数字滚动动画
    function animateNumber(element, target, duration = 2000) {
      const start = 0;
      const startTime = performance.now();
      function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const current = Math.floor(start + (target - start) * easeOutQuart);
        element.textContent = current.toLocaleString();
        if (progress < 1) requestAnimationFrame(update);
      }
      requestAnimationFrame(update);
    }

    window.addEventListener('load', () => {
      document.querySelectorAll('[data-animate-number]').forEach(el => {
        const target = parseInt(el.dataset.animateNumber);
        setTimeout(() => animateNumber(el, target), 500);
      });
    });
  </script>

</body>
</html>
```

---

## 在线图表组件集成

如需引入在线图表组件（如 ECharts、Chart.js），需保持样式一致：

- 主色调: `#FFD400` (100% / 80% / 60% / 40% / 20%)
- 背景色: `#FFFFFF` 或透明
- 文字色: `neutral-900` / `neutral-600` / `neutral-500`
- 网格线: `neutral-100` / `neutral-200`
- 禁用渐变色，只使用同色透明度

---

## 关键文件索引

| 用途 | 文件路径 |
|------|----------|
| Tailwind 配置 | `frontend/tailwind.config.ts` |
| 全局样式 | `frontend/src/index.css` |
| 瀑布流参考 | `frontend/src/pages/SeriesFeed.tsx` |
| 详情页参考 | `frontend/src/pages/BreederDetail.tsx` |
