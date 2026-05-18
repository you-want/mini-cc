import { Tool, ToolUseContext } from './Tool';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

/**
 * Web 请求工具 (实现 Tool 接口)
 * 
 * 功能：发起 HTTP/HTTPS 请求，获取网页内容或 API 数据。
 * 
 * 使用场景：
 * - 获取 API 数据
 * - 下载网页内容
 * - 查询在线文档
 * - 获取远程配置
 * 
 * 教学要点：
 * 1. 支持 GET 和 POST 请求
 * 2. 自动处理 HTTPS 和 HTTP 协议
 * 3. 支持自定义请求头（如 User-Agent、Authorization）
 * 4. 响应内容限制在 50KB 以内，避免过大响应
 * 
 * 安全机制：
 * - 限制响应大小，防止内存溢出
 * - 设置超时时间（30 秒）
 * - 仅支持 HTTP/HTTPS 协议
 */

interface WebFetchInput {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
}

interface WebFetchOutput {
  success: boolean;
  statusCode?: number;
  headers?: Record<string, string>;
  body?: string;
  error?: string;
  truncated?: boolean;
}

export const webFetchTool: Tool<WebFetchInput, WebFetchOutput> = {
  name: 'WebFetchTool',
  description: `
    发起 HTTP/HTTPS 请求，获取网页内容或 API 数据。
    
    参数说明：
    - url: 请求的 URL（必须是 http:// 或 https:// 开头）
    - method: 可选，请求方法（GET 或 POST，默认 GET）
    - headers: 可选，自定义请求头（JSON 对象）
    - body: 可选，请求体（仅用于 POST 请求）
    
    支持的场景：
    - 获取 REST API 数据
    - 下载网页 HTML
    - 查询在线文档
    - 获取 JSON 配置
    
    限制：
    - 响应大小限制为 50KB
    - 超时时间为 30 秒
    - 仅支持 HTTP/HTTPS 协议
    
    示例：
    1. 获取 API 数据：
       url: "https://api.github.com/repos/nodejs/node"
       method: "GET"
       headers: {"User-Agent": "mini-cc"}
    
    2. POST 请求：
       url: "https://api.example.com/data"
       method: "POST"
       headers: {"Content-Type": "application/json"}
       body: "{\\"key\\": \\"value\\"}"
  `,
  inputSchema: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: '请求的 URL（必须是 http:// 或 https:// 开头）',
      },
      method: {
        type: 'string',
        enum: ['GET', 'POST'],
        description: '可选：请求方法（默认 GET）',
      },
      headers: {
        type: 'object',
        description: '可选：自定义请求头（JSON 对象）',
      },
      body: {
        type: 'string',
        description: '可选：请求体（仅用于 POST 请求）',
      },
    },
    required: ['url'],
  },
  execute: async (
    args: WebFetchInput,
    context: ToolUseContext
  ): Promise<WebFetchOutput> => {
    const { url, method = 'GET', headers = {}, body } = args;

    try {
      if (!url) {
        throw new Error('url 参数不能为空');
      }

      // 验证 URL 格式
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
      } catch (error) {
        throw new Error(`无效的 URL 格式: ${url}`);
      }

      // 只支持 HTTP 和 HTTPS
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        throw new Error(`不支持的协议: ${parsedUrl.protocol}。仅支持 http:// 和 https://`);
      }

      console.log(`[WebFetchTool] 发起 ${method} 请求: ${url}`);

      // 设置默认请求头
      const defaultHeaders: Record<string, string> = {
        'User-Agent': 'mini-cc/1.0',
        ...headers,
      };

      // 如果是 POST 请求且有 body，设置 Content-Length
      if (method === 'POST' && body) {
        defaultHeaders['Content-Length'] = Buffer.byteLength(body).toString();
      }

      // 选择 http 或 https 模块
      const httpModule = parsedUrl.protocol === 'https:' ? https : http;

      // 发起请求
      const result = await new Promise<WebFetchOutput>((resolve, reject) => {
        const options = {
          method,
          headers: defaultHeaders,
          timeout: 30000, // 30 秒超时
        };

        const req = httpModule.request(url, options, (res) => {
          const chunks: Buffer[] = [];
          let totalSize = 0;
          const MAX_SIZE = 50 * 1024; // 50KB 限制
          let truncated = false;

          res.on('data', (chunk: Buffer) => {
            totalSize += chunk.length;
            
            if (totalSize > MAX_SIZE) {
              truncated = true;
              res.destroy(); // 停止接收数据
              return;
            }
            
            chunks.push(chunk);
          });

          res.on('end', () => {
            const responseBody = Buffer.concat(chunks).toString('utf-8');
            
            resolve({
              success: true,
              statusCode: res.statusCode,
              headers: res.headers as Record<string, string>,
              body: responseBody,
              truncated,
            });
          });

          res.on('error', (error) => {
            reject(error);
          });
        });

        req.on('error', (error) => {
          reject(error);
        });

        req.on('timeout', () => {
          req.destroy();
          reject(new Error('请求超时（30 秒）'));
        });

        // 发送请求体（如果是 POST）
        if (method === 'POST' && body) {
          req.write(body);
        }

        req.end();
      });

      console.log(`[WebFetchTool] 请求完成，状态码: ${result.statusCode}`);

      return result;
    } catch (error: any) {
      console.error(`[WebFetchTool] 请求失败: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
      };
    }
  },
};
