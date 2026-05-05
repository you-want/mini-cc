package schema

// Role 定义了 LLM 对话中角色的类型（如：用户、助手、系统、工具）
type Role string

const (
	RoleUser      Role = "user"      // 用户输入
	RoleAssistant Role = "assistant" // 大模型回复
	RoleSystem    Role = "system"    // 系统提示词（System Prompt）
	RoleTool      Role = "tool"      // 工具执行结果的返回
)

// Message 是大模型对话上下文中的基础消息单元
type Message struct {
	Role        Role         `json:"role"`
	Content     string       `json:"content,omitempty"`      // 文本内容
	ToolCalls   []ToolCall   `json:"tool_calls,omitempty"`   // 如果模型决定调用工具，会在这里包含工具调用指令
	ToolCallID  string       `json:"tool_call_id,omitempty"` // 当 Role 为 tool 时，用于关联这是对哪一个 ToolCall 的回应
	ToolResults []ToolResult `json:"-"`                      // （内部字段，不参与直接 JSON 序列化）临时存放多工具执行结果
}

// ToolCall 代表大模型发出的一次工具调用请求
type ToolCall struct {
	ID       string       `json:"id"`   // 唯一标识符
	Type     string       `json:"type"` // 固定为 "function"
	Function ToolFunction `json:"function"`
}

// ToolFunction 包含大模型要调用的具体函数名和参数
type ToolFunction struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"` // 注意：参数是大模型输出的 JSON 字符串
}

// ToolSchema 是告诉大模型“你有哪些工具可用”的结构定义
type ToolSchema struct {
	Type     string             `json:"type"` // 固定为 "function"
	Function ToolFunctionSchema `json:"function"`
}

// ToolFunctionSchema 详细描述了某个工具的名字、用途和参数格式（符合 JSON Schema 规范）
type ToolFunctionSchema struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
}

// ToolResult 存放我们在本地执行完工具后的结果
type ToolResult struct {
	ToolCallID string `json:"tool_call_id"` // 关联的请求 ID
	Result     string `json:"result"`       // 终端输出或文件读取内容
	IsError    bool   `json:"is_error"`     // 是否执行失败（比如命令不存在）
}
