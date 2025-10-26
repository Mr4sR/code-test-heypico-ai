/**
 * Audit Logging System
 * Best Practice: Track API usage, security events, and errors
 */

export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  SECURITY = 'SECURITY',
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  details: Record<string, any>;
  clientId?: string;
}

class AuditLogger {
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;
  private enabled: boolean;

  constructor() {
    this.enabled = process.env.ENABLE_AUDIT_LOG === 'true';
  }

  private createEntry(
    level: LogLevel,
    event: string,
    details: Record<string, any>,
    clientId?: string
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      event,
      details,
      clientId,
    };
  }

  log(
    level: LogLevel,
    event: string,
    details: Record<string, any> = {},
    clientId?: string
  ): void {
    if (!this.enabled) return;

    const entry = this.createEntry(level, event, details, clientId);
    
    // Console output for development
    if (process.env.NODE_ENV === 'development') {
      const color = {
        [LogLevel.INFO]: '\x1b[36m',
        [LogLevel.WARN]: '\x1b[33m',
        [LogLevel.ERROR]: '\x1b[31m',
        [LogLevel.SECURITY]: '\x1b[35m',
      }[level];
      console.log(`${color}[${level}]\x1b[0m ${event}`, details);
    }

    // Store in memory (in production, send to logging service)
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // In production, you would send to services like:
    // - CloudWatch, Datadog, LogRocket, etc.
  }

  info(event: string, details: Record<string, any> = {}, clientId?: string): void {
    this.log(LogLevel.INFO, event, details, clientId);
  }

  warn(event: string, details: Record<string, any> = {}, clientId?: string): void {
    this.log(LogLevel.WARN, event, details, clientId);
  }

  error(event: string, details: Record<string, any> = {}, clientId?: string): void {
    this.log(LogLevel.ERROR, event, details, clientId);
  }

  security(event: string, details: Record<string, any> = {}, clientId?: string): void {
    this.log(LogLevel.SECURITY, event, details, clientId);
  }

  getLogs(filters?: { level?: LogLevel; clientId?: string; limit?: number }): LogEntry[] {
    let filtered = [...this.logs];

    if (filters?.level) {
      filtered = filtered.filter((log) => log.level === filters.level);
    }

    if (filters?.clientId) {
      filtered = filtered.filter((log) => log.clientId === filters.clientId);
    }

    if (filters?.limit) {
      filtered = filtered.slice(-filters.limit);
    }

    return filtered;
  }

  clear(): void {
    this.logs = [];
  }
}

// Singleton instance
export const auditLogger = new AuditLogger();
