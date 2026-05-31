(function initCrosswordLogger(globalObject) {
  const LOG_STORAGE_KEY = 'crosswordDebugLogs';
  const MAX_LOG_ENTRIES = 800;
  const MAX_STRING_LENGTH = 800;
  const FLUSH_DELAY_MS = 250;

  let activeContext = 'unknown';
  let pendingEntries = [];
  let flushTimer = null;
  let patchApplied = false;

  const originalConsole = {
    log: console.log.bind(console),
    info: (console.info || console.log).bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: (console.debug || console.log).bind(console)
  };

  function trimString(value) {
    const normalized = String(value);
    if (normalized.length <= MAX_STRING_LENGTH) {
      return normalized;
    }

    return `${normalized.slice(0, MAX_STRING_LENGTH)}...[truncated]`;
  }

  function serializeArg(value) {
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack
      };
    }

    if (typeof value === 'string') {
      return trimString(value);
    }

    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    try {
      return JSON.parse(trimString(JSON.stringify(value)));
    } catch {
      return trimString(String(value));
    }
  }

  async function readStoredLogs() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        const data = await chrome.storage.local.get(LOG_STORAGE_KEY);
        return Array.isArray(data[LOG_STORAGE_KEY]) ? data[LOG_STORAGE_KEY] : [];
      } catch {
        return [];
      }
    }

    try {
      const raw = localStorage.getItem(LOG_STORAGE_KEY);
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async function writeStoredLogs(logs) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      try {
        await chrome.storage.local.set({ [LOG_STORAGE_KEY]: logs });
      } catch {
        // no-op
      }
      return;
    }

    try {
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
    } catch {
      // no-op
    }
  }

  async function flushPendingEntries() {
    if (pendingEntries.length === 0) {
      return;
    }

    const batch = pendingEntries;
    pendingEntries = [];

    const existing = await readStoredLogs();
    const merged = existing.concat(batch);
    const normalized = merged.slice(-MAX_LOG_ENTRIES);

    await writeStoredLogs(normalized);
  }

  function scheduleFlush() {
    if (flushTimer) {
      return;
    }

    flushTimer = setTimeout(async () => {
      flushTimer = null;
      await flushPendingEntries();
    }, FLUSH_DELAY_MS);
  }

  function collectEntry(level, args) {
    const entry = {
      ts: new Date().toISOString(),
      level,
      context: activeContext,
      args: args.map(serializeArg)
    };

    pendingEntries.push(entry);
    scheduleFlush();
  }

  function patchConsole() {
    if (patchApplied) {
      return;
    }

    patchApplied = true;

    ['log', 'info', 'warn', 'error', 'debug'].forEach(level => {
      console[level] = (...args) => {
        try {
          collectEntry(level, args);
        } catch {
          // Never block normal console output.
        }

        originalConsole[level](...args);
      };
    });

    if (typeof globalObject.addEventListener === 'function') {
      globalObject.addEventListener('error', event => {
        const error = event.error;
        collectEntry('error', [
          'window.error',
          {
            message: event.message,
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            stack: error && error.stack
          }
        ]);
      });

      globalObject.addEventListener('unhandledrejection', event => {
        collectEntry('error', ['unhandledrejection', serializeArg(event.reason)]);
      });
    }
  }

  async function getLogs() {
    await flushPendingEntries();
    return readStoredLogs();
  }

  async function clearLogs() {
    pendingEntries = [];

    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }

    await writeStoredLogs([]);
  }

  async function exportSnapshot(extra = {}) {
    const logs = await getLogs();
    return {
      generatedAt: new Date().toISOString(),
      context: activeContext,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      location: typeof location !== 'undefined' ? {
        href: location.href,
        host: location.host,
        pathname: location.pathname
      } : null,
      extra,
      logs
    };
  }

  const loggerApi = {
    install(options = {}) {
      activeContext = options.context || activeContext;
      patchConsole();
      return loggerApi;
    },
    getLogs,
    clearLogs,
    exportSnapshot
  };

  globalObject.crosswordLogger = loggerApi;
})(typeof globalThis !== 'undefined' ? globalThis : window);
