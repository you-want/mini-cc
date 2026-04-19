use super::{ChatResponse, LLMProvider, OnTextResponseFn, ToolCall, ToolResult};
use crate::tools::get_all_tools;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::future::Future;
use std::pin::Pin;
use futures_util::StreamExt;
use eventsource_stream::Eventsource;

/// 定义 Anthropic API 的消息格式
/// 与 OpenAI 不同，Anthropic 的 content 可以是一个包含多种类型块 (文本块、工具调用块、工具结果块) 的数组
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AnthropicMessage {
    pub role: String,
    pub content: Vec<Value>,
}

/// Anthropic 模型接口提供商
/// 用于连接 Claude 系列模型，实现流式输出与工具调用
pub struct AnthropicProvider {
    client: Client,
    api_key: String,
    model: String,
    messages: Vec<AnthropicMessage>,
    system_prompt: String,
}

impl AnthropicProvider {
    pub fn new(api_key: String, model: String) -> Self {
        // Anthropic 的 System Prompt 不能混在 messages 数组里，而是要在请求时单独指定
        let system_prompt = "你是一个名为 mini-cc 的高级 AI 编程助手。你拥有读取文件、写入文件和执行终端命令的权限。你的目标是帮助用户解决复杂的软件工程问题。\n\n【默认输出目录】\n如果用户要求你创建、生成、输出代码或文件，但没有明确指明输出目录，请务必默认将这些内容输出到相对于当前工作目录的上一级目录下的 `test_file` 文件夹中（即 `../test_file` 目录下）。".to_string();

        AnthropicProvider {
            client: Client::new(),
            api_key,
            model,
            messages: Vec::new(),
            system_prompt,
        }
    }

    /// 将本地的工具列表转换成 Anthropic 接口所要求的格式
    fn get_tools(&self) -> Vec<Value> {
        let mut tools = Vec::new();
        for t in get_all_tools() {
            tools.push(json!({
                "name": t.name,
                "description": t.description,
                "input_schema": t.input_schema
            }));
        }
        tools
    }

    /// 向 Claude 发起流式请求并处理返回
    /// 手动解析 Server-Sent Events (SSE) 流，拼接文本和工具参数
    async fn create_message(
        &mut self,
        on_text_response: &OnTextResponseFn,
    ) -> Result<ChatResponse, String> {
        let body = json!({
            "model": self.model,
            "max_tokens": 4096,
            "messages": self.messages,
            "tools": self.get_tools(),
            "temperature": 0.2,
            "stream": true,
            "system": self.system_prompt,
        });

        let res = self
            .client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("请求失败: {}", e))?;

        if !res.status().is_success() {
            let status = res.status();
            let text = res.text().await.unwrap_or_default();
            return Err(format!("API 错误 ({}): {}", status, text));
        }

        let mut stream = res.bytes_stream().eventsource();
        let mut full_content = String::new();
        
        let mut current_tool_id = String::new();
        let mut current_tool_name = String::new();
        let mut current_tool_args = String::new();
        
        let mut final_tool_calls = Vec::new();
        let mut assistant_content = Vec::new();

        while let Some(event_result) = stream.next().await {
            match event_result {
                Ok(event) => {
                    let event_type = event.event;
                    let data = event.data;

                    if let Ok(json_val) = serde_json::from_str::<Value>(&data) {
                        if event_type == "content_block_start" {
                            if let Some(block) = json_val.get("content_block") {
                                if block.get("type").and_then(|t| t.as_str()) == Some("tool_use") {
                                    current_tool_id = block.get("id").and_then(|i| i.as_str()).unwrap_or("").to_string();
                                    current_tool_name = block.get("name").and_then(|n| n.as_str()).unwrap_or("").to_string();
                                    current_tool_args = String::new();
                                }
                            }
                        } else if event_type == "content_block_delta" {
                            if let Some(delta) = json_val.get("delta") {
                                if delta.get("type").and_then(|t| t.as_str()) == Some("text_delta") {
                                    if let Some(text) = delta.get("text").and_then(|t| t.as_str()) {
                                        full_content.push_str(text);
                                        on_text_response(text.to_string(), false);
                                    }
                                } else if delta.get("type").and_then(|t| t.as_str()) == Some("input_json_delta") {
                                    if let Some(partial_json) = delta.get("partial_json").and_then(|p| p.as_str()) {
                                        current_tool_args.push_str(partial_json);
                                    }
                                }
                            }
                        } else if event_type == "content_block_stop" {
                            if !current_tool_id.is_empty() {
                                let args = match serde_json::from_str::<Value>(&current_tool_args) {
                                    Ok(a) => a,
                                    Err(_) => {
                                        let fixed = current_tool_args.replace('\n', "\\n").replace('\r', "\\r").replace('\t', "\\t");
                                        serde_json::from_str::<Value>(&fixed).unwrap_or_else(|_| {
                                            json!({
                                                "_parse_error": true,
                                                "_raw_arguments": current_tool_args
                                            })
                                        })
                                    }
                                };
                                
                                final_tool_calls.push(ToolCall {
                                    id: current_tool_id.clone(),
                                    name: current_tool_name.clone(),
                                    args: args.clone(),
                                });
                                
                                assistant_content.push(json!({
                                    "type": "tool_use",
                                    "id": current_tool_id,
                                    "name": current_tool_name,
                                    "input": args
                                }));
                                
                                current_tool_id = String::new();
                            }
                        }
                    }
                }
                Err(e) => return Err(format!("读取流时出错: {}", e)),
            }
        }

        on_text_response("\n".to_string(), false);
        
        // 将普通回复文本记录到上下文中
        if !full_content.is_empty() {
            assistant_content.insert(0, json!({
                "type": "text",
                "text": full_content
            }));
        }
        
        // 将助手的回复添加到历史记录中，用于后续轮次的上下文
        self.messages.push(AnthropicMessage {
            role: "assistant".to_string(),
            content: assistant_content,
        });

        Ok(ChatResponse {
            text: full_content,
            tool_calls: final_tool_calls,
        })
    }
}

impl LLMProvider for AnthropicProvider {
    /// 接收用户输入并触发对话
    fn send_message<'a>(
        &'a mut self,
        user_message: String,
        on_text_response: &'a OnTextResponseFn,
    ) -> Pin<Box<dyn Future<Output = Result<ChatResponse, String>> + Send + 'a>> {
        self.messages.push(AnthropicMessage {
            role: "user".to_string(),
            content: vec![json!({
                "type": "text",
                "text": user_message
            })],
        });

        Box::pin(self.create_message(on_text_response))
    }

    /// 将工具执行结果反馈给 Claude。
    /// 注意：Anthropic 要求 tool_result 必须包装在一个 role="user" 的消息中。
    fn send_tool_results<'a>(
        &'a mut self,
        results: Vec<ToolResult>,
        on_text_response: &'a OnTextResponseFn,
    ) -> Pin<Box<dyn Future<Output = Result<ChatResponse, String>> + Send + 'a>> {
        let mut tool_result_content = Vec::new();
        for r in results {
            tool_result_content.push(json!({
                "type": "tool_result",
                "tool_use_id": r.id,
                "content": r.result,
                "is_error": r.is_error
            }));
        }

        self.messages.push(AnthropicMessage {
            role: "user".to_string(),
            content: tool_result_content,
        });

        Box::pin(self.create_message(on_text_response))
    }
}