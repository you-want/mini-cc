import chalk from 'chalk';
import { Rarity, RARITY_WEIGHTS, Stat, Species, duck, octopus, CompanionBones, CompanionSoul } from './types';

// Mulberry32 — 极其轻量的种子伪随机数生成器 (PRNG)，足够用来抽鸭子了
// 保证只要种子(seed)不变，生成的随机数序列完全一致
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 简单的字符串哈希函数，用于将用户ID和盐值转换为数字种子
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为 32位 整数
  }
  return hash >>> 0;
}

// 实际上持久化在配置中的只有“灵魂(Soul)”。
// “骨架(Bones)”在每次读取时通过 hash(userId) 重新生成...
// 这样玩家就没法通过修改本地配置文件来刷出一个传说级宠物了。
export function generateBones(userId: string): CompanionBones {
  const SALT = "buddy_salt"; // 盐值，增加随机性
  const seed = hashString(userId + SALT);
  const rng = mulberry32(seed);

  // 基于权重概率表决定宠物的稀有度
  const rand = rng() * 100;
  let sum = 0;
  let rarity: Rarity = 'Common';
  for (const [r, weight] of Object.entries(RARITY_WEIGHTS)) {
    sum += weight;
    if (rand < sum) {
      rarity = r as Rarity;
      break;
    }
  }

  // 决定宠物物种 (从鸭子和章鱼中随机)
  const speciesList: Species[] = [duck, octopus];
  const species = speciesList[Math.floor(rng() * speciesList.length)];

  // 1% 的极小概率触发闪光(shiny)
  const shiny = rng() < 0.01;

  // 生成五维属性，必定有一个巅峰属性(peak)和一个拉胯属性(weak)
  const statsList: Stat[] = ['DEBUGGING', 'PATIENCE', 'CHAOS', 'WISDOM', 'SNARK'];
  const stats = {} as Record<Stat, number>;
  
  // 根据稀有度设定属性的随机基础区间
  let baseMin = 10;
  let baseMax = 30;
  if (rarity === 'Uncommon') { baseMin = 20; baseMax = 40; }
  else if (rarity === 'Rare') { baseMin = 30; baseMax = 50; }
  else if (rarity === 'Epic') { baseMin = 40; baseMax = 70; }
  else if (rarity === 'Legendary') { baseMin = 60; baseMax = 90; }

  // 随机挑选一个巅峰属性和一个拉胯属性，确保两者不重复
  const peakIndex = Math.floor(rng() * statsList.length);
  let weakIndex = Math.floor(rng() * statsList.length);
  while (weakIndex === peakIndex) {
    weakIndex = Math.floor(rng() * statsList.length);
  }

  // 遍历并计算每一项属性的具体数值
  for (let i = 0; i < statsList.length; i++) {
    const stat = statsList[i];
    let value = Math.floor(rng() * (baseMax - baseMin + 1)) + baseMin;
    
    if (i === peakIndex) {
      value = Math.min(100, value + 20); // 巅峰属性额外加 20，最高 100
    } else if (i === weakIndex) {
      value = Math.max(1, value - 20); // 拉胯属性额外扣 20，最低 1
    }
    
    stats[stat] = value;
  }

  return { rarity, species, stats, shiny };
}

/**
 * 【伙伴系统】
 * 用于模拟一个简单的交互助手，在用户遇到错误或者卡住时主动给予反馈。
 * 类似于 Claude Code 里的伴随小精灵（比如提供快速补救措施、或者缓解焦虑的提示）。
 *
 * @param event 触发伴随系统的事件名称
 * @param context 当前上下文数据
 */
export function spawnBuddy(event: string, context: any = {}) {
  console.log(chalk.magenta(`[Buddy] 看起来你触发了 ${event} 事件！有什么我可以帮忙的吗？`));
  if (context.error) {
    console.log(chalk.gray(`[Buddy 提示] 我注意到出现了一个错误: ${context.error.message}`));
    console.log(chalk.gray(`[Buddy 建议] 要不要尝试使用 'fix it' 命令让我帮你排查一下？`));
  }
}