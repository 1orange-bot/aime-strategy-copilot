# AIME 策略研究台

同花顺校招「AI 产品经理 · AIME金融智能Agent方向」笔试第三题：自然语言智能选股与策略解释器。

在线体验地址见随题提交的《提交导航》。公开仓库保留产品与复现材料。

[源码仓库](https://github.com/1orange-bot/aime-strategy-copilot)

把“经营改善、估值合理、走势相对稳定”转为可检查、可编辑、可执行的条件，并以真实扶摇数据解释通过、排除和待核验结果。条件修改在同一快照上比较影响，策略可保存与重开。

## 推荐体验路径

1. 打开在线体验，在“选择研究范围”点击“12只真实样本”，核对可用财务报告期。快速真实体验使用12只固定研究样本，非完整市场；也可切换沪深300。
2. 在“新建策略”输入“经营改善、估值合理、走势相对稳定的公司”，解析后核对草案、默认假设与待澄清诉求。
3. 采用草案，在编辑区核对指标、运算符和阈值，例如将PE上限改为25倍。
4. 确认并执行真实筛选，等待当前研究股票池全部完成；查看入选、排除、待核验及单股原始证据；勾选2至3只股票，打开横向比较，可移除、清空或关闭返回。
5. 修改已有PE阈值，检查同快照新增、移出和保留。新增未获取指标时，必须重新取数；待核验不计作移出。
6. 保存策略并重开，确认后重新执行；在研究范围中切换沪深300或返回12样本，条件与报告期保留，重新获取所选范围数据。也可下载JSON条件。

“修改当前策略”用于自然语言局部修改，其他条件应保留并由用户检查。“构造演示”用于体验异常与交互，包含匿名DEMO公司，作为独立测试数据模式。

## 本地启动

需要 Node.js 22.13+（测试建议Node24）、npm及扶摇/DeepSeek账号。Windows用户应确保Node和npm均在PATH。

```sh
npm ci
```

复制 `.env.example` 为 `.env.local`，填入自己的服务端Key。Cloudflare本地预览还需将同样的变量写入被忽略的 `.dev.vars`。不要提交两个文件。

```sh
npm run dev
```

打开本地启动输出的URL，默认端口5173。真实模式需要Key；手动条件和构造演示不需要数据Key，AI解析需要DeepSeek Key。

|变量|用途|
|---|---|
|DEEPSEEK_API_KEY|服务端模型调用，必填才能使用AI解析|
|DEEPSEEK_MODEL|默认deepseek-flash，以账号实际可用模型为准|
|FUYAO_API_KEY|扶摇真实数据权限，必填才能执行真实筛选|

```sh
npm test
npm run typecheck
npm run lint
npm run build
```

真实接口验证（会消耗提供方额度，日志写入被忽略的work目录）：

```sh
node --use-system-ca --experimental-strip-types --env-file=.env.local scripts/verify-finance.ts
node --use-system-ca --experimental-strip-types --env-file=.env.local scripts/verify-intent.ts
node --use-system-ca --experimental-strip-types --env-file=.env.local scripts/verify-full.ts
```

## 技术选择与AI角色

React + TypeScript + Vinext兼容Next App Router，部署为Cloudflare Workers兼容产物，由Sites托管。Zod校验策略，纯函数进行区间冲突、三态筛选与同快照比较。

DeepSeek只把语言转为待确认JSON，最多一次结构修复。模型无任意代码、任意网络地址或交易工具权限。来源数值、最终状态和解释由数据适配与确定性模板产生。AI Native体现在可执行策略对象、显式不确定性、用户确认和可追溯工具证据共享同一条任务链路。

## 数据来源

- [扶摇管理台](https://fuyao.aicubes.cn/admin/)：同花顺登录后取得Key。
- [同花顺官方Financial-API](https://github.com/HiThink-Tech/Financial-API)：当前成分、估值、财报、日历与历史日K。
- [扶摇接口文档](https://fuyao.aicubes.cn/docs/)；能力以实际可调用结果为准。
- [DeepSeek API文档](https://api-docs.deepseek.com/api/create-chat-completion/)。

财务适配以真实响应中的 `calculate_parent_holder_net_profit_yoy_growth_ratio` 与 `calculate_operating_income_yoy_growth_ratio` 为准，百分数转内部小数。净利润明确采用归母口径。

## 候选人的审查与产品决策

候选人提出报告期可用性、旧快照误解释与提交材料问题，确定P0/P1范围；随后指出样本入口缺少退出路径，要求修订范围去返，并允许开展P2。本版复用既有证据实现股票横向比较。问题、优先级、实施与验收对应关系记录在AI_USAGE中。

## 阅读材料

正式提交材料按题目组织为产品方案与关键决策、AI使用与验证记录、测试说明三册。提交导航将Web、源码及README、AI记录、测试说明逐项对应；源码包保留可复现测试与接口探针。

- [产品问题、方案推导与关键决策](docs/PRODUCT_DECISIONS.md)
- [实现与职责边界](docs/ARCHITECTURE.md)
- [AI使用与纠错记录](docs/AI_USAGE.md)
- [测试说明与实际结果](docs/TESTING.md)
- [支持范围与数据口径](docs/KNOWN_LIMITATIONS.md)

研究辅助工具，不提供直接买卖或仓位建议、收益承诺或自动交易。无公告日与历史成分数据，不提供历史回测。公开仓库不包含Key、持仓、画像或受限原始金融快照。
