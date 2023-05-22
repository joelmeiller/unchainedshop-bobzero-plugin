import { createLogger, LogLevel } from '@unchainedshop/logger'

const logger = createLogger('unchained')

export const log = (message: string | Error, options?: { level?: LogLevel; [x: string]: any }) => {
  if (!options?.level) {
    return logger.info(message as any, options)
  }
  const { level = LogLevel.Info, ...meta } = options || {}
  return logger.log(level, message as any, meta)
}
