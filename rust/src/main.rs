use dotenv::dotenv;
use minicc::core::agent::Agent;
use minicc::core::providers::openai_provider::OpenAIProvider;
use minicc::core::providers::anthropic_provider::AnthropicProvider;
use minicc::core::providers::LLMProvider;
use minicc::buddy::companion::spawn_buddy;
use std::env;
use std::io::{self, Write};
use tokio;

#[tokio::main]
async fn main() {
    // 加载 .env 文件中的环境变量
    dotenv().ok();

    let args: Vec<String> = env::args().collect();
    if args.len() == 2 && (args[1] == "--version" || args[1] == "-v") {
        println!("mini-cc rust v1.0.0");
        return;
    }

    // 获取并解析环境变量
    let provider_name = env::var("PROVIDER").unwrap_or_else(|_| "openai".to_string());

    let openai_api_key = env::var("OPENAI_API_KEY").unwrap_or_default();
    let anthropic_api_key = env::var("ANTHROPIC_API_KEY").unwrap_or_default();
    let base_url = env::var("OPENAI_BASE_URL").unwrap_or_default();
    let model = env::var("MODEL_NAME").unwrap_or_else(|_| "qwen3.6-plus".to_string());

    // 根据配置初始化相应的 LLM Provider
    let provider: Box<dyn LLMProvider> = if provider_name.to_lowercase() == "anthropic" || (!anthropic_api_key.is_empty() && model.contains("claude")) {
        Box::new(AnthropicProvider::new(anthropic_api_key.clone(), model.clone()))
    } else if !openai_api_key.is_empty() {
        Box::new(OpenAIProvider::new(openai_api_key.clone(), base_url.clone(), model.clone()))
    } else {
        println!("\x1b[31m错误：请在 .env 文件中设置 OPENAI_API_KEY 或 ANTHROPIC_API_KEY\x1b[0m");
        return;
    };

    println!("\x1b[36m============== mini-cc (Rust) ==============\x1b[0m");
    println!("已加载模型: \x1b[32m{}\x1b[0m", model);
    
    // 实例化 Agent
    let mut agent = Agent::new(provider);

    println!("\x1b[1;34m\n=== 欢迎使用 mini-cc (Rust) ===\n\x1b[0m");
        println!("\x1b[90m输入您的需求，我将为您编写代码或执行系统操作。\x1b[0m");
        println!("\x1b[90m键入 \"exit\" 或 \"quit\" 退出程序。\n\x1b[0m");

        // REPL (Read-Eval-Print Loop) 主循环
        loop {
            print!("\x1b[36mmini-cc> \x1b[0m");
            io::stdout().flush().unwrap();

            let mut user_input = String::new();
            // 读取用户输入
            if io::stdin().read_line(&mut user_input).is_err() {
                println!("\x1b[32m\n再见！\x1b[0m");
                break;
            }

            let user_input = user_input.trim();
            if user_input.is_empty() {
                continue;
            }

            let lower_input = user_input.to_lowercase();
            // 处理退出命令
            if lower_input == "exit" || lower_input == "quit" {
                println!("\x1b[32m再见！\x1b[0m");
                break;
            }

            // 处理帮助命令
            if lower_input == "/help" {
                println!("\x1b[36m\n=== 可用命令 ===\x1b[0m");
                println!("\x1b[90m  /help     - 显示此帮助信息\x1b[0m");
                println!("\x1b[90m  /clear    - 清空当前对话历史\x1b[0m");
                println!("\x1b[90m  /buddy    - 召唤一只专属电子宠物\x1b[0m");
                println!("\x1b[90m  exit/quit - 退出程序\x1b[0m");
                println!("\x1b[36m==============\n\x1b[0m");
                continue;
            }

            // 处理彩蛋命令
            if lower_input.starts_with("/buddy") {
                let parts: Vec<&str> = user_input.splitn(2, ' ').collect();
                let seed = if parts.len() > 1 { Some(parts[1]) } else { None };
                spawn_buddy(seed);
                continue;
            }

            // 处理清除对话历史命令
            if lower_input == "/clear" {
                let p: Box<dyn LLMProvider> = if provider_name.to_lowercase() == "anthropic" || (!anthropic_api_key.is_empty() && model.contains("claude")) {
                    Box::new(AnthropicProvider::new(anthropic_api_key.clone(), model.clone()))
                } else {
                    Box::new(OpenAIProvider::new(
                        openai_api_key.clone(),
                        base_url.clone(),
                        model.clone(),
                    ))
                };
                agent = Agent::new(p);
                println!("\x1b[32m✓ 对话历史已清空。\x1b[0m");
                continue;
            }

            println!("\x1b[2m\n[Agent] 已收到指令，正在思考中...\n\x1b[0m");

            // 定义处理大模型流式输出的回调函数
            let on_text_response: Box<dyn Fn(String, bool) + Send + Sync> =
                Box::new(|text: String, is_thinking: bool| {
                    if is_thinking {
                        // 思维链 (reasoning_content) 灰色显示
                        print!("\x1b[2m{}\x1b[0m", text);
                    } else {
                        // 普通文本绿色显示
                        print!("\x1b[32m{}\x1b[0m", text);
                    }
                    io::stdout().flush().unwrap();
                });

            // 将用户输入传递给 Agent 处理，触发 ReAct 循环
            agent.chat(user_input.to_string(), on_text_response).await;
            println!();
        }
}