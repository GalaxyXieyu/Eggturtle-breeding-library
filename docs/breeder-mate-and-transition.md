# TurtleAlbum: 配偶/换公过渡期/编号大写/图片路径 规则说明

本文档把目前 TurtleAlbum 的繁育相关约定（基于现有实现）整理下来，避免后续遗忘。

## 1. 字段与来源

- 产品/种龟表：`products`
- 备注字段：`products.description`
- 父本编号：`products.sire_code`
- 母本编号：`products.dam_code`
- 配偶编号：`products.mate_code`

说明：当前系统没有单独的“产蛋表/窝次表”作为业务主数据，产蛋/交配/换公等事件主要通过 `description` 文本记录。

## 2. 种母详情页：当前配偶如何展示

目标：只在种母（`sex=female`）展示“当前配偶”黄色胶囊。

后端返回字段（breeder detail）：
- `currentMate`: `{ id, code } | null`
- `currentMateCode`: `string | null`（best-effort：即使找不到配偶 id 也返回编号）

取值优先级：
1) `products.mate_code`（后台显式填写的配偶编号）
2) `products.description` 中最后一条换公记录：`M.D 更换配偶为<编号>公`
3) 最近一次交配记录里的公龟（如果存在）

前端展示规则：
- 只要存在配偶编号（`currentMate.code` / `currentMateCode` / `mateCode` 任一可用），就显示黄色胶囊。
- 若能解析到配偶 `id`（`currentMate.id` 或通过 `by-code` 查询到），胶囊可点击跳转 `/breeder/:id`。
- 若只有编号但查不到 `id`，胶囊显示但置灰不可点（避免“看不到以为没生效”）。

## 3. 管理后台：配偶编号录入

后台产品创建/编辑表单新增字段：配偶编号（仅业务上用于种母）。

存储：`products.mate_code`。

## 4. 换公过渡期：备注自动化规则

业务规则：
- 换公记录格式：`M.D 更换配偶为B公`（不写年）
- 产蛋记录格式：`M.D 产N蛋`（例如 `2.22 产4蛋`）
- 若发生换公，则其后的 2 次产蛋属于过渡期，自动追加后缀：`-换公过渡期`

实现方式（不新建表）：
- 过渡期剩余次数通过机器标记记录在“最新换公行”的末尾：
  - `#TA_PAIR_TRANSITION=<remaining>`
  - 例：`2.22 更换配偶为B公 #TA_PAIR_TRANSITION=1`
- 触发点：管理员保存 `products.description` 时（admin 更新接口）
  - 仅处理“本次新增的产蛋行”
  - 若 remaining > 0：给新增产蛋行追加 `-换公过渡期`，并将 remaining 递减
  - 若用户手写了 `-换公过渡期`：不重复追加，但仍递减（该窝已计入过渡期）

注意：为了不影响“当前配偶解析”，机器标记与“B公”之间必须有空格。

## 5. 编号统一大写（防止匹配失败）

需求：无论用户输入小写还是大写，系统最终都存成大写，避免：
- `HB-g` 与 `HB-G` 被当成两只不同的龟
- 配偶/父母本 by-code 查询失败

规则：
- 以下字段在保存时统一转大写：
  - `products.code`
  - `products.sire_code`
  - `products.dam_code`
  - `products.mate_code`

实现：
- 前端输入框：`onChange` 即时 `toUpperCase()`（用户看到的就是最终效果）
- 后端入库兜底：create/update 入库前 `upper()`，且“code 是否重复”校验也基于大写后的 code

## 6. 图片与编号变更的关系（重要）

图片文件保存路径与编号相关：
- 上传时会落到 `static/images/<product_code>/...`
- 数据库 `product_images.url` 常见为相对路径：`images/<product_code>/<file>.jpg`

问题：如果把 `products.code` 从小写改成大写（例如 `HB-g -> HB-G`），图片文件目录可能仍是旧目录 `HB-g`。

兼容策略：
- 后端在组装图片 URL 时，兼容 `images/<code>/...` 这种相对路径，避免因“找不到 small 变体”而把图片过滤掉。

推荐操作（可选）：
- 若后续要彻底清理，可做一次离线迁移：把磁盘目录从 `HB-g` 重命名到 `HB-G`，并同步更新 DB 里的 `product_images.url`。

## 7. 关联文档

- 编号与排序规范（草案，需评审后落地）：`docs/CODE_RULES_AND_SORTING.md`

## 8. 常见操作清单

- 设置配偶：后台编辑种母 -> 填 `配偶编号(mate_code)` -> 保存
- 换公：在 `description` 追加 `M.D 更换配偶为X公` -> 保存
- 产蛋：在 `description` 追加 `M.D 产N蛋` -> 保存（系统会在过渡期自动加后缀）

