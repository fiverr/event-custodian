const EventEmitter = require('events');

/**
* Remove all listerners from an event emitter by type
* @property {array} handlers Collection of functions to execute when event is fired
* @property {EventEmitter} events The EventEmitter we monitor
* @returns {Custodian}
*/
module.exports = class Custodian {

    /**
     * @param {EventEmitter} emitter
     * @param {string|symbol} name The name of the event being listened for
     */
    constructor(emitter, name) {
        this.handlers = emitter.listeners(name);
        this.events = new EventEmitter();

        // Remove all existing listeners
        emitter.removeAllListeners(name);

        // Set our own listener which controls the handlers execution
        emitter.on(
            name,
            (...args) => {
                const errors = [];

                // Run each handler in it's own quarantine. Collect errors
                this.handlers.forEach(
                    (handler) => {
                        try {
                            handler.apply(emitter, args);
                        } catch (error) {
                            errors.push(error);
                        }
                    }
                );
                if (errors.length) {

                    // avoid unhandledRejection loop if no handler was registered
                    if (
                        emitter === process &&
                        /unhandledRejection/i.test(name) &&
                        this.events.listenerCount('error') === 0
                    ) {
                        this.events.on('error', (error) => console.error(error));
                    }

                    // Running over all handlers for each error O(n²)
                    errors.forEach(
                        (error) => this.events.emit('error', error)
                    );
                }
            }
        );

        // Monitor for future listener subscriptions
        emitter.on(
            'newListener',
            (event, handler) => {
                if (event === name) {

                    // Here we are being notified that this will be attached, however, it is not yet attached until poll stage, and then we'll pick it up
                    setImmediate(() => {

                        // Add to handlers
                        this.append(handler);

                        // Remove as independent listener
                        emitter.removeListener(event, handler);
                    });
                }
            }
        );
    }

    /**
     * Add handler at the top of the stack (first)
     * @param {function} handler The event handler function
     * @returns {self}
     */
    prepend(handler) {
        this.handlers.unshift(handler);
        return this;
    }

    /**
     * Add handler at the bottom of the stack (last)
     * @param {function} handler The event handler function
     * @returns {self}
     */
    append(handler) {
        this.handlers.push(handler);
        return this;
    }

    /**
     * Remove all existing handlers for this event
     * @returns {self}
     */
    purge() {
        this.handlers.length = 0;
        return this;
    }

    /**
     * Add handler to this custodian
     * @param {string} type self event type
     * @param {function} handler Error handler function
     * @returns {self}
     */
    on(kind, handler) {
        this.events.on(kind, handler);
        return this;
    }

    /**
     * Remove handler(s) to this custodian
     * @param {string} type self event type
     * @param {function} [handler] Error handler function
     * @returns {self}
     */
    off(kind, handler) {
        handler
            ? this.events.removeListener(kind, handler)
            : this.events.removeAllListeners(kind)
        ;
        return this;
    }
};
