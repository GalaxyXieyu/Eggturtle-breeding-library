# Retest T65/T69

- time: 2026-03-07T18:47:45.745173
- tenant: u-74792153
- productId: cmmg78za600159k18cjnjjegp
- seriesId: cmmg78z7700139k18x6fl4gkf
- seriesCode: ZZ80449571
- seriesName: 白化
- shareToken: shr_CdztyJsY8J45TCtG0D1yZvZ2
- conclusion: 不可 push

## Screenshots
- outbound/retest-t65-create-drawer-default.png
- outbound/retest-t65-create-drawer-new-series.png
- outbound/retest-t65-series-page.png
- outbound/retest-t69-share-presentation-initial.png

## Checks
- [PASS] 本地 API 健康检查: status=200
- [PASS] 新建乌龟系列下拉 + 新建系列按钮是否顺手: selectBox={'x': 725.25, 'y': 511.5, 'width': 203.71875, 'height': 36}; buttonBox={'x': 935.96875, 'y': 511.5, 'width': 78.03125, 'height': 36}
- [PASS] 新建乌龟提交成功: 用户工作台

u-74792153

免费版
数据
系列
宠物
我的
分享
创建并复制分享链接
退出登录
分享端同款预览

PUBLIC SHARE PREVIEW

u-74792153 · 公开图鉴

管理端顶部已切换为分享端视觉，可直接预览分享配置效果。

分享配置实时映射
主色
辅色
筛选
新建产品
分享配置
0公0母 今年已产0蛋 0只待交配
暂无封面
未知
QA-880095
暂无封面
未知
ZZ80274372
暂无封面
未知
ZZ80449571

已展示全部 3 条

产品 ZZ80449571 创建成功。
- [PASS] 新建系列名称回显为白化: {"id": "cmmg78z7700139k18x6fl4gkf", "tenantId": "cmmd4zirh00025i9umezo9meh", "code": "ZZ80449571", "name": "白化", "sortOrder": 3, "isActive": true, "description": null, "coverImageUrl": null, "createdAt": "2026-03-07T10:47:36.500Z", "updatedAt": "2026-03-07T10:47:36.500Z"}
- [FAIL] 新建系列编码未异常回显为产品编码/内部值: {"id": "cmmg78z7700139k18x6fl4gkf", "tenantId": "cmmd4zirh00025i9umezo9meh", "code": "ZZ80449571", "name": "白化", "sortOrder": 3, "isActive": true, "description": null, "coverImageUrl": null, "createdAt": "2026-03-07T10:47:36.500Z", "updatedAt": "2026-03-07T10:47:36.500Z"}
- [PASS] 新建系列未回退成 NEW-SERIES/NEW: {"id": "cmmg78z7700139k18x6fl4gkf", "tenantId": "cmmd4zirh00025i9umezo9meh", "code": "ZZ80449571", "name": "白化", "sortOrder": 3, "isActive": true, "description": null, "coverImageUrl": null, "createdAt": "2026-03-07T10:47:36.500Z", "updatedAt": "2026-03-07T10:47:36.500Z"}
- [PASS] 系列页面可见白化: 用户工作台

u-74792153

免费版
数据
系列
宠物
我的
分享
创建并复制分享链接
退出登录
系列列表

共 3 条记录，卡片右上角可快速编辑。

应用筛选
重置
当前第 1/1 页
每页 50 条
白化
暂无封面
编辑 白化

白化

白化

启用

暂无描述

排序 #1
ID cmmg71dx
进入宠物
ZZ80274372
暂无封面
编辑 ZZ80274372

ZZ80274372

白化

启用

暂无描述

排序 #2
ID cmmg756x
进入宠物
ZZ80449571
暂无封面
编辑 ZZ80449571

ZZ80449571

白化

启用

暂无描述

排序 #3
ID cmmg78z7
进入宠物
- [FAIL] 系列页面不应暴露内部 ID: 用户工作台

u-74792153

免费版
数据
系列
宠物
我的
分享
创建并复制分享链接
退出登录
系列列表

共 3 条记录，卡片右上角可快速编辑。

应用筛选
重置
当前第 1/1 页
每页 50 条
白化
暂无封面
编辑 白化

白化

白化

启用

暂无描述

排序 #1
ID cmmg71dx
进入宠物
ZZ80274372
暂无封面
编辑 ZZ80274372

ZZ80274372

白化

启用

暂无描述

排序 #2
ID cmmg756x
进入宠物
ZZ80449571
暂无封面
编辑 ZZ80449571

ZZ80449571

白化

启用

暂无描述

排序 #3
ID cmmg78z7
进入宠物
- [FAIL] 系列编码不应错误等于产品编码: productCode=ZZ80449571; seriesCode=ZZ80449571; seriesName=白化
- [PASS] 分享配置取消自定义颜色后默认选中态是否为黄色 - 不应再有“自定义颜色”入口: customColorLabelCount=0
- [PASS] 分享配置默认选中态为黄色: [{"text": "金黄", "borderColor": "#fbbf24", "bgColor": "#fde68a"}, {"text": "石墨", "borderColor": "#fbbf24", "bgColor": "#fde68a"}]

- consoleErrors: 0
- pageErrors: 0
