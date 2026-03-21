/** Request queue — serializes messages per chat, supports cancel via AbortController. */

type QueuedRequest<T> = {
  message: string;
  handler: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
};

const activeAbortControllers: Map<string, AbortController> = new Map();
const pendingQueues: Map<string, Array<QueuedRequest<unknown>>> = new Map();
const processingFlags: Map<string, boolean> = new Map();

export function getAbortController(sessionKey: string): AbortController | undefined {
  return activeAbortControllers.get(sessionKey);
}

export function setAbortController(sessionKey: string, controller: AbortController): void {
  activeAbortControllers.set(sessionKey, controller);
}

export function clearAbortController(sessionKey: string): void {
  activeAbortControllers.delete(sessionKey);
}

export function isProcessing(sessionKey: string): boolean {
  return processingFlags.get(sessionKey) === true;
}

export function getQueuePosition(sessionKey: string): number {
  const queue = pendingQueues.get(sessionKey);
  return queue ? queue.length : 0;
}

export async function queueRequest<T>(
  sessionKey: string,
  message: string,
  handler: () => Promise<T>
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const request: QueuedRequest<T> = {
      message,
      handler,
      resolve: resolve as (value: unknown) => void,
      reject,
    };

    let queue = pendingQueues.get(sessionKey);
    if (!queue) {
      queue = [];
      pendingQueues.set(sessionKey, queue);
    }
    queue.push(request as QueuedRequest<unknown>);

    processQueue(sessionKey);
  });
}

async function processQueue(sessionKey: string): Promise<void> {
  if (processingFlags.get(sessionKey)) {
    return;
  }

  const queue = pendingQueues.get(sessionKey);
  if (!queue || queue.length === 0) {
    return;
  }

  processingFlags.set(sessionKey, true);
  const request = queue.shift()!;

  try {
    const result = await request.handler();
    request.resolve(result);
  } catch (error) {
    request.reject(error instanceof Error ? error : new Error(String(error)));
  } finally {
    processingFlags.set(sessionKey, false);
    clearAbortController(sessionKey);

    if (queue.length > 0) {
      processQueue(sessionKey);
    }
  }
}

/** Cancel the running query via AbortController. */
export async function cancelRequest(sessionKey: string): Promise<boolean> {
  const controller = activeAbortControllers.get(sessionKey);
  if (controller) {
    controller.abort();
    clearAbortController(sessionKey);
    return true;
  }
  return false;
}

/** Reset: abort controller to fully tear down. */
export async function resetRequest(sessionKey: string): Promise<boolean> {
  return cancelRequest(sessionKey);
}

export function clearQueue(sessionKey: string): number {
  const queue = pendingQueues.get(sessionKey);
  if (!queue) return 0;

  const count = queue.length;
  for (const request of queue) {
    request.reject(new Error('Queue cleared'));
  }
  queue.length = 0;
  return count;
}
