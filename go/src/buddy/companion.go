package buddy

import (
	"fmt"
	"math"
	"time"
)

// mulberry32 算法，根据 seed 生成可预测的伪随机数
func mulberry32(a uint32) func() float64 {
	return func() float64 {
		a += 0x6D2B79F5
		t := a
		t = (t ^ (t >> 15)) * (t | 1)
		t ^= t + (t^(t>>7))*(t|61)
		res := (t ^ (t >> 14))
		return float64(res) / 4294967296.0
	}
}

// 简单的宠物类型库
var BUDDY_TYPES = []struct {
	emoji string
	name  string
}{
	{"🦆", "小黄鸭 (Duck)"},
	{"🦖", "暴龙 (T-Rex)"},
	{"🦀", "代码蟹 (Crab)"},
	{"🦥", "树懒 (Sloth)"},
	{"🦙", "羊驼 (Alpaca)"},
	{"🦉", "猫头鹰 (Owl)"},
}

var PERSONALITIES = []string{
	"沉着冷静", "话痨", "社恐", "喜欢熬夜", "代码洁癖", "暴躁", "呆萌",
}

// SpawnBuddy 生成电子宠物彩蛋
func SpawnBuddy(seedInput string) {
	// 用当前日期或输入字符串当种子，实现“每天领养一只不同的宠物”
	seedString := seedInput
	if seedString == "" {
		seedString = time.Now().Format("2006-01-02")
	}

	var seedNum int32 = 0
	for i := 0; i < len(seedString); i++ {
		seedNum = (seedNum << 5) - seedNum + int32(seedString[i])
	}

	random := mulberry32(uint32(math.Abs(float64(seedNum))))

	// 随机挑选宠物种类和性格
	typeIndex := int(math.Floor(random() * float64(len(BUDDY_TYPES))))
	persIndex := int(math.Floor(random() * float64(len(PERSONALITIES))))

	buddy := BUDDY_TYPES[typeIndex]
	personality := PERSONALITIES[persIndex]

	fmt.Printf("\033[36m\n✨ 彩蛋触发：你获得了一只电子宠物！✨\033[0m\n")
	fmt.Println("=======================================")
	fmt.Printf("   🐾 宠物: %s \033[1;33m%s\033[0m\n", buddy.emoji, buddy.name)
	fmt.Printf("   🎭 性格: \033[32m%s\033[0m\n", personality)
	fmt.Printf("   🔢 基因: %s\n", seedString)
	fmt.Println("=======================================")
	fmt.Printf("\033[90m(提示：它是你排代码 Bug 时的最佳倾听者，有事没事可以跟它吐吐槽)\n\n\033[0m")
}
