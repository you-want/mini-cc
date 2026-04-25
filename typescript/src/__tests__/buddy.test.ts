/// <reference types="jest" />
import { generateBones, mulberry32 } from '../buddy/companion';
import { duck, octopus } from '../buddy/types';

describe('Buddy System (电子宠物系统)', () => {
  it('should generate consistent bones for the same userId (相同的用户ID应生成完全相同的宠物骨架)', () => {
    const bones1 = generateBones('user_123');
    const bones2 = generateBones('user_123');
    expect(bones1).toEqual(bones2); // 验证防作弊的哈希生成机制
  });

  it('should generate different bones for different userIds (不同的用户ID应生成不同的宠物骨架)', () => {
    const bones1 = generateBones('user_123');
    const bones2 = generateBones('user_456');
    expect(bones1).not.toEqual(bones2);
  });

  it('mulberry32 should generate deterministic numbers (伪随机数算法应当是确定性的)', () => {
    const rng = mulberry32(12345); // 使用固定种子
    const val1 = rng();
    const val2 = rng();
    
    const rng2 = mulberry32(12345); // 使用相同的种子重新初始化
    expect(rng2()).toBe(val1); // 第一次生成的随机数必须一致
    expect(rng2()).toBe(val2); // 第二次生成的随机数也必须一致
  });

  it('species should be encrypted correctly (物种名称应被正确动态解密拼接)', () => {
    expect(duck).toBe('duck');
    expect(octopus).toBe('octopus');
  });

  it('should generate valid stats based on rarity (应根据稀有度生成有效的五维属性)', () => {
    const bones = generateBones('test_user');
    expect(bones.rarity).toBeDefined(); // 必须有稀有度
    // 稀有度必须是五种之一
    expect(['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary']).toContain(bones.rarity);
    
    // 必须包含全部的五维属性
    expect(bones.stats).toHaveProperty('DEBUGGING');
    expect(bones.stats).toHaveProperty('PATIENCE');
    expect(bones.stats).toHaveProperty('CHAOS');
    expect(bones.stats).toHaveProperty('WISDOM');
    expect(bones.stats).toHaveProperty('SNARK');
  });
});
