use crate::core::providers::{LLMProvider, OnTextResponseFn, ToolCall, ToolResult};
use crate::tools::get_all_tools;

pub struct Agent {
    provider: Box<dyn LLMProvider>,
}

impl Agent {
    pub fn new(provider: Box<dyn LLMProvider>) -> Self {
        Agent { provider }
    }

    async fn handle_tool_calls(&self, tool_calls: Vec<ToolCall>) -> Vec<ToolResult> {
        let mut results = Vec::new();

        for call in tool_calls {
            let id = call.id;
            let name = call.name;
            let args = call.args;

            if let Some(err) = args.get("_parse_error") {
                if err.as_bool().unwrap_or(false) {
                    let raw = args.get("_raw_arguments").and_then(|v| v.as_str()).unwrap_or("");
                    results.push(ToolResult {
                        id,
                        name: name.clone(),
                        result: format!("[Agent 内部错误] 你输出的工具参数 JSON 格式不合法，无法解析。\n你输出的原始参数为:\n{}", raw),
                        is_error: true,
                    });
                    continue;
                }
            }

            let tools = get_all_tools();
            let tool = tools.into_iter().find(|t| t.name == name);

            match tool {
                Some(t) => {
                    println!("\x1b[36m▶ [Agent] 正在调用工具: {} ...\x1b[0m", name);
                    match (t.execute)(args).await {
                        Ok(mut result) => {
                            println!("\x1b[32m✔ [Agent] 工具 {} 执行完毕。\x1b[0m", name);
                            if result.len() > 8000 {
                                println!("\n[上下文瘦身] 工具 {} 返回结果过长 ({} 字符)，已触发截断。", name, result.len());
                                result = format!("{}\n\n...[由于内容过长，已被截断]...", &result[0..8000]);
                            }
                            results.push(ToolResult {
                                id,
                                name,
                                result,
                                is_error: false,
                            });
                        }
                        Err(e) => {
                            results.push(ToolResult {
                                id,
                                name: name.clone(),
                                result: format!("执行工具 {} 时出错: {}", name, e),
                                is_error: true,
                            });
                        }
                    }
                }
                None => {
                    println!("\x1b[31m[Agent] 未知工具: {}\x1b[0m", name);
                    results.push(ToolResult {
                        id,
                        name: name.clone(),
                        result: format!("未知的工具调用: {}", name),
                        is_error: true,
                    });
                }
            }
        }

        results
    }

    pub async fn chat(&mut self, user_message: String, on_text_response: OnTextResponseFn) {
        match self.provider.send_message(user_message, &on_text_response).await {
            Ok(mut response) => {
                let mut loop_count = 0;
                let max_loops = 5;

                while !response.tool_calls.is_empty() {
                    loop_count += 1;
                    if loop_count > max_loops {
                        println!("\n\x1b[33m[Agent] 工具调用循环次数过多 ({})，为防止无限循环，已强制终止。\x1b[0m", loop_count);
                        break;
                    }

                    println!("\n\x1b[33m[Agent] 收到大模型指令，准备执行 {} 个工具调用... (第 {} 轮)\x1b[0m", response.tool_calls.len(), loop_count);
                    let tool_results = self.handle_tool_calls(response.tool_calls).await;

                    println!("\n\x1b[33m[Agent] 工具执行完毕，正在将结果发送回大模型，请稍候...\x1b[0m\n");
                    match self.provider.send_tool_results(tool_results, &on_text_response).await {
                        Ok(res) => response = res,
                        Err(e) => {
                            println!("\n[Agent 报错] {}", e);
                            break;
                        }
                    }
                }
            }
            Err(e) => println!("\n[Agent 报错] {}", e),
        }
    }
}