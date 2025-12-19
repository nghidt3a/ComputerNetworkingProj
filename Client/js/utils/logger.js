/**
 * CLIENT LOGGER
 * Centralized logging with consistent formatting and color coding
 */

const Logger = {
  // Prefix constants
  SERVER_PREFIX: '[⚙️  SERVER]',
  CLIENT_PREFIX: '[🖥️  CLIENT]',
  
  // Symbols
  SUCCESS: '✅',
  ERROR: '❌',
  WARNING: '⚠️',
  INFO: 'ℹ️',
  ARROW: '→',
  COMMAND: '🔧',
  FILE: '📁',
  MEDIA: '🎬',
  NETWORK: '🌐',
  
  // CSS Styles for console
  styles: {
    info: 'color: #00BCD4; font-weight: bold; padding: 2px 6px;',
    success: 'color: #4CAF50; font-weight: bold; padding: 2px 6px;',
    error: 'color: #f44336; font-weight: bold; padding: 2px 6px;',
    warning: 'color: #FFC107; font-weight: bold; padding: 2px 6px;',
    command: 'color: #9C27B0; font-weight: bold; padding: 2px 6px;',
    file: 'color: #2196F3; font-weight: bold; padding: 2px 6px;',
    media: 'color: #FF9800; font-weight: bold; padding: 2px 6px;',
    network: 'color: #00897B; font-weight: bold; padding: 2px 6px;',
  },

  /**
   * Log informational message
   */
  info(message) {
    console.log(`%c${this.CLIENT_PREFIX} ${this.INFO} ${message}`, this.styles.info);
  },

  /**
   * Log success message
   */
  success(message) {
    console.log(`%c${this.CLIENT_PREFIX} ${this.SUCCESS} ${message}`, this.styles.success);
  },

  /**
   * Log error message
   */
  error(message) {
    console.log(`%c${this.CLIENT_PREFIX} ${this.ERROR} ${message}`, this.styles.error);
  },

  /**
   * Log warning message
   */
  warning(message) {
    console.log(`%c${this.CLIENT_PREFIX} ${this.WARNING} ${message}`, this.styles.warning);
  },

  /**
   * Log server action (when receiving data from server)
   */
  serverAction(message) {
    console.log(`%c${this.SERVER_PREFIX} ${this.ARROW} ${message}`, 'color: #E91E63; font-weight: bold;');
  },

  /**
   * Log command being sent to server
   */
  command(command, param = '') {
    const paramStr = param ? ` | ${param}` : '';
    console.log(`%c${this.CLIENT_PREFIX} ${this.COMMAND} [CMD] ${command}${paramStr}`, this.styles.command);
  },

  /**
   * Log file operation
   */
  file(operation, path) {
    console.log(`%c${this.CLIENT_PREFIX} ${this.FILE} ${operation}: ${path}`, this.styles.file);
  },

  /**
   * Log media operation (video, audio, webcam)
   */
  media(operation, details = '') {
    const detailsStr = details ? ` - ${details}` : '';
    console.log(`%c${this.CLIENT_PREFIX} ${this.MEDIA} ${operation}${detailsStr}`, this.styles.media);
  },

  /**
   * Log network operation
   */
  network(message) {
    console.log(`%c${this.CLIENT_PREFIX} ${this.NETWORK} ${message}`, this.styles.network);
  },

  /**
   * Log UI event
   */
  ui(action, details = '') {
    const detailsStr = details ? `: ${details}` : '';
    console.log(`%c${this.CLIENT_PREFIX} 🎨 [UI] ${action}${detailsStr}`, 'color: #9C27B0; font-weight: bold;');
  },

  /**
   * Log navigation event
   */
  navigation(tab) {
    console.log(`%c${this.CLIENT_PREFIX} 🗺️  Navigation: ${tab}`, 'color: #673AB7; font-weight: bold;');
  },

  /**
   * Log section header
   */
  header(title) {
    console.log(`%c═══════════════════════════════════════`, 'color: #FFF; font-weight: bold;');
    console.log(`%c   ${title}`, 'color: #00BCD4; font-weight: bold; font-size: 14px;');
    console.log(`%c═══════════════════════════════════════`, 'color: #FFF; font-weight: bold;');
  },

  /**
   * Log separator
   */
  separator() {
    console.log('%c───────────────────────────────────────', 'color: #999;');
  },

  /**
   * Debug log (only shown in debug mode)
   */
  debug(message, data = null) {
    if (window.DEBUG_MODE) {
      console.log(`%c${this.CLIENT_PREFIX} 🐛 [DEBUG] ${message}`, 'color: #9E9E9E;');
      if (data) console.log(data);
    }
  }
};

// Export for use in modules
export { Logger };
