/**
 * 简单的日志记录器
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
  enabled?: boolean;
  timeFormat?: string;
}

export class Logger {
  private level: LogLevel;
  private prefix: string;
  private enabled: boolean;
  private timeFormat: string;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.prefix = options.prefix ?? '';
    this.enabled = options.enabled ?? true;
    this.timeFormat = options.timeFormat ?? 'yyyy-MM-dd HH:mm:ss.SSS';
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  debug(message: string, ...args: any[]): void {
    if (this.enabled && this.level <= LogLevel.DEBUG) {
      this.log('DEBUG', message, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.enabled && this.level <= LogLevel.INFO) {
      this.log('INFO', message, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.enabled && this.level <= LogLevel.WARN) {
      this.log('WARN', message, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.enabled && this.level <= LogLevel.ERROR) {
      this.log('ERROR', message, ...args);
    }
  }

  private log(level: string, message: string, ...args: any[]): void {
    const timestamp = this.customFormat(new Date(), this.timeFormat);
    const prefix = this.prefix ? `[${this.prefix}] ` : '';
    const logMessage = `${timestamp} ${prefix}[${level}] ${message}`;

    if (level === 'ERROR') {
      console.error(logMessage, ...args);
    } else if (level === 'WARN') {
      console.warn(logMessage, ...args);
    } else {
      console.log(logMessage, ...args);
    }
  }

  private customFormat(date: Date, format: string): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

    return format
      .replace('yyyy', String(year))
      .replace('MM', month)
      .replace('dd', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds)
      .replace('SSS', milliseconds);
  }
}

// 创建默认logger实例
export const logger = new Logger({
  enabled: false,
});

// 全局配置logger是否启用
export function enableLogger(enabled: boolean): void {
  logger.setEnabled(enabled);
}

export default Logger;
