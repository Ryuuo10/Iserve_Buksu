const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

const PYTHON_CMD = process.env.AI_PIPELINE_PYTHON || 'python';
const SCRIPT_PATH = path.join(__dirname, '..', 'models', 'iserve_ai.py');
const STARTUP_TIMEOUT_MS = Number(process.env.AI_PIPELINE_STARTUP_TIMEOUT_MS || 60000);
const REQUEST_TIMEOUT_MS = Number(process.env.AI_PIPELINE_REQUEST_TIMEOUT_MS || 60000);
const MISSING_DEPENDENCY_PATTERN = /No module named ['"]([^'"]+)['"]/i;

let worker = null;
let readyPromise = null;
let requestId = 1;
const pending = new Map();
let disabledError = null;
let warmupStarted = false;

const cleanupWorker = (error) => {
  for (const { reject, timeout } of pending.values()) {
    clearTimeout(timeout);
    reject(error);
  }
  pending.clear();
  worker = null;
  readyPromise = null;
};

const startWorker = () => {
  if (disabledError) {
    return Promise.reject(disabledError);
  }

  if (readyPromise) {
    return readyPromise;
  }

  readyPromise = new Promise((resolve, reject) => {
    let startupResolved = false;
    let startupFailed = false;

    const failStartup = (error, { disable = false } = {}) => {
      if (disable) {
        disabledError = error;
      }

      clearTimeout(startupTimer);
      cleanupWorker(error);

      if (!startupResolved && !startupFailed) {
        startupFailed = true;
        reject(error);
      }
    };

    const child = spawn(PYTHON_CMD, [SCRIPT_PATH, '--worker'], {
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    worker = child;

    const startupTimer = setTimeout(() => {
      failStartup(new Error('AI worker startup timed out'));
    }, STARTUP_TIMEOUT_MS);

    const rl = readline.createInterface({ input: child.stdout });

    rl.on('line', (line) => {
      if (!line.trim()) {
        return;
      }

      let payload;
      try {
        payload = JSON.parse(line);
      } catch {
        return;
      }

      if (payload.type === 'ready') {
        clearTimeout(startupTimer);
        startupResolved = true;
        resolve();
        return;
      }

      if (payload.id == null) {
        return;
      }

      const entry = pending.get(payload.id);
      if (!entry) {
        return;
      }

      clearTimeout(entry.timeout);
      pending.delete(payload.id);

      if (payload.error) {
        entry.reject(new Error(payload.error));
        return;
      }

      entry.resolve(payload.result);
    });

    child.stderr.on('data', (chunk) => {
      const message = String(chunk).trim();
      if (message) {
        console.error('[ai_pipeline]', message);

        const missingDependency = message.match(MISSING_DEPENDENCY_PATTERN);
        if (missingDependency) {
          failStartup(
            new Error(`AI pipeline unavailable: missing Python package "${missingDependency[1]}"`),
            { disable: true }
          );
        }
      }
    });

    child.on('error', (error) => {
      failStartup(error);
    });

    child.on('exit', (code) => {
      if (startupResolved) {
        cleanupWorker(new Error(`AI worker exited with code ${code}`));
        return;
      }

      failStartup(disabledError || new Error(`AI worker exited with code ${code}`));
    });
  });

  return readyPromise;
};

const warmupAiWorker = async () => {
  if (warmupStarted) {
    return readyPromise || Promise.resolve();
  }

  warmupStarted = true;

  try {
    await startWorker();
    console.log('[ai_pipeline] Worker pre-warmed successfully');
  } catch (error) {
    warmupStarted = false;
    console.error('[ai_pipeline] Worker pre-warm failed:', error.message);
  }
};

const analyzeComplaint = async (text) => {
  await startWorker();

  if (!worker || !worker.stdin.writable) {
    throw new Error('AI worker is unavailable');
  }

  const id = requestId++;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(id);
      reject(new Error('AI analysis timed out'));
    }, REQUEST_TIMEOUT_MS);

    pending.set(id, { resolve, reject, timeout });

    try {
      worker.stdin.write(`${JSON.stringify({ id, text })}\n`);
    } catch (error) {
      clearTimeout(timeout);
      pending.delete(id);
      reject(error);
    }
  });
};

module.exports = {
  analyzeComplaint,
  warmupAiWorker,
};
