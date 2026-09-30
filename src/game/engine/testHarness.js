const windowListeners = new Map();

export function installDomStubs() {
  if (globalThis.window) return;

  globalThis.window = {
    devicePixelRatio: 1,

    addEventListener(type, handler) {
      if (!windowListeners.has(type)) {
        windowListeners.set(type, new Set());
      }

      windowListeners.get(type).add(handler);
    },

    removeEventListener(type, handler) {
      windowListeners.get(type)?.delete(handler);
    },
  };

  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
}

export function pressKey(code) {
  for (const handler of windowListeners.get("keydown") ??
    []) {
    handler({ code, repeat: false, preventDefault() {} });
  }
}

export function createTestCanvas() {
  const listeners = {};
  const store = {};

  const context = new Proxy(store, {
    get(target, key) {
      if (key in target) return target[key];
      return () => {};
    },
    set(target, key, value) {
      target[key] = value;
      return true;
    },
  });

  return {
    listeners,

    element: {
      getContext: () => context,

      addEventListener(type, handler) {
        (listeners[type] ??= []).push(handler);
      },

      removeEventListener(type, handler) {
        listeners[type] = (listeners[type] ?? []).filter(
          (item) => item !== handler,
        );
      },

      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 1280,
        height: 720,
      }),
    },
  };
}
