/**
 * Options for the Memoize decorator
 */

export interface MemoizeOptions {
  /**
   * If true, automatically clears the cache when the component is destroyed.
   * Requires the class to (implicitly or explicitly) implement ngOnDestroy.
   * Default: true
   */

  autoDestroy?: boolean;

  /**
   * Strategy for comparing arguments to determine if the cache is valid.
   * - 'ref': (Default) Shallow comparison. Checks reference equality for objects. Fast but doesn't detect deep changes if the object reference is the same.
   * - 'json': Serializes arguments to JSON. Slower but detects changes in object properties even if the reference is the same.
   */
  strategy?: "ref" | "json";
}

/**
 * Interface to type the cache object
 */

interface MemoizeCache {
  lastArgs: any[] | undefined;
  lastArgsJson?: string;
  lastResult: any;
  initialized: boolean;
}

const MEMOIZE_Registry = Symbol("__ngx_memoize_registry__");

/**
 * Memoize Decorator for Angular methods
 * Caches the result of the method based on arguments.
 * Useful for methods called in templates to prevent unnecessary recalculations.
 */

export function Memoize(
  options: MemoizeOptions = { autoDestroy: true, strategy: "ref" }
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const cacheKey = Symbol(`__memoize_cache_${propertyKey}`);
    // Register this property for cleanup/management
    if (!target[MEMOIZE_Registry]) {
      target[MEMOIZE_Registry] = [];
    }

    target[MEMOIZE_Registry].push({ propertyKey, cacheKey });
    // Handle Auto Destroy
    if (options.autoDestroy) {
      ensureNgOnDestroy(target);
    }

    descriptor.value = function (...args: any[]) {
      // Initialize cache storage for this instance if not exists
      if (!(this as any)[cacheKey]) {
        Object.defineProperty(this, cacheKey, {
          configurable: true, // Must be configurable to be deleted
          enumerable: false,
          writable: true,
          value: {
            lastArgs: undefined,
            lastArgsJson: undefined,
            lastResult: undefined,
            initialized: false,
          },
        });
      }

      const cache = (this as any)[cacheKey];
      const strategy = options.strategy || "ref";
      let isValidHit = false;

      if (cache && cache.initialized) {
        if (strategy === "json") {
          // JSON Strategy: Compare stringified versions
          // Note: We calculate current JSON here, passing it would be optimized but let's keep it simple
          const currentJson = JSON.stringify(args);
          if (currentJson === cache.lastArgsJson) {
            isValidHit = true;
          }
        } else {
          // Default Ref Strategy
          if (argsAreSame(cache.lastArgs, args)) {
            isValidHit = true;
          }
        }
      }

      if (isValidHit) {
        return cache.lastResult;
      }

      // Execute original method
      const result = originalMethod.apply(this, args);

      // Update cache
      if ((this as any)[cacheKey]) {
        const cacheObj = (this as any)[cacheKey];
        cacheObj.lastResult = result;
        cacheObj.initialized = true;

        if (strategy === "json") {
          cacheObj.lastArgsJson = JSON.stringify(args);
          // clear lastArgs to avoid confusion or memory leaks if switching strategies (though unlikely)
          cacheObj.lastArgs = undefined;
        } else {
          cacheObj.lastArgs = args;
          cacheObj.lastArgsJson = undefined;
        }
      }
      return result;
    };
    return descriptor;
  };
}

/**
 * Manually clears the memoization cache for a specific method on an instance.
 * @param instance The component/class instance
 * @param methodName The name of the method to clear (optional). If not provided, clears all memoized methods.
 */

export function clearMemoized(instance: any, methodName?: string) {
  // We need to find the symbols. Since we can't easily access the closures symbols from outside,
  // we use the registry we created on the prototype.
  const registry = instance.constructor.prototype[MEMOIZE_Registry] as Array<{
    propertyKey: string;
    cacheKey: symbol;
  }>;

  if (!registry) return;

  registry.forEach((item) => {
    if (!methodName || item.propertyKey === methodName) {
      if (instance.hasOwnProperty(item.cacheKey)) {
        delete instance[item.cacheKey];
      }
    }
  });
}

/**
 * Ensures that ngOnDestroy is patched to clean up caches
 */

function ensureNgOnDestroy(target: any) {
  const originalOnDestroy = target.ngOnDestroy;
  // Use a flag to ensure we only patch once per class
  if (target["__ngx_memoize_patched__"]) return;
  target["__ngx_memoize_patched__"] = true;
  target.ngOnDestroy = function () {
    // 1. Clear all caches for this instance
    clearMemoized(this);
    // 2. Call original ngOnDestroy if it existed
    if (originalOnDestroy && typeof originalOnDestroy === "function") {
      originalOnDestroy.apply(this);
    }
  };
}

/**
 * Shallow comparison of argument arrays
 */

function argsAreSame(prev: any[] | undefined, next: any[]): boolean {
  if (prev === undefined) return false;
  if (prev.length !== next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    if (prev[i] !== next[i]) {
      return false;
    }
  }
  return true;
}
