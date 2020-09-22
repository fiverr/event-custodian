const EventEmitter = require('events');

/**
* Remove all listerners from an event emitter by type
* @property {EventEmitter}  emitter The EventEmitter we monitor
* @property {string|symbol} type Event type
* @property {EventEmitter}  events Internal custodian instance events
* @property {function[]}    handlers Collection of functions to execute when event is fired
* @property {<string, function>{}} mounted Named collection of native emitter functions
* @returns {Custodian}
*/
module.exports = class Custodian {

    /**
     * @param {EventEmitter} emitter
     * @param {string|symbol} type The name of the event being listened for
     */
    constructor(emitter, type) {
        this.emitter = emitter;
        this.type = type;
        this.events = new EventEmitter();
        this.handler = (...args) => {
            const errors = [];

            // Iterating a copy of the handlers guarantees any mutation of the handler collection
            // will only take affect the next time this event is emitted
            [ ...this.handlers ].forEach(
                (handler) => {
                    // Run each handler in it's own quarantine. Collect errors
                    try {
                        handler.apply(this.emitter, args);
                    } catch (error) {
                        errors.push(error);
                    }
                }
            );
            if (errors.length) {

                // avoid unhandledRejection loop if no handler was registered
                if (
                    this.emitter === process &&
                    /unhandledRejection/i.test(this.type) &&
                    this.events.listenerCount('error') === 0
                ) {
                    this.events.on('error', (error) => console.error(error));
                }

                // Running over all handlers for each error O(n²)
                errors.forEach(
                    (error) => this.events.emit('error', error)
                );
            }
        };
    }

    /**
     * Reinstate native event listener
     * @returns {self}
     */
    unmount() {
        if (!this.mounted) {
            return this;
        }

        Object.entries(this.mounted).forEach(
            ([ key, value ]) => {
                this.emitter[key] = value;
                delete this.mounted[key];
            }
        );
        delete this.mounted;

        this.emitter.removeListener(
            this.type,
            this.handler
        );

        // Re attach to emitter as individual event handlers
        this.handlers.forEach(
            (handler) => this.emitter.on(this.type, handler)
        );

        return this;
    }

    /**
     * Override organic event listeners
     * @returns {self}
     */
    mount() {
        if (this.mounted) {
            return this;
        }
        this.handlers = this.emitter.listeners(this.type);
        this.mounted = {};

        // Remove all existing listeners
        this.emitter.removeAllListeners(this.type);

        // Engulf existing listener which controls the handlers execution
        this.emitter.on(
            this.type,
            this.handler
        );

        this.override({
            aliases: [ 'addListener', 'on' ],
            implementation: (type, handler, { once } = {}) => {
                once
                    ? this.emitter.once(type, handler)
                    : this.handlers.push(handler)
                ;
            }
        });

        this.override({
            aliases: [ 'prependListener' ],
            implementation: (type, handler, { once } = {}) => {
                once
                    ? this.emitter.prependOnceListener(type, handler)
                    : this.handlers.unshift(handler)
                ;
            }
        });

        this.override({
            aliases: [ 'prependOnceListener' ],
            implementation: (type, handler) => {
                const onceHandler = (...args) => {
                    this.emitter.removeListener(this.type, onceHandler);
                    handler.apply(this, args);
                };
                this.emitter.prependListener(this.type, onceHandler);
            }
        });

        this.override({
            aliases: [ 'once' ],
            implementation: (type, handler) => {
                const onceHandler = (...args) => {
                    this.emitter.removeListener(this.type, onceHandler);
                    handler.apply(this, args);
                };
                this.handlers.push(onceHandler);
            }
        });

        this.override({
            aliases: [ 'removeListener', 'off' ],
            implementation: (type, handler) => {
                const index = this.handlers.indexOf(handler);
                this.handlers.splice(index, 1);
            }
        });

        this.override({
            aliases: [ 'removeAllListeners' ],
            implementation: (/* type */) => {
                this.handlers.length = 0;
            }
        });

        return this;
    }

    /**
     * Override an organic event listener
     * @returns {self}
     */
    override({ aliases, implementation }) {
        aliases.forEach(
            (alias) => {
                this.mounted[alias] = this.emitter[alias];
                this.emitter[alias] = (...args) => {
                    const [ type ] = args;
                    if (type !== this.type) {
                        return this.mounted[alias].call(this.emitter, this.type, ...args);
                    }
                    implementation.apply(this, args);
                    return this.emitter;
                };
            }
        );

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
