import { Tool, ToolUseContext } from './Tool';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Notebook 单元格类型
 */
type CellType = 'code' | 'markdown';

/**
 * Notebook 单元格
 */
interface NotebookCell {
  cell_type: CellType;      // 单元格类型
  source: string[];         // 单元格内容（字符串数组）
  execution_count?: number | null;  // 执行次数（仅 code 类型）
  outputs?: any[];          // 输出结果（仅 code 类型）
}

/**
 * Notebook 文档结构
 */
interface NotebookDocument {
  cells: NotebookCell[];    // 单元格列表
  metadata: any;            // 元数据
  nbformat: number;         // Notebook 格式版本
  nbformat_minor: number;   // 次版本号
}

/**
 * NotebookEditTool 输入参数
 */
interface NotebookEditInput {
  filePath: string;                    // Notebook 文件路径
  operation: 'read' | 'add' | 'update' | 'delete';  // 操作类型
  cellIndex?: number;                  // 单元格索引（0-based）
  cellType?: CellType;                 // 单元格类型
  content?: string | string[];         // 单元格内容
}

/**
 * NotebookEditTool 输出结果
 */
interface NotebookEditOutput {
  operation: string;
  message: string;
  cells?: NotebookCell[];              // 读取操作返回所有单元格
  cellCount?: number;                  // 单元格总数
}

/**
 * 读取 Notebook 文件
 */
async function readNotebook(filePath: string): Promise<NotebookDocument> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const notebook = JSON.parse(content) as NotebookDocument;
    
    // 验证基本结构
    if (!notebook.cells || !Array.isArray(notebook.cells)) {
      throw new Error('无效的 Notebook 文件格式：缺少 cells 数组');
    }
    
    return notebook;
  } catch (error: any) {
    if (error instanceof SyntaxError) {
      throw new Error(`JSON 解析失败: ${error.message}`);
    }
    throw error;
  }
}

/**
 * 保存 Notebook 文件
 */
