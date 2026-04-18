/**
 * 电子宠物 (Buddy) 彩蛋系统
 * 
 * 根据文档 08-buddy-easter-egg 的分析实现。
 * 包含 Mulberry32 PRNG 随机生成宠物和属性的机制。
 */
import chalk from 'chalk';

// Mulberry32 算法，根据 seed 生成可预测的伪随机数
function mulberry32(a: number) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

// 简单的宠物类型库
const BUDDY_TYPES = [
  { emoji: '🦆', name: '小黄鸭 (Duck)' },
  { emoji: '🦖', name: '暴龙 (T-Rex)' },
  { emoji: '🦀', name: '代码蟹 (Crab)' },
  { emoji: '🦥', name: '树懒 (Sloth)' },
  { emoji: '🦙', name: '羊驼 (Alpaca)' },
  { emoji: '🦉', name: '猫头鹰 (Owl)' },
];

const PERSONALITIES = [
  '沉着冷静', '话痨', '社恐', '喜欢熬夜', '代码洁癖', '暴躁', '呆萌'
];

export function spawnBuddy(seedInput?: string) {
  // 用当前日期或输入字符串当种子，实现“每天领养一只不同的宠物”
  const seedString = seedInput || new Date().toDateString();
  let seedNum = 0;
  for (let i = 0; i < seedString.length; i++) {
    seedNum = (seedNum << 5) - seedNum + seedString.charCodeAt(i);
  }

  const random = mulberry32(Math.abs(seedNum));

  // 随机挑选宠物种类和性格
  const typeIndex = Math.floor(random() * BUDDY_TYPES.length);
  const persIndex = Math.floor(random() * PERSONALITIES.length);
  
  const buddy = BUDDY_TYPES[typeIndex];
  const personality = PERSONALITIES[persIndex];

  console.log(chalk.cyan(`\n✨ 彩蛋触发：你获得了一只电子宠物！✨`));
  console.log(`=======================================`);
  console.log(`   🐾 宠物: ${buddy.emoji} ${chalk.bold.yellow(buddy.name)}`);
  console.log(`   🎭 性格: ${chalk.green(personality)}`);
  console.log(`   🔢 基因: ${seedString}`);
  console.log(`=======================================\n`);
  console.log(chalk.gray(`(提示：它是你排代码 Bug 时的最佳倾听者，有事没事可以跟它吐吐槽)\n`));
}