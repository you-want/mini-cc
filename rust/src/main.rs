use dotenv::dotenv;
use minicc::core::agent::Agent;
use minicc::core::providers::openai_provider::OpenAIProvider;
use std::env;
use std::io::{self, Write};
use tokio;

#[tokio::main]
async fn main() {
    dotenv().ok();

    let args: Vec<String> = env::args().collect();
    if args.len() == 2 && (args[1] == "--version" || args[1] == "-v") {
        println!("mini-cc rust v1.0.0");
        return;
    }

    let provider_name = env::var("PROVIDER").unwrap_or_else(|_| "openai".to_string());

    if provider_name.to_lowercase() == "openai" {
        let api_key = env::var("OPENAI_API_KEY").unwrap_or_default();
        let base_url = env::var("OPENAI_BASE_URL").unwrap_or_default();
        let model_name = env::var("MODEL_NAME").unwrap_or_else(|_| "qwen3.6-plus".to_string());

        if api_key.is_empty() {
            println!("\x1b[31m错误：未设置 OPENAI_API_KEY 环境变量。\x1b[0m");
            return;
        }

        println!(
            "\x1b[90m[系统配置] 已选择 OpenAI 兼容模型，模型名称: {}\x1b[0m",
            model_name
        );
        let provider = Box::new(OpenAIProvider::new(api_key, base_url, model_name));
        let mut agent = Agent::new(provider);

        println!("\x1b[1;34m\n=== 欢迎使用 mini-cc (Rust) ===\n\x1b[0m");
        println!("\x1b[90m输入您的需求，我将为您编写代码或执行系统操作。\x1b[0m");
        println!("\x1b[90m键入 \"exit\" 或 \"quit\" 退出程序。\n\x1b[0m");

        loop {
            print!("\x1b[36mmini-cc> \x1b[0m");
            io::stdout().flush().unwrap();

            let mut user_input = String::new();
            if io::stdin().read_line(&mut user_input).is_err() {
                println!("\x1b[32m\n再见！\x1b[0m");
                break;
            }

            let user_input = user_input.trim();
            if user_input.is_empty() {
                continue;
            }

            let lower_input = user_input.to_lowercase();
            if lower_input == "exit" || lower_input == "quit" {
                println!("\x1b[32m再见！\x1b[0m");
                break;
            }

            if lower_input == "/help" {
                println!("\x1b[36m\n=== 可用命令 ===\x1b[0m");
                println!("\x1b[90m  /help     - 显示此帮助信息\x1b[0m");
                println!("\x1b[90m  /clear    - 清空当前对话历史\x1b[0m");
                println!("\x1b[90m  exit/quit - 退出程序\x1b[0m");
                println!("\x1b[36m==============\n\x1b[0m");
                continue;
            }

            if lower_input == "/clear" {
                let p = Box::new(OpenAIProvider::new(
                    env::var("OPENAI_API_KEY").unwrap_or_default(),
                    env::var("OPENAI_BASE_URL").unwrap_or_default(),
                    env::var("MODEL_NAME").unwrap_or_else(|_| "qwen3.6-plus".to_string()),
                ));
                agent = Agent::new(p);
                println!("\x1b[32m✓ 对话历史已清空。\x1b[0m");
                continue;
            }

            println!("\x1b[2m\n[Agent] 已收到指令，正在思考中...\n\x1b[0m");

            let on_text_response: Box<dyn Fn(String, bool) + Send + Sync> =
                Box::new(|text: String, is_thinking: bool| {
                    if is_thinking {
                        print!("\x1b[2m{}\x1b[0m", text);
                    } else {
                        print!("\x1b[32m{}\x1b[0m", text);
                    }
                    io::stdout().flush().unwrap();
                });

            agent.chat(user_input.to_string(), on_text_response).await;
            println!();
        }
    } else {
        println!("\x1b[31mRust 版本目前仅支持 OpenAI 兼容接口。\x1b[0m");
    }
}