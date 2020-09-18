# event-custodian [![](https://img.shields.io/npm/v/event-custodian.svg)](https://www.npmjs.com/package/event-custodian) [![](https://img.shields.io/badge/source--000000.svg?logo=github&style=social)](https://github.com/fiverr/event-custodian) [![](https://circleci.com/gh/fiverr/event-custodian.svg?style=svg)](https://circleci.com/gh/fiverr/event-custodian)
## Control handlers for an event on an [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter)

```js
const Custodian = require('event-custodian');

// Reduce all existing listeners to one
const custodian = new Custodian(process, 'unhandledRejection');
```

Add a handler before all others
```js
custodian.prepend(
    (error) => process.stdout.write(
        JSON.stringify(
            error instanceof Error
                ? { level: 'critical', message: error.message, stack: error.stack, code: error.code }
                : { level: 'critical', message: `Unhandled rejection. Rejected with ${error}` }
        )
    )
);
```

Add a handler last
```js
custodian.append(() => console.log('{"message":"I am also here"}'));
```

Normal event handlers will be append (on poll stage)
```js
process.on('unhandledRejection', (error) => logger.error(error));
```

Remove all existing handlers
```js
custodian.purge();
```

Handle errors coming up from registered handlers
```js
custodian.on('error', (error) => logger.error(error));
```
### Important note about 'unhandledRejection'
If you use this application to manage 'unhandledRejection', you **must** set an on('error') handler. Otherwise the custodian will simply print the errors onto console.error.
