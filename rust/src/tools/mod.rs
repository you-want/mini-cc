use serde_json::Value;
use std::future::Future;
use std::pin::Pin;

pub type ToolExecuteFn = fn(Value) -> Pin<Box<dyn Future<Output = Result<String, String>> + Send>>;

pub struct Tool {
    pub name: String,
    pub description: String,
    pub input_schema: Value,
    pub execute: ToolExecuteFn,
}

pub mod bash_tool;
pub mod file_tools;

pub fn get_all_tools() -> Vec<Tool> {
    vec![
        bash_tool::get_tool(),
        file_tools::get_read_tool(),
        file_tools::get_write_tool(),
    ]
}