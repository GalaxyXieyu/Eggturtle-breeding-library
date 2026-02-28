# 支付上线快跑手册（个人主体 / 支付宝 + 微信）

更新时间：2026-02-28
适用对象：你当前项目（已预留支付模块，暂未启用）

## 0. 先回答你的问题

你不需要把项目“完全上线”后才去申请。

正确顺序是：
1. 先发起主体/商户申请（业务先走）。
2. 同步准备域名、HTTPS、回调地址（技术并行）。
3. 拿到商户参数后联调。
4. 回调验签+幂等通过后再开生产。

## 1. 哪些环节必须要域名/HTTPS

## 1.1 可先做（无域名也能启动）

- 支付宝应用创建、主体实名认证
- 微信小微/商户入驻申请
- 商户参数申请（如 `mchid`、`app_id`）

## 1.2 需要域名与 HTTPS 后再做

- 微信 H5 支付域名配置与审核
- 微信 JSAPI 支付授权目录配置
- 异步通知地址（webhook）生产可用
- 生产环境支付联调

## 1.3 可能卡住周期的点

- 如果使用新域名且涉及备案，周期通常不是 7 天内可控（常见 1-4 周）。
- 如果你已有可用备案域名，7 天内完成支付联调可行。

## 2. 两条执行路径（推荐按你的实际选）

### A 路径：已有备案域名（7 天快跑）

Day 1:
- 业务提交支付宝/微信申请
- 技术准备回调地址：
  - `https://<api-domain>/payments/webhooks/wechat`
  - `https://<api-domain>/payments/webhooks/alipay`

Day 2:
- 收集资质参数（`app_id` / `mchid` / 密钥与证书）
- 填写环境变量（仍保持 `PAYMENT_FEATURE_ENABLED=false`）

Day 3:
- 配置微信 H5 支付域名 / JSAPI 授权目录（按产品形态）
- 配置支付宝异步通知地址

Day 4:
- 接入下单接口（微信/支付宝各一条）
- 接入 webhook 验签

Day 5:
- 完成 webhook 幂等（按事件号去重）
- 支付成功后开通订阅权益（以 webhook 为准）

Day 6:
- 沙箱/小额真机联调（成功、失败、超时、重复回调）

Day 7:
- 生产灰度开启（小流量）
- 观察告警与对账

### B 路径：无备案域名（稳妥路径）

Week 1:
- 同步做：申请商户 + 申请域名 + HTTPS 证书 + 备案提交
- 代码先接完，功能保持关闭

Week 2-4:
- 备案完成后再做域名审核、目录配置、生产联调
- 验证通过再启用生产支付

## 3. 角色分工（你可直接发群）

| 角色 | 必交付项 | 截止建议 |
|---|---|---|
| 业务 | `app_id`、`mchid`、开通截图、结算信息确认 | Day 2 |
| 技术后端 | 下单接口、webhook 验签、幂等与权益开通 | Day 5 |
| 技术运维 | 域名、HTTPS、回调公网连通与监控告警 | Day 3 |
| 运营/财务 | 小额实付验收、对账核对 | Day 7 |

## 4. 你现在就可以执行的检查项

- [ ] 业务是否已启动支付宝/微信申请
- [ ] 是否已有可用于支付的备案域名
- [ ] 回调 URL 是否可公网访问且 HTTPS 有效
- [ ] 是否已收齐密钥/证书（不通过聊天工具散发私钥）
- [ ] `GET /payments/readiness` 是否 ready

## 5. 与当前代码的对应关系

- 环境变量模板：`apps/api/.env.example`
- 支付就绪检查：`GET /payments/readiness`
- 回调预留地址：
  - `POST /payments/webhooks/wechat`
  - `POST /payments/webhooks/alipay`

## 6. 官方文档参考（2026-02-28 核对）

- 微信 H5 域名配置：https://pay.wechatpay.cn/doc/v3/merchant/4013287193
- 微信 JSAPI 授权目录：https://pay.wechatpay.cn/doc/v3/merchant/4013287088
- 微信小程序支付快速开始：https://pay.wechatpay.cn/doc/v3/merchant/4015459512
- 微信小微接入前准备：https://pay.wechatpay.cn/doc/v3/partner/4012165177
- 微信小微产品介绍：https://pay.wechatpay.cn/doc/v3/partner/4012165168
- 支付宝接入流程：https://open.alipay.com/develop/accessProcessPage.htm