async function saveNotebook(filePath: string, notebook: NotebookDocument): Promise<void> {
  const content = JSON.stringify(notebook, null, 2);
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * NotebookEditTool - Jupyter Notebook 编辑工具
 * 
 * 功能：读取、创建、更新和删除 Jupyter Notebook (.ipynb) 文件中的单元格。
 * 
 * 使用场景：
 * - 读取现有的 Jupyter Notebook 文件
 * - 添加新的代码或 Markdown 单元格
 * - 修改现有单元格的内容
 * - 删除不需要的单元格
 * - 自动化生成或修改 Notebook
 * 
 * 教学要点：
 * 1. Jupyter Notebook 是一种交互式文档格式，广泛用于数据科学和机器学习
 * 2. .ipynb 文件本质上是 JSON 格式，包含多个单元格（cells）
 * 3. 单元格有两种类型：
 *    - code: 可执行的代码单元格
 *    - markdown: 文本格式的 Markdown 单元格
 * 4. 每个 code 单元格可以有执行次数（execution_count）和输出（outputs）
 * 5. Notebook 文件遵循特定的 JSON Schema（nbformat）
 * 
 * 支持的操作：
 * - read: 读取整个 Notebook 文件
 * - add: 在末尾添加新单元格
 * - update: 更新指定索引的单元格
 * - delete: 删除指定索引的单元格
 * 
 * 示例用法：
 * ```json
 * {
 *   "filePath": "analysis.ipynb",
 *   "operation": "add",
 *   "cellType": "code",
 *   "content": ["import pandas as pd\\n", "df = pd.read_csv('data.csv')"]
 * }
 * ```
 * 
 * 注意：
 * - 单元格索引从 0 开始
 * - content 可以是字符串或字符串数组
 * - 修改后会自动保存文件
 * - 建议先使用 read 操作了解 Notebook 结构
 */
export const notebookEditTool: Tool<NotebookEditInput, NotebookEditOutput> = {
  name: 'NotebookEdit',
  description: `
    读取和编辑 Jupyter Notebook (.ipynb) 文件。
    
    适用场景：
    - 读取现有的 Jupyter Notebook 文件内容
    - 向 Notebook 添加新的代码或 Markdown 单元格
    - 修改现有单元格的内容
    - 删除不需要的单元格
    - 自动化生成数据分析报告
    
    支持的操作：
    1. read: 读取整个 Notebook
       - 返回所有单元格及其内容
       - 不需要 cellIndex 参数
    
    2. add: 添加新单元格到末尾
       - 需要提供 cellType 和 content
       - 新单元格会添加到 Notebook 末尾
    
    3. update: 更新现有单元格
       - 需要提供 cellIndex 和 content
       - 可以修改单元格的内容和类型
    
    4. delete: 删除单元格
       - 需要提供 cellIndex
       - 删除后后续单元格索引会前移
    
    单元格类型：
    - code: 可执行的代码单元格（Python、R 等）
    - markdown: Markdown 格式的文本单元格
    
    重要规则：
    1. cellIndex 从 0 开始计数
    2. content 可以是单个字符串或字符串数组
    3. 如果是字符串数组，每个元素代表一行
    4. 修改操作会自动保存文件
    5. 建议先使用 read 操作了解 Notebook 结构
    
    注意：
    - 此工具只修改 Notebook 文件，不执行代码
    - 要执行代码，需要在 Jupyter 环境中打开 Notebook
    - 确保 filePath 指向有效的 .ipynb 文件
  `,
  inputSchema: {
    type: 'object',
    properties: {
      filePath: {
        type: 'string',
        description: 'Notebook 文件的路径（.ipynb 文件）',
      },
      operation: {
        type: 'string',
        description: '要执行的操作',
        enum: ['read', 'add', 'update', 'delete'],
      },
      cellIndex: {
        type: 'number',
        description: '单元格索引（0-based，update/delete 操作需要）',
        minimum: 0,
      },
      cellType: {
        type: 'string',
        description: '单元格类型（add/update 操作需要）',
        enum: ['code', 'markdown'],
      },
      content: {
        type: ['string', 'array'],
        description: '单元格内容（add/update 操作需要），可以是字符串或字符串数组',
        items: {
          type: 'string',
        },
      },
    },
    required: ['filePath', 'operation'],
    additionalProperties: false,
  },
  execute: async (
    args: NotebookEditInput,
    context: ToolUseContext
  ): Promise<NotebookEditOutput> => {
    try {
      const { filePath, operation, cellIndex, cellType, content } = args;

      // 解析文件路径
      const resolvedPath = path.isAbsolute(filePath)
        ? filePath
        : path.resolve(context.workspaceDir, filePath);

      // 验证文件扩展名
      if (!resolvedPath.endsWith('.ipynb')) {
        throw new Error('文件必须是 .ipynb 格式');
      }

      console.log(`[NotebookEdit] 执行操作: ${operation} on ${filePath}`);

      let result: NotebookEditOutput;

      switch (operation) {
        case 'read': {
          // 读取 Notebook
          const notebook = await readNotebook(resolvedPath);
          
          result = {
            operation: 'read',
            message: `成功读取 Notebook，共 ${notebook.cells.length} 个单元格`,
            cells: notebook.cells,
            cellCount: notebook.cells.length,
          };
          break;
        }

        case 'add': {
          // 验证必需参数
          if (!cellType) {
            throw new Error('add 操作需要提供 cellType 参数');
          }
          if (!content) {
            throw new Error('add 操作需要提供 content 参数');
          }

          // 读取现有 Notebook
          const notebook = await readNotebook(resolvedPath);

          // 创建新单元格
          const newCell: NotebookCell = {
            cell_type: cellType,
            source: Array.isArray(content) ? content : [content],
          };

          // 如果是 code 类型，添加默认属性
          if (cellType === 'code') {
            newCell.execution_count = null;
            newCell.outputs = [];
          }

          // 添加到末尾
          notebook.cells.push(newCell);

          // 保存文件
          await saveNotebook(resolvedPath, notebook);

          result = {
            operation: 'add',
            message: `成功添加新的 ${cellType} 单元格，当前共 ${notebook.cells.length} 个单元格`,
            cellCount: notebook.cells.length,
          };
          break;
        }

        case 'update': {
          // 验证必需参数
          if (cellIndex === undefined || cellIndex === null) {
            throw new Error('update 操作需要提供 cellIndex 参数');
          }
          if (!content) {
            throw new Error('update 操作需要提供 content 参数');
          }

          // 读取现有 Notebook
          const notebook = await readNotebook(resolvedPath);

          // 验证索引范围
          if (cellIndex < 0 || cellIndex >= notebook.cells.length) {
            throw new Error(`单元格索引超出范围：0-${notebook.cells.length - 1}`);
          }

          // 更新单元格
          const cell = notebook.cells[cellIndex];
          cell.source = Array.isArray(content) ? content : [content];
          
          // 如果提供了 cellType，也更新类型
          if (cellType) {
            const oldType = cell.cell_type;
            cell.cell_type = cellType;
            
            // 如果类型改变，需要调整属性
            if (oldType !== cellType) {
              if (cellType === 'code') {
                cell.execution_count = null;
                cell.outputs = [];
              } else {
                delete cell.execution_count;
                delete cell.outputs;
              }
            }
          }

          // 保存文件
          await saveNotebook(resolvedPath, notebook);

          result = {
            operation: 'update',
            message: `成功更新单元格 ${cellIndex}`,
            cellCount: notebook.cells.length,
          };
          break;
        }

        case 'delete': {
          // 验证必需参数
          if (cellIndex === undefined || cellIndex === null) {
            throw new Error('delete 操作需要提供 cellIndex 参数');
          }

          // 读取现有 Notebook
          const notebook = await readNotebook(resolvedPath);

          // 验证索引范围
          if (cellIndex < 0 || cellIndex >= notebook.cells.length) {
            throw new Error(`单元格索引超出范围：0-${notebook.cells.length - 1}`);
          }

          // 删除单元格
          notebook.cells.splice(cellIndex, 1);

          // 保存文件
          await saveNotebook(resolvedPath, notebook);

          result = {
            operation: 'delete',
            message: `成功删除单元格 ${cellIndex}，当前共 ${notebook.cells.length} 个单元格`,
            cellCount: notebook.cells.length,
          };
          break;
        }

        default:
          throw new Error(`不支持的操作: ${operation}`);
      }

      console.log(`[NotebookEdit] ${result.message}`);
      return result;
    } catch (error: any) {
      throw new Error(`NotebookEdit 执行失败: ${error.message}`);
    }
  },
};
