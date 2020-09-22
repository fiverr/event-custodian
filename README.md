# event-custodian [![](https://img.shields.io/npm/v/event-custodian.svg)](https://www.npmjs.com/package/event-custodian) [![](https://img.shields.io/badge/source--000000.svg?logo=github&style=social)](https://github.com/fiverr/event-custodian) [![](https://circleci.com/gh/fiverr/event-custodian.svg?style=svg)](https://circleci.com/gh/fiverr/event-custodian)
## Control handlers for an event on an [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter)

```js
const Custodian = require('event-custodian');
```

Reduce all existing listeners to one
```js
const custodian = new Custodian(process, 'unhandledRejection');
```

Override native event subscription functions
```js
custodian.mount();
```

Handle errors coming up from registered handlers
```js
custodian.on('error', (error) => logger.error(error));
```

Add, prepend, remove event handlers as normal
```js
process.on('unhandledRejection', console.error)
    .prepend('unhandledRejection', (error) => { ... })
    .off('unhandledRejection', console.error)
    .removeAllListeners('unhandledRejection');
```
Custodian is now managing the call stack

Revert to native subscription functions (remove override). Reinstate all existing handlers as individual event handlers
```js
custodian.unmount();
```

### Important note about 'unhandledRejection'
If you use this application to manage 'unhandledRejection', you **must** set an on('error') handler. Otherwise the custodian will simply print the errors onto console.error.
