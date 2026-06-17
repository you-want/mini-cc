FROM docker.m.daocloud.io/library/node:20-alpine

WORKDIR /app

# 复制 package 文件
COPY package.json pnpm-lock.yaml ./

# 安装 pnpm 和依赖
RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile --prod

# 复制编译后的代码
COPY dist/ ./dist/
COPY MCP_SERVER.md ./

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000
ENV WORKSPACE_DIR=/workspace

# 创建工作目录
RUN mkdir -p /workspace

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 启动服务器
CMD ["node", "dist/server/index.js"]
