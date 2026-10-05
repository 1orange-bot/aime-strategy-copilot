# AIME 策略研究台

同花顺校招「AI 产品经理 · AIME金融智能Agent方向」第三题：自然语言智能选股与策略解释器。

把“经营改善、估值合理、走势相对稳定”转为可检查、可编辑、可执行的条件，并以真实扶摇数据解释通过、排除和待核验结果。条件修改在同一快照上比较影响，策略可保存与重开。

## 产品使用

1. 选择真实数据，选定股票池和财务报告期。
2. 在“新建策略”输入研究需求，解析后核对草案、默认假设与未解决诉求。
3. 采用草案，在编辑区修正条件；确认执行后读取全池真实数据。
4. 查看三个互斥分类和单股证据；修改阈值，检查同快照新增、移出和保留。
5. 保存策略，重开后确认并重新获取数据。也可下载JSON条件。

“修改当前策略”用于自然语言局部修改，其他条件应保留并由用户检查。“构造演示”用于体验异常与交互，只包含匿名DEMO公司，绝不自动替代真实接口结果。

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

DeepSeek只把语言转为待确认JSON，最多一次结构修复。模型无任意代码、任意网络地址或交易工具权限。来源数值、最终状态和解释由数据适配与确定性模板产生。AI Native体现在把可执行策略对象、明确不确定性与数据证据作为核心资产，而不是依靠多个角色重复讨论同一问题。

## 数据来源

- [扶摇管理台](https://fuyao.aicubes.cn/admin/)：同花顺登录后取得Key。
- [同花顺官方Financial-API](https://github.com/HiThink-Tech/Financial-API)：当前成分、估值、财报、日历与历史日K。
- [扶摇接口文档](https://fuyao.aicubes.cn/docs/)；能力以实际可调用结果为准。
- [DeepSeek API文档](https://api-docs.deepseek.com/api/create-chat-completion/)。

财务适配以真实响应中的 `calculate_parent_holder_net_profit_yoy_growth_ratio` 与 `calculate_operating_income_yoy_growth_ratio` 为准，百分数转内部小数。净利润明确采用归母口径。

## 阅读材料

- [实现与职责边界](docs/ARCHITECTURE.md)
- [AI使用与纠错记录](docs/AI_USAGE.md)
- [测试说明与实际结果](docs/TESTING.md)
- [已知边界和未做事项](docs/KNOWN_LIMITATIONS.md)

研究辅助工具，不提供直接买卖或仓位建议、收益承诺或自动交易。无公告日与历史成分数据，不提供历史回测。公开仓库不包含Key、持仓、画像或受限原始金融快照。
