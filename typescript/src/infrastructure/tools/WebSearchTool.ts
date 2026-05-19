import { Tool, ToolUseContext } from './Tool';
import https from 'https';

/**
 * WebSearchTool 输入参数
 */
interface WebSearchInput {
  query: string;              // 搜索查询
  num_results?: number;       // 返回结果数量（默认 5）
}

/**
 * 搜索结果项
 */
interface SearchResult {
  title: string;    // 结果标题
  url: string;      // 结果 URL
  snippet: string;  // 摘要片段
}

/**
 * WebSearchTool 输出结果
 */
interface WebSearchOutput {
  query: string;            // 执行的搜索查询
  results: SearchResult[];  // 搜索结果列表
  count: number;            // 结果数量
  message: string;          // 操作消息
}

/**
 * 使用 DuckDuckGo HTML 搜索（无需 API Key）
 */
function searchWithDuckDuckGo(query: string, numResults: number = 5): Promise<SearchResult[]> {
  return new Promise((resolve, reject) => {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;
    
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MiniCC Bot)',
      },
    }, (res) => {
      let data = '';
      
      res.on('data', chunk => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          // 简单的 HTML 解析（生产环境建议使用 cheerio 等库）
          const results: SearchResult[] = [];
          
          // 提取搜索结果（简化版正则匹配）
          const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g;
          const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/a>/g;
          
          let match;
          let index = 0;
          while ((match = resultRegex.exec(data)) !== null && index < numResults) {
            const url = match[1];
            const title = match[2].replace(/<[^>]*>/g, ''); // 去除 HTML 标签
            
            // 尝试获取对应的摘要
            let snippet = '暂无摘要';
            
            results.push({
              title: title.trim(),
              url: url.startsWith('http') ? url : `https://${url}`,
              snippet: snippet.trim(),
            });
            
            index++;
          }
          
          resolve(results);
        } catch (error: any) {
          reject(new Error(`解析搜索结果失败: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`网络请求失败: ${error.message}`));
    });
  });
}

/**
 * WebSearchTool - 网络搜索工具
 * 
 * 功能：执行网络搜索，获取最新的在线信息。
 * 
 * 使用场景：
 * - 查找最新的技术文档或 API 信息
 * - 搜索新闻、事件或实时数据
 * - 验证某些事实或查找参考资料
 * - 了解某个主题的最新发展
 * 
 * 教学要点：
 * 1. WebSearch 与 WebFetch 的区别：
 *    - WebFetch: 获取指定 URL 的内容（已知网址）
 *    - WebSearch: 根据关键词搜索相关网页（未知网址）
 * 2. 搜索引擎会返回多个相关结果，需要筛选最有价值的信息
 * 3. 搜索结果可能包含过时或不准确的信息，需要交叉验证
 * 4. 应该优先使用权威来源（官方文档、知名网站等）
 * 5. 注意搜索结果的时效性，某些领域信息更新很快
 * 
 * 示例用法：
 * ```json
 * {
 *   "query": "TypeScript 5.0 新特性",
 *   "num_results": 5
 * }
 * ```
 * 
 * 注意：
 * - 这是一个简化实现，使用 DuckDuckGo HTML 搜索
 * - 生产环境建议使用专业的搜索 API（如 Google Custom Search、Bing Search API）
 * - 某些网络环境可能需要代理才能访问搜索引擎
 */
export const webSearchTool: Tool<WebSearchInput, WebSearchOutput> = {
  name: 'WebSearch',
  description: `
    执行网络搜索，获取最新的在线信息。
    
    适用场景：
    - 查找最新的技术文档、API 参考或教程
    - 搜索新闻、事件、市场数据等实时信息
    - 验证事实、查找统计数据或参考资料
    - 了解某个领域的最新发展和趋势
    
    与 WebFetch 的区别：
    - WebFetch: 当你已经知道具体的 URL 时使用
    - WebSearch: 当你需要根据关键词查找相关网页时使用
    
    重要规则：
    1. query 应该清晰明确，包含关键搜索词
    2. 可以使用引号进行精确匹配（如 "exact phrase"）
    3. 可以添加 site: 限定搜索范围（如 site:github.com）
    4. num_results 默认为 5，可根据需要调整（建议 3-10）
    5. 搜索结果需要人工筛选和验证，不要盲目相信
    
    搜索技巧：
    - 使用 filetype:pdf 查找 PDF 文档
    - 使用 site:example.com 限定网站
    - 使用 intitle:keyword 在标题中搜索
    - 使用 -keyword 排除某些词
    
    注意：
    - 当前使用 DuckDuckGo 搜索引擎（无需 API Key）
    - 某些网络环境可能需要配置代理
    - 搜索结果可能因地区和时间而异
  `,
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索查询字符串，应清晰明确地表达搜索意图',
        minLength: 2,
      },
      num_results: {
        type: 'number',
        description: '返回的结果数量（默认 5，建议范围 3-10）',
        minimum: 1,
        maximum: 20,
      },
    },
    required: ['query'],
    additionalProperties: false,
  },
  execute: async (
    args: WebSearchInput,
    context: ToolUseContext
  ): Promise<WebSearchOutput> => {
    try {
      const { query, num_results = 5 } = args;

      // 验证输入
      if (!query || query.trim().length < 2) {
        throw new Error('搜索查询至少需要 2 个字符');
      }

      console.log(`[WebSearch] 执行搜索: "${query}" (期望 ${num_results} 个结果)`);

      // 执行搜索
      const results = await searchWithDuckDuckGo(query.trim(), num_results);

      console.log(`[WebSearch] 找到 ${results.length} 个结果`);

      return {
        query: query.trim(),
        results,
        count: results.length,
        message: results.length === 0
          ? '未找到相关搜索结果。请尝试不同的搜索词。'
          : `找到 ${results.length} 个搜索结果。`,
      };
    } catch (error: any) {
      // 如果搜索失败，返回友好的错误信息
      console.error(`[WebSearch] 搜索失败: ${error.message}`);
      
      return {
        query: args.query,
        results: [],
        count: 0,
        message: `搜索失败: ${error.message}。请检查网络连接或稍后重试。`,
      };
    }
  },
};
