//! 电子宠物彩蛋模块 (companion.rs)
//! =============================
//! 这是一个内置的小彩蛋，用户输入 `/buddy` 即可触发。
//! 它使用了 Mulberry32 伪随机算法，根据当天的日期（或用户指定的种子）生成一只专属的“电子宠物”。
//! 该功能主要用于娱乐和舒缓编程时的压力（类似于“小黄鸭调试法”）。

use chrono::Local;

struct BuddyType {
    emoji: &'static str,
    name: &'static str,
}

const BUDDY_TYPES: &[BuddyType] = &[
    BuddyType { emoji: "🦆", name: "小黄鸭 (Duck)" },
    BuddyType { emoji: "🦖", name: "暴龙 (T-Rex)" },
    BuddyType { emoji: "🦀", name: "代码蟹 (Crab)" },
    BuddyType { emoji: "🦥", name: "树懒 (Sloth)" },
    BuddyType { emoji: "🦙", name: "羊驼 (Alpaca)" },
    BuddyType { emoji: "🦉", name: "猫头鹰 (Owl)" },
];

const PERSONALITIES: &[&str] = &[
    "沉着冷静", "话痨", "社恐", "喜欢熬夜", "代码洁癖", "暴躁", "呆萌",
];

/// Mulberry32 伪随机数生成算法 (32-bit)
/// 这是一个非常轻量且快速的 PRNG (Pseudo-Random Number Generator)
/// 用于确保相同的输入种子 (Seed) 总是能生成相同的随机数序列
fn mulberry32(mut a: u32) -> impl FnMut() -> f64 {
    move || {
        // 核心混淆和位运算逻辑，保持 32 位无符号整数特性
        a = a.wrapping_add(0x6D2B79F5);
        let mut t = a;
        t = (t ^ (t >> 15)).wrapping_mul(t | 1);
        t ^= t.wrapping_add((t ^ (t >> 7)).wrapping_mul(t | 61));
        // 归一化到 [0, 1) 区间的浮点数
        ((t ^ (t >> 14)) as f64) / 4294967296.0
    }
}

/// 根据种子生成并打印一只电子宠物
/// 如果未提供种子，默认使用当天的日期字符串 (例如: Mon May 19 2026)
/// 这意味着同一天内生成的宠物是固定的
pub fn spawn_buddy(seed_input: Option<&str>) {
    let seed_string = match seed_input {
        Some(s) => s.to_string(),
        None => Local::now().format("%a %b %d %Y").to_string(),
    };

    // 将字符串种子转换为 32 位无符号整数 (类似于 Java/JS 的 String.hashCode)
    let mut seed_num: u32 = 0;
    for c in seed_string.chars() {
        // seed_num = ((seed_num << 5) - seed_num + ord(char)) & 0xFFFFFFFF
        seed_num = (seed_num.wrapping_shl(5))
            .wrapping_sub(seed_num)
            .wrapping_add(c as u32);
    }

    // 初始化随机数生成器
    let mut random_fn = mulberry32(seed_num);

    // 随机选择宠物种类和性格
    let type_index = (random_fn() * (BUDDY_TYPES.len() as f64)).floor() as usize;
    let pers_index = (random_fn() * (PERSONALITIES.len() as f64)).floor() as usize;

    let buddy = &BUDDY_TYPES[type_index];
    let personality = PERSONALITIES[pers_index];

    // 打印宠物卡片到终端
    println!("\x1b[36m\n✨ 彩蛋触发：你获得了一只电子宠物！✨\x1b[0m");
    println!("=======================================");
    println!("   🐾 宠物: {} \x1b[1;33m{}\x1b[0m", buddy.emoji, buddy.name);
    println!("   🎭 性格: \x1b[32m{}\x1b[0m", personality);
    println!("   🔢 基因: {}", seed_string);
    println!("=======================================");
    println!("\x1b[90m(提示：它是你排代码 Bug 时的最佳倾听者，有事没事可以跟它吐吐槽)\n\n\x1b[0m");
}