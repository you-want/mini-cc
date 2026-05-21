#!/bin/bash

# 修复 CommandInterceptor.ts 中的类型错误

echo "修复 CommandInterceptor.ts..."

# 1. 添加 CompanionBones 导入
sed -i '' "s/import { spawnBuddy } from '..\/buddy\/companion';/import { spawnBuddy } from '..\/buddy\/companion';\nimport { CompanionBones } from '..\/buddy\/types';/" src/commands/CommandInterceptor.ts

# 2. 修复 handleBuddyCommand 函数
cat > /tmp/buddy_fix.txt << 'EOF'
function handleBuddyCommand(args: string[]): InterceptResult {
  const seed = args.length > 0 ? args[0] : (process.env.USER || 'default_user');
  const buddy: CompanionBones = spawnBuddy(seed);
  
  const speciesName = buddy.species === 'duck' ? '小黄鸭' : '小章鱼';
  const emoji = buddy.species === 'duck' ? '🦆' : '🐙';
  
  const output = chalk.cyan.bold('\n🐾 你的数字伙伴\n\n') +
    `${emoji} ${chalk.yellow(speciesName)}\n` +
    `稀有度: ${chalk.magenta(buddy.rarity)}\n` +
    `闪光: ${buddy.shiny ? chalk.yellow('✨ 是') : chalk.gray('否')}\n` +
    `属性: DEBUGGING ${buddy.stats.DEBUGGING} | PATIENCE ${buddy.stats.PATIENCE} | CHAOS ${buddy.stats.CHAOS}\n\n` +
    chalk.gray('你的伙伴会陪伴你一起编程！');
  
  return {
    intercepted: true,
    output,
  };
}
EOF

echo "修复 ProviderCommand.ts..."

# 3. 修复 ProviderCommand.ts 中的 modelName 访问
sed -i '' 's/newProvider\.modelName || '\''default'\''/modelDisplayName/g' src/commands/ProviderCommand.ts

echo "编译项目..."
npm run build

echo "修复完成！"
