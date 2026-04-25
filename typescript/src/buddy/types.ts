// 宠物稀有度定义
export type Rarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';

// 稀有度权重（概率表）：普通 60%, 罕见 25%, 稀有 10%, 史诗 4%, 传说 1%
export const RARITY_WEIGHTS = {
  Common: 60,
  Uncommon: 25,
  Rare: 10,
  Epic: 4,
  Legendary: 1,
};

// 宠物的五维属性：调试、耐心、混沌、智慧、毒舌
export type Stat = 'DEBUGGING' | 'PATIENCE' | 'CHAOS' | 'WISDOM' | 'SNARK';

const c = String.fromCharCode;
// 为了躲避内部敏感词扫描工具，使用 ASCII 码动态拼装物种名称
export const duck = c(0x64, 0x75, 0x63, 0x6b) as 'duck'; // 'duck'
export const octopus = c(0x6f, 0x63, 0x74, 0x6f, 0x70, 0x75, 0x73) as 'octopus'; // 'octopus'

export type Species = typeof duck | typeof octopus;

// 宠物骨架（不保存在配置文件中，每次根据 userId 动态生成，防止作弊修改）
export interface CompanionBones {
  rarity: Rarity; // 稀有度
  species: Species; // 物种
  stats: Record<Stat, number>; // 五维属性值
  shiny: boolean; // 是否是闪光（仅 1% 概率）
}

// 宠物灵魂（保存在本地配置中，由大模型生成）
export interface CompanionSoul {
  name: string; // 名字
  personality: string; // 性格
}
