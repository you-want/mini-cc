export class EasterEggInterceptor {
  /**
   * 拦截并处理 Fast-path 彩蛋命令
   * @param args 命令行参数
   * @returns 是否已被拦截处理
   */
  static intercept(args: string[]): boolean {
    if (args.length === 0) return false;
    const cmd = args[0];

    if (cmd === '/buddy') {
      const buddyModule = require('../buddy/companion');
      const seed = args.length > 1 ? args[1] : (process.env.USER || 'default_user');
      const bones = buddyModule.generateBones(seed);
      const speciesName = bones.species === 'duck' ? '🦆 小黄鸭 (Duck)' : '🐙 小章鱼 (Octopus)';
      const shinyText = bones.shiny ? '✨ 是 (Shiny!)' : '否';
      const statsText = Object.entries(bones.stats).map(([k, v]) => `${k}: ${v}`).join(' | ');
      
      console.log(`🐾 宠物伴侣: ${speciesName}`);
      console.log(`🎭 稀有度: ${bones.rarity}`);
      console.log(`✨ 闪光: ${shinyText}`);
      console.log(`📊 属性: ${statsText}`);
      
      process.exit(0);
    }

    if (cmd === '/voice') {
      const { triggerVoiceMode } = require('./voice');
      triggerVoiceMode().then(() => {
        // voice mode 触发后不直接 exit，保持异步进行
      });
      return true; // 返回 true 拦截后续主流程
    }

    return false;
  }
}
