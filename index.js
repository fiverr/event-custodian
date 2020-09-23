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

        // Replace prototype handler with an instance bound one
        this.handler = this.handler.bind(this);
    }

    /**
     * Override organic event listeners
     * @returns {self}
     */
    mount() {
        if (this.mounted) { return this; }
        this.mounted = {};

        // Collect existing listeners
        this.handlers = this.emitter.listeners(this.type);

        // Remove all existing listeners
        this.emitter.removeAllListeners(this.type);

        // Create our single listener which controls the handlers execution
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
     * Reinstate native event listener
     * @returns {self}
     */
    unmount() {
        if (!this.mounted) { return this; }

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
     * Add handler to this custodian
     * @param {string} type      Event type to be triggered on the custodian instance
     * @param {function} handler Error handler function
     * @returns {self}
     */
    on(kind, handler) {
        this.events.on(kind, handler);

        return this;
    }

    /**
     * Remove handler(s) from this custodian
     * @param {string} type        Event type to be triggered on the custodian instance
     * @param {function} [handler] Error handler function. When this argument is missing - all listeners will be removed
     * @returns {self}
     */
    off(kind, handler) {
        handler
            ? this.events.removeListener(kind, handler)
            : this.events.removeAllListeners(kind)
        ;

        return this;
    }

    // Not officially part of the interface

    /**
     * Override an organic event listener
     * @param {string[]} o.aliases        List of function names to override
     * @param {function} o.implementation New functionality
     * @returns {self}
     */
    override({ aliases, implementation }) {
        aliases.forEach(
            (alias) => {
                this.mounted[alias] = this.emitter[alias];
                this.emitter[alias] = (type, ...args) => {
                    if (type !== this.type) {
                        return this.mounted[alias].call(this.emitter, this.type, ...args);
                    }
                    implementation.call(this, type, ...args);
                    return this.emitter;
                };
            }
        );

        return this;
    }

    /**
     * @param {...any}
     * @returns {self}
     */
    handler(...args) {

        // Iterating a copy of the handlers guarantees any mutation of the handler collection
        // will only take affect the next time this event is emitted
        [ ...this.handlers ].forEach(
            (handler) => {
                // Run each handler in it's own quarantine. Collect errors
                try {
                    handler.apply(this.emitter, args);
                } catch (error) {
                    this.verifyErrorHandler();
                    this.events.emit('error', error);
                }
            }
        );

        return this;
    }

    /**
     * Avoid unhandledRejection loop if no handler was registered
     * @returns {void}
     */
    verifyErrorHandler() {
        if (
            this.emitter === process &&
            /unhandledRejection/i.test(this.type) &&
            this.events.listenerCount('error') === 0
        ) {
            this.events.on('error', (error) => console.error(error));
        }
    }
};
