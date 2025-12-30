# NGX Memoize

A lightweight, zero-dependency TypeScript decorator tailored for Angular applications. It memoizes class methods to optimize performance, especially when calling methods directly from templates.

It effectively solves the performance overhead caused by Angular's Change Detection calling template methods repeatedly.

## Why use this?

In Angular, binding a method in a template (e.g., `{{ calculate(value) }}`) can be costly because Angular re-executes the method on every Change Detection cycle.
`ngx-memoize` ensures the method is executed **only when its arguments change**, caching the result for subsequent calls with the same arguments.

## Features

- 🚀 **Performance**: Drastically reduces computation by caching results.
- 🧹 **Auto Cleanup**: Automatically cleans up cached data when the component is destroyed (`ngOnDestroy`), preventing memory leaks.
- 📦 **Lightweight**: No external dependencies.

## Installation

```bash
npm install ngx-memoize
```

## Usage

### Basic Usage

Simply apply the `@Memoize()` decorator to your method.

```typescript
import { Component } from "@angular/core";
import { Memoize } from "ngx-memoize";

@Component({
  selector: "app-user-profile",
  template: `
    <!-- Without Memoize, this runs on every CD cycle. 
         With Memoize, it runs ONLY when user.id changes. -->
    <p>User Initial: {{ getInitial(user.name) }}</p>
  `,
})
export class UserProfileComponent {
  user = { id: 1, name: "Alice" };

  @Memoize()
  getInitial(name: string): string {
    console.log("Calculating initial..."); // Logs only when 'name' changes
    return name.charAt(0).toUpperCase();
  }
}
```

### Automatic Memory Management (Auto-Destroy)

By default, the decorator automatically hooks into the Angular lifecycle. When your component is destroyed (e.g., user navigates away), all cached results for that instance are immediately cleared from memory.

You don't need to do anything extra. It just works.

```typescript
@Memoize() // autoDestroy is true by default
heavyCalculation(val: number) {
  // ...
}

// ⚠️ IMPORTANT:
// For Angular to trigger the destroy hook (especially in AOT builds),
// your class MUST implement ngOnDestroy, even if it's empty.
ngOnDestroy() {}

```

### Manual Control & Disabling Auto-Destroy

In some cases, you might want to disable automatic cleanup (e.g., in a Singleton Service that never destroys) or you need to clear the cache manually while the component is still alive.

#### 1. Disabling Auto Destroy

You can disable the auto-cleanup behavior by passing `{ autoDestroy: false }`. **Warning:** If you do this, you become responsible for clearing the cache to avoid memory leaks.

```typescript
import { Memoize, clearMemoized } from "ngx-memoize";

@Injectable()
export class MyService implements OnDestroy {
  // Disable auto destroy because this service might live longer than expected
  // or you want to handle cleanup yourself.
  @Memoize({ autoDestroy: false })
  expensiveOperation(data: any) {
    // ...
  }

  // When YOU decide it's time to clean up:
  ngOnDestroy() {
    clearMemoized(this);
  }
}
```

#### 2. Manual Cache Clearing

Even with `autoDestroy: true`, you might want to force a refresh (e.g., if data inside the service changed but the arguments passed to the method didn't).

```typescript
export class DataComponent {
  @Memoize()
  processData(id: number) {
    return heavyStuff(id);
  }

  forceRefresh() {
    // Option A: Clear cache for a SPECIFIC method on this instance
    clearMemoized(this, "processData");

    // Option B: Clear cache for ALL methods on this instance
    clearMemoized(this);

    console.log("Cache cleared! Next call will re-calculate.");
  }
}
```

## How it works (Under the Hood)

1.  **Intercept**: The decorator wraps your original method.
2.  **Compare**: On each call, it performs a shallow comparison of the current arguments against the previous ones.
3.  **Cache**:
    - **Match**: Returns the stored result immediately (no re-execution).
    - **Mismatch**: Executes the method, saves the new args and result, and returns it.
4.  **Auto-Cleanup**: By default, it monkeys-patches `ngOnDestroy`. When Angular calls `ngOnDestroy`, the decorator intercepts it and `delete`s all cached properties from the instance, then calls your original `ngOnDestroy`.

## License

MIT
