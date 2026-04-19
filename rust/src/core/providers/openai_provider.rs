use super::{ChatResponse, LLMProvider, OnTextResponseFn, ToolCall, ToolResult};
use crate::tools::get_all_tools;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use futures_util::StreamExt;
use eventsource_stream::Eventsource;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Message {
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<Value>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
}

pub struct OpenAIProvider {
    client: Client,
    api_key: String,
    base_url: String,
    model: String,
    messages: Vec<Message>,
}

impl OpenAIProvider {
    pub fn new(api_key: String, base_url: String, model: String) -> Self {
        let system_prompt = "你是一个名为 mini-cc 的高级 AI 编程助手。你拥有读取文件、写入文件和执行终端命令的权限。你的目标是帮助用户解决复杂的软件工程问题。\n\n【默认输出目录】\n如果用户要求你创建、生成、输出代码或文件，但没有明确指明输出目录，请务必默认将这些内容输出到相对于当前工作目录的上一级目录下的 `test_file` 文件夹中（即 `../test_file` 目录下）。";

        let messages = vec![Message {
            role: "system".to_string(),
            content: system_prompt.to_string(),
            tool_calls: None,
            tool_call_id: None,
        }];

        let base_url = if base_url.is_empty() {
            "https://api.openai.com/v1".to_string()
        } else {
            base_url
        };

        OpenAIProvider {
            client: Client::new(),
            api_key,
            base_url,
            model,
            messages,
        }
    }

    fn get_tools(&self) -> Vec<Value> {
        let mut tools = Vec::new();
        for t in get_all_tools() {
            tools.push(json!({
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": t.input_schema
                }
            }));
        }
        tools
    }

    async fn create_message(
        &mut self,
        on_text_response: &OnTextResponseFn,
    ) -> Result<ChatResponse, String> {
        let body = json!({
            "model": self.model,
            "messages": self.messages,
            "tools": self.get_tools(),
            "temperature": 0.2,
            "stream": true,
            "extra_body": {
                "enable_thinking": true
            }
        });

        let url = format!("{}/chat/completions", self.base_url);
        let res = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
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
        let mut is_content_started = false;

        let mut tool_calls_map: HashMap<usize, Value> = HashMap::new();

        while let Some(event_result) = stream.next().await {
            match event_result {
                Ok(event) => {
                    let data = event.data;
                    if data == "[DONE]" {
                        break;
                    }

                    if let Ok(json_val) = serde_json::from_str::<Value>(&data) {
                        if let Some(choices) = json_val.get("choices").and_then(|c| c.as_array()) {
                            if let Some(choice) = choices.get(0) {
                                if let Some(delta) = choice.get("delta") {
                                    if let Some(content) = delta.get("content").and_then(|c| c.as_str()) {
                                        if !is_content_started && !content.is_empty() {
                                            on_text_response("\n==================== 完整回复 ====================\n".to_string(), false);
                                            is_content_started = true;
                                        }
                                        full_content.push_str(content);
                                        on_text_response(content.to_string(), false);
                                    }

                                    if let Some(tool_calls) = delta.get("tool_calls").and_then(|tc| tc.as_array()) {
                                        for tc in tool_calls {
                                            if let Some(index) = tc.get("index").and_then(|i| i.as_u64()) {
                                                let idx = index as usize;
                                                let existing = tool_calls_map.entry(idx).or_insert_with(|| {
                                                    json!({
                                                        "id": tc.get("id").unwrap_or(&json!("")),
                                                        "type": "function",
                                                        "function": {
                                                            "name": "",
                                                            "arguments": ""
                                                        }
                                                    })
                                                });

                                                if let Some(id) = tc.get("id").and_then(|i| i.as_str()) {
                                                    existing["id"] = json!(id);
                                                }

                                                if let Some(func) = tc.get("function") {
                                                    if let Some(name) = func.get("name").and_then(|n| n.as_str()) {
                                                        let current_name = existing["function"]["name"].as_str().unwrap_or("");
                                                        existing["function"]["name"] = json!(format!("{}{}", current_name, name));
                                                    }
                                                    if let Some(args) = func.get("arguments").and_then(|a| a.as_str()) {
                                                        let current_args = existing["function"]["arguments"].as_str().unwrap_or("");
                                                        existing["function"]["arguments"] = json!(format!("{}{}", current_args, args));
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                Err(e) => return Err(format!("读取流时出错: {}", e)),
            }
        }

        on_text_response("\n".to_string(), false);

        let mut final_tool_calls = Vec::new();
        let mut msg_tool_calls = Vec::new();

        for (_, tc) in tool_calls_map.iter() {
            let id = tc.get("id").and_then(|i| i.as_str()).unwrap_or("").to_string();
            let name = tc["function"]["name"].as_str().unwrap_or("").to_string();
            let raw_args = tc["function"]["arguments"].as_str().unwrap_or("{}");

            let args = match serde_json::from_str::<Value>(raw_args) {
                Ok(a) => a,
                Err(_) => {
                    let fixed = raw_args.replace('\n', "\\n").replace('\r', "\\r").replace('\t', "\\t");
                    match serde_json::from_str::<Value>(&fixed) {
                        Ok(a) => a,
                        Err(_) => {
                            println!("\n[OpenAIProvider] 工具参数 JSON 解析失败。原始参数:\n{}", raw_args);
                            json!({
                                "_parse_error": true,
                                "_raw_arguments": raw_args
                            })
                        }
                    }
                }
            };

            final_tool_calls.push(ToolCall {
                id: id.clone(),
                name: name.clone(),
                args: args.clone(),
            });

            msg_tool_calls.push(tc.clone());
        }

        let mut assistant_msg = Message {
            role: "assistant".to_string(),
            content: full_content.clone(),
            tool_calls: None,
            tool_call_id: None,
        };

        if !msg_tool_calls.is_empty() {
            assistant_msg.tool_calls = Some(msg_tool_calls);
        }

        self.messages.push(assistant_msg);

        Ok(ChatResponse {
            text: full_content,
            tool_calls: final_tool_calls,
        })
    }
}

impl LLMProvider for OpenAIProvider {
    fn send_message<'a>(
        &'a mut self,
        user_message: String,
        on_text_response: &'a OnTextResponseFn,
    ) -> Pin<Box<dyn Future<Output = Result<ChatResponse, String>> + Send + 'a>> {
        Box::pin(async move {
            self.messages.push(Message {
                role: "user".to_string(),
                content: user_message,
                tool_calls: None,
                tool_call_id: None,
            });
            self.create_message(on_text_response).await
        })
    }

    fn send_tool_results<'a>(
        &'a mut self,
        results: Vec<ToolResult>,
        on_text_response: &'a OnTextResponseFn,
    ) -> Pin<Box<dyn Future<Output = Result<ChatResponse, String>> + Send + 'a>> {
        Box::pin(async move {
            for r in results {
                self.messages.push(Message {
                    role: "tool".to_string(),
                    content: r.result,
                    tool_calls: None,
                    tool_call_id: Some(r.id),
                });
            }
            self.create_message(on_text_response).await
        })
    }
}