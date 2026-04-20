const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

const server = new Server({
  name: 'weather-plugin',
  version: '1.0.0',
}, {
  capabilities: { tools: {} }
});

const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

// 1. 注册工具及其参数 Schema
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: 'get_weather',
    description: '获取指定城市的天气',
    inputSchema: {
      type: 'object',
      properties: { city: { type: 'string', description: '城市拼音，如 Beijing' } },
      required: ['city']
    }
  }]
}));

// 2. 处理大模型的工具调用请求
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'get_weather') {
    const city = request.params.arguments.city;
    // 这里可以换成真实的 API 调用，比如查第三方天气接口
    const weather = city === 'Beijing' ? 'Sunny, 25°C' : 'Unknown';
    return {
      content: [{ type: 'text', text: `The weather in ${city} is ${weather}.` }]
    };
  }
  throw new Error('Tool not found');
});

// 3. 启动基于 stdio 的传输层
const transport = new StdioServerTransport();
server.connect(transport);
