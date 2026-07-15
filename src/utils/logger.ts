type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel =
  LOG_LEVELS[process.env.LOG_LEVEL as LogLevel] ?? LOG_LEVELS.info;

const formatMessage = (level: LogLevel, message: string, data?: unknown): string => {
  const timestamp = new Date().toISOString();
  const base = `${timestamp} [${level.toUpperCase()}] ${message}`;
  if (data && typeof data === "object" && Object.keys(data as object).length > 0) {
    return `${base} ${JSON.stringify(data)}`;
  }
  return base;
};

export const logger = {
  debug: (message: string, data?: unknown) => {
    if (currentLevel <= LOG_LEVELS.debug) {
      console.debug(formatMessage("debug", message, data));
    }
  },
  info: (message: string, data?: unknown) => {
    if (currentLevel <= LOG_LEVELS.info) {
      console.info(formatMessage("info", message, data));
    }
  },
  warn: (message: string, data?: unknown) => {
    if (currentLevel <= LOG_LEVELS.warn) {
      console.warn(formatMessage("warn", message, data));
    }
  },
  error: (message: string, data?: unknown) => {
    if (currentLevel <= LOG_LEVELS.error) {
      console.error(formatMessage("error", message, data));
    }
  },
};
