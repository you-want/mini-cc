import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface GlobalConfig {
  PROVIDER?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  MODEL_NAME?: string;
  [key: string]: any;
}

const CONFIG_DIR = path.join(os.homedir(), '.mini-cc');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

/**
 * 确保配置目录存在
 */
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * 读取全局配置
 */
export function readConfig(): GlobalConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error(`Failed to read config file at ${CONFIG_FILE}:`, error);
  }
  return {};
}

/**
 * 写入全局配置
 */
export function writeConfig(config: GlobalConfig): void {
  try {
    ensureConfigDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    console.error(`Failed to write config file at ${CONFIG_FILE}:`, error);
  }
}

/**
 * 设置单个配置项
 */
export function setConfigValue(key: string, value: string): void {
  const config = readConfig();
  config[key] = value;
  writeConfig(config);
}

/**
 * 获取单个配置项
 */
export function getConfigValue(key: string): string | undefined {
  const config = readConfig();
  return config[key];
}

/**
 * 清除配置项
 */
export function removeConfigValue(key: string): void {
  const config = readConfig();
  if (key in config) {
    delete config[key];
    writeConfig(config);
  }
}
