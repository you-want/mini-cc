#!/usr/bin/env node

/**
 * 新工具快速测试脚本
 * 
 * 这个脚本会快速测试所有新增的工具，验证它们是否正常工作。
 * 
 * 运行方式：
 * node scripts/test-new-tools.js
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testGlobTool() {
  log('\n=== 测试 GlobTool ===', 'blue');
  
  try {
    const { globTool } = require('../dist/infrastructure/tools/GlobTool');
    const context = {
      stateStore: {},
      permissionContext: {},
      workspaceDir: process.cwd(),
    };
    
    // 测试 1: 查找所有 TypeScript 文件
    log('测试 1: 查找所有 .ts 文件...', 'yellow');
    const result1 = await globTool.execute({ pattern: '**/*.ts' }, context);
    log(`✓ 找到 ${result1.count} 个文件`, 'green');
    
    // 测试 2: 查找特定目录
    log('测试 2: 查找 src 目录下的文件...', 'yellow');
    const result2 = await globTool.execute({ pattern: '**/*.ts', path: 'src' }, context);
    log(`✓ 找到 ${result2.count} 个文件`, 'green');
    
    return true;
  } catch (error) {
    log(`✗ GlobTool 测试失败: ${error.message}`, 'red');
    return false;
  }
}

async function testGrepTool() {
  log('\n=== 测试 GrepTool ===', 'blue');
  
  try {
    const { grepTool } = require('../dist/infrastructure/tools/GrepTool');
    const context = {
      stateStore: {},
      permissionContext: {},
      workspaceDir: process.cwd(),
    };
    
    // 测试 1: 搜索关键词
    log('测试 1: 搜索 "Tool" 关键词...', 'yellow');
    const result1 = await grepTool.execute({ pattern: 'Tool', filePattern: '**/*.ts' }, context);
    log(`✓ 找到 ${result1.totalMatches} 个匹配`, 'green');
    
    // 测试 2: 正则表达式搜索
    log('测试 2: 使用正则表达式搜索函数定义...', 'yellow');
    const result2 = await grepTool.execute({ pattern: 'function\\s+\\w+', filePattern: '**/*.ts' }, context);
    log(`✓ 找到 ${result2.totalMatches} 个匹配`, 'green');
    
    return true;
  } catch (error) {
    log(`✗ GrepTool 测试失败: ${error.message}`, 'red');
    return false;
  }
}

async function testFileEditTool() {
  log('\n=== 测试 FileEditTool ===', 'blue');
  
  const testFile = path.join(os.tmpdir(), 'test-edit.txt');
  
  try {
    const { fileEditTool } = require('../dist/infrastructure/tools/FileEditTool');
    const context = {
      stateStore: {},
      permissionContext: {},
      workspaceDir: os.tmpdir(),
    };
    
    // 创建测试文件
    await fs.writeFile(testFile, 'const x = 10;\nconst y = 20;\n');
    
    // 测试 1: 简单替换
    log('测试 1: 替换文本...', 'yellow');
    const result1 = await fileEditTool.execute({
      file_path: testFile,
      old_string: 'const x = 10;',
      new_string: 'const x = 100;',
    }, context);
    
    if (result1.success) {
      log(`✓ 成功替换 ${result1.replacements} 处`, 'green');
    } else {
      throw new Error(result1.message);
    }
    
    // 验证结果
    const content = await fs.readFile(testFile, 'utf-8');
    if (content.includes('const x = 100;')) {
      log('✓ 文件内容已正确更新', 'green');
    } else {
      throw new Error('文件内容未正确更新');
    }
    
    // 清理
    await fs.unlink(testFile);
    
    return true;
  } catch (error) {
    log(`✗ FileEditTool 测试失败: ${error.message}`, 'red');
    try {
      await fs.unlink(testFile);
    } catch {}
    return false;
  }
}

async function testWebFetchTool() {
  log('\n=== 测试 WebFetchTool ===', 'blue');
  
  try {
    const { webFetchTool } = require('../dist/infrastructure/tools/WebFetchTool');
    const context = {
      stateStore: {},
      permissionContext: {},
      workspaceDir: process.cwd(),
    };
    
    // 测试 1: URL 验证
    log('测试 1: 验证无效 URL...', 'yellow');
    const result1 = await webFetchTool.execute({ url: 'invalid-url' }, context);
    if (!result1.success && result1.error.includes('无效的 URL')) {
      log('✓ URL 验证正常', 'green');
    } else {
      throw new Error('URL 验证失败');
    }
    
    // 测试 2: 协议限制
    log('测试 2: 验证协议限制...', 'yellow');
    const result2 = await webFetchTool.execute({ url: 'ftp://example.com' }, context);
    if (!result2.success && result2.error.includes('不支持的协议')) {
      log('✓ 协议限制正常', 'green');
    } else {
      throw new Error('协议限制失败');
    }
    
    // 测试 3: 实际请求（可选，需要网络）
    log('测试 3: 发起实际 HTTP 请求...', 'yellow');
    const result3 = await webFetchTool.execute({ url: 'https://api.github.com' }, context);
    if (result3.success) {
      log(`✓ 请求成功，状态码: ${result3.statusCode}`, 'green');
    } else {
      log(`⚠ 请求失败（可能是网络问题）: ${result3.error}`, 'yellow');
    }
    
    return true;
  } catch (error) {
    log(`✗ WebFetchTool 测试失败: ${error.message}`, 'red');
    return false;
  }
}

async function main() {
  log('╔════════════════════════════════════════╗', 'blue');
  log('║   Mini-CC 新工具快速测试脚本          ║', 'blue');
  log('╚════════════════════════════════════════╝', 'blue');
  
  const results = {
    GlobTool: false,
    GrepTool: false,
    FileEditTool: false,
    WebFetchTool: false,
  };
  
  // 运行所有测试
  results.GlobTool = await testGlobTool();
  results.GrepTool = await testGrepTool();
  results.FileEditTool = await testFileEditTool();
  results.WebFetchTool = await testWebFetchTool();
  
  // 输出总结
  log('\n╔════════════════════════════════════════╗', 'blue');
  log('║           测试结果总结                 ║', 'blue');
  log('╚════════════════════════════════════════╝', 'blue');
  
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;
  
  for (const [tool, result] of Object.entries(results)) {
    const status = result ? '✓ 通过' : '✗ 失败';
    const color = result ? 'green' : 'red';
    log(`${tool.padEnd(20)} ${status}`, color);
  }
  
  log(`\n总计: ${passed}/${total} 个工具测试通过`, passed === total ? 'green' : 'yellow');
  
  if (passed === total) {
    log('\n🎉 所有测试通过！新工具已准备就绪。', 'green');
    process.exit(0);
  } else {
    log('\n⚠️  部分测试失败，请检查错误信息。', 'yellow');
    process.exit(1);
  }
}

main().catch(error => {
  log(`\n✗ 测试脚本执行失败: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
