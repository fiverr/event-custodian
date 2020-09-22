# event-custodian [![](https://img.shields.io/npm/v/event-custodian.svg)](https://www.npmjs.com/package/event-custodian) [![](https://img.shields.io/badge/source--000000.svg?logo=github&style=social)](https://github.com/fiverr/event-custodian) [![](https://circleci.com/gh/fiverr/event-custodian.svg?style=svg)](https://circleci.com/gh/fiverr/event-custodian)

Control handlers for an event set on an [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter)

## Usage

```js
const Custodian = require('event-custodian');
```

## TL;DR
```
new Custodian(emitter, 'event').mount().on('error', (error) => logger.error(error());

// Avoid errors in events that can cause the process to exit with SIGTERM
new Custodian(process, 'unhandledRejection').mount().on('error', (error) => logger.error(error());
```

## Reason
By overriding native behaviour we can verify existing event handlers run in a safe environment, within a try/catch block. This way we can avoid unexpected results, such as the process exiting unexpectedly within an event handler. We can later decide how we want to handle these errors by placing a general onerror handler on the custodian.

## Detailed example using process and "unhandledRejection"

```js
// Reduce all existing listeners to one
const custodian = new Custodian(process, 'unhandledRejection');

// Reduce all existing listeners to one
custodian.mount();

// Handle errors coming up from registered handlers
custodian.on('error', (error) => logger.error(error));

// Add, prepend, remove event handlers as normal
process.on('unhandledRejection', console.error)
    .prependListener('unhandledRejection', (error) => { ... })
    .off('unhandledRejection', console.error)
    .removeAllListeners('unhandledRejection');

// Custodian is now managing the call stack

// Revert to native subscription functions (remove override). Reinstate all existing handlers as individual event handlers
custodian.unmount();
```

### Important note about 'unhandledRejection'
If you use this application to manage `unhandledRejection`, you **must** set an `on('error')` handler. Otherwise the custodian will simply print the errors onto `console.error`.
