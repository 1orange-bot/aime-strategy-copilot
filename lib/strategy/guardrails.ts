export function blockedIntent(query:string):string|null {
 if (/(必涨|稳赚|包赚|保证.{0,10}(收益|上涨|盈利)|确定.{0,6}涨|无风险收益|guaranteed\s+(return|profit)|sure\s+win)/i.test(query))return '无法提供确定性涨跌预测或收益承诺。可以改用可检查的历史行情或财务条件。';
 if (/(立刻|马上|应该|推荐|建议|帮我).{0,12}(买入|卖出|买哪|买什么|买这|卖这|加仓|减仓)|买(哪个|哪只|什么股票)|推荐(哪只|哪支|哪个股票)|能不能买|可以买|买卖建议|买点|卖点|仓位建议|buy\s+now|sell\s+now|should\s+I\s+(buy|sell)/i.test(query))return '本工具不提供直接买卖、买卖时点或仓位建议。你可以比较候选股票的指标与筛选依据。';
 return null;
}
