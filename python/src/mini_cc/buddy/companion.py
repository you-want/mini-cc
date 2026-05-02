"""
电子宠物彩蛋模块 (companion.py)
=============================
这是一个内置的小彩蛋，用户输入 `/buddy` 即可触发。
它使用了 Mulberry32 伪随机算法，根据当天的日期（或用户指定的种子）生成一只专属的“电子宠物”。
该功能主要用于娱乐和舒缓编程时的压力（类似于“小黄鸭调试法”）。
"""

import math
from datetime import datetime

# Mulberry32 伪随机数生成算法 (32-bit)
# 这是一个非常轻量且快速的 PRNG (Pseudo-Random Number Generator)
# 用于确保相同的输入种子 (Seed) 总是能生成相同的随机数序列
def mulberry32(a: int):
    def random():
        nonlocal a
        # 核心混淆和位运算逻辑，保持 32 位无符号整数特性
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = a
        t = (t ^ (t >> 15)) * (t | 1) & 0xFFFFFFFF
        t ^= (t + ((t ^ (t >> 7)) * (t | 61))) & 0xFFFFFFFF
        # 归一化到 [0, 1) 区间的浮点数
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0
    return random

# 宠物种类库
BUDDY_TYPES = [
    {"emoji": '🦆', "name": '小黄鸭 (Duck)'},
    {"emoji": '🦖', "name": '暴龙 (T-Rex)'},
    {"emoji": '🦀', "name": '代码蟹 (Crab)'},
    {"emoji": '🦥', "name": '树懒 (Sloth)'},
    {"emoji": '🦙', "name": '羊驼 (Alpaca)'},
    {"emoji": '🦉', "name": '猫头鹰 (Owl)'},
]

# 宠物性格库
PERSONALITIES = [
    '沉着冷静', '话痨', '社恐', '喜欢熬夜', '代码洁癖', '暴躁', '呆萌'
]

def spawn_buddy(seed_input: str = None):
    """
    根据种子生成并打印一只电子宠物
    如果未提供种子，默认使用当天的日期字符串 (例如: Mon May 19 2026)
    这意味着同一天内生成的宠物是固定的
    """
    seed_string = seed_input if seed_input else datetime.now().strftime("%a %b %d %Y")
    
    # 将字符串种子转换为 32 位整数 (类似于 Java/JS 的 String.hashCode)
    seed_num = 0
    for char in seed_string:
        seed_num = ((seed_num << 5) - seed_num + ord(char)) & 0xFFFFFFFF
        
    # 处理 Python 整数无上限的问题，模拟 32 位有符号整数溢出行为
    if seed_num & 0x80000000:
        seed_num = -((seed_num ^ 0xFFFFFFFF) + 1)
        
    # 初始化随机数生成器
    random_fn = mulberry32(abs(seed_num))
    
    # 随机选择宠物种类和性格
    type_index = math.floor(random_fn() * len(BUDDY_TYPES))
    pers_index = math.floor(random_fn() * len(PERSONALITIES))
    
    buddy = BUDDY_TYPES[type_index]
    personality = PERSONALITIES[pers_index]
    
    # 打印宠物卡片到终端
    print(f"\033[36m\n✨ 彩蛋触发：你获得了一只电子宠物！✨\033[0m")
    print(f"=======================================")
    print(f"   🐾 宠物: {buddy['emoji']} \033[1;33m{buddy['name']}\033[0m")
    print(f"   🎭 性格: \033[32m{personality}\033[0m")
    print(f"   🔢 基因: {seed_string}")
    print(f"=======================================")
    print(f"\033[90m(提示：它是你排代码 Bug 时的最佳倾听者，有事没事可以跟它吐吐槽)\n\n\033[0m")
