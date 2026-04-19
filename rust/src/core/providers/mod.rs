use serde_json::Value;
use std::future::Future;
use std::pin::Pin;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub args: Value,
}

#[derive(Debug, Clone)]
pub struct ToolResult {
    pub id: String,
    pub name: String,
    pub result: String,
    pub is_error: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponse {
    pub text: String,
    pub tool_calls: Vec<ToolCall>,
}

pub type OnTextResponseFn = Box<dyn Fn(String, bool) + Send + Sync>;

pub trait LLMProvider: Send + Sync {
    fn send_message<'a>(
        &'a mut self,
        user_message: String,
        on_text_response: &'a OnTextResponseFn,
    ) -> Pin<Box<dyn Future<Output = Result<ChatResponse, String>> + Send + 'a>>;

    fn send_tool_results<'a>(
        &'a mut self,
        results: Vec<ToolResult>,
        on_text_response: &'a OnTextResponseFn,
    ) -> Pin<Box<dyn Future<Output = Result<ChatResponse, String>> + Send + 'a>>;
}

pub mod openai_provider;
pub mod anthropic_provider;