const EventEmitter = require('events');
const Custodian = require('.');

const existing = [];
const results = [];
const errors = [];

/**
 * Create an EventEmitter with two listeners on type 'event'
 * @returns {EventEmitter}
 */
function basic() {
    const emitter = new EventEmitter();
    emitter.on('event', () => results.push('one'));
    emitter.on('event', () => results.push('two'));

    const custodian = new Custodian(emitter, 'event').mount();

    return { emitter, custodian };
}

describe('event-custodian', () => {
    beforeAll(
        () => existing.push(...process.listeners('unhandledRejection'))
    );
    afterEach(() => {
        results.length = 0;
        errors.length = 0;
    });
    afterAll(
        () => existing.forEach(
            (handler) => process.on(
                'unhandledRejection',
                handler
            )
        )
    );

    test('replace all event listeners with one', () => {
        expect(process.listeners('unhandledRejection')).toHaveLength(existing.length);
        process.on('unhandledRejection', () => results.push('I am here'));
        process.on('unhandledRejection', () => results.push('And I am also here'));
        expect(process.listeners('unhandledRejection')).toHaveLength(existing.length + 2);
        new Custodian(process, 'unhandledRejection').mount();
        expect(process.listeners('unhandledRejection')).toHaveLength(1);
    });

    test('avoid unhandledRejection loopback', () => {
        jest.spyOn(console, 'error');
        const error = new Error('Something must have gone horribly wrong');
        process.on('unhandledRejection', () => { throw error; });
        new Custodian(process, 'unhandledRejection');
        process.emit('unhandledRejection', new Error('something'));
        expect(console.error).toBeCalledWith(error);
    });

    test('prepend event handler', () => {
        const { emitter } = basic();
        emitter.prependListener('event', () => results.push('three'));
        emitter.emit('event');
        expect(results).toEqual([
            'three', 'one', 'two'
        ]);
        emitter.emit('event');
        expect(results).toEqual([
            'three', 'one', 'two',
            'three', 'one', 'two'
        ]);
    });

    test('append event handler', () => {
        const { emitter } = basic();
        emitter.on('event', () => results.push('three'));
        emitter.emit('event');
        expect(results).toEqual([
            'one', 'two', 'three'
        ]);
        emitter.emit('event');
        expect(results).toEqual([
            'one', 'two', 'three',
            'one', 'two', 'three'
        ]);
    });

    test.each([
        [ 'on', 'off' ],
        [ 'addListener', 'removeListener' ]
    ])('Add and remove listeners using %s and %s', (add, remove) => {
        const handlers = [
            () => results.push('one'),
            () => results.push('two'),
            () => results.push('three')
        ];
        const emitter = new EventEmitter();
        handlers.forEach((handler) => emitter[add]('event', handler));
        new Custodian(emitter, 'event').mount();
        emitter.emit('event');
        expect(results).toEqual([
            'one', 'two', 'three'
        ]);
        emitter[remove]('event', handlers[1]);
        emitter.emit('event');
        expect(results).toEqual([
            'one', 'two', 'three',
            'one', 'three'
        ]);
    });

    test('append event handler once', () => {
        const { emitter } = basic();
        emitter.on('event', () => results.push('three'), { once: true });
        emitter.emit('event');
        expect(results).toEqual([
            'one', 'two', 'three'
        ]);
        emitter.emit('event');
        expect(results).toEqual([
            'one', 'two', 'three',
            'one', 'two'
        ]);
    });

    test('prepend event handler once', () => {
        const { emitter } = basic();
        emitter.prependListener('event', () => results.push('three'), { once: true });
        emitter.emit('event');
        expect(results).toEqual([
            'three', 'one', 'two'
        ]);
        emitter.emit('event');
        expect(results).toEqual([
            'three', 'one', 'two',
            'one', 'two'
        ]);
    });

    test('prependOnce event handler', () => {
        const { emitter } = basic();
        emitter.prependOnceListener('event', () => results.push('three'));
        emitter.emit('event');
        expect(results).toEqual([
            'three', 'one', 'two'
        ]);
        emitter.emit('event');
        expect(results).toEqual([
            'three', 'one', 'two',
            'one', 'two'
        ]);
    });

    test('remove all listeners', () => {
        const { emitter } = basic();
        emitter.emit('event');
        expect(results).toEqual([
            'one', 'two'
        ]);
        emitter.removeAllListeners('event');
        emitter.emit('event');
        expect(results).toEqual([
            'one', 'two'
        ]);
    });

    test('pass arguments to event', () => {
        const emitter = new EventEmitter();
        emitter.on('event', (...args) => results.push(...args));
        new Custodian(emitter, 'event').mount();
        emitter.emit('event', 'one', 'two', 'three');
        expect(results).toEqual([
            'one', 'two', 'three'
        ]);
    });

    test('new handlers are pulled into the custodian', async() => {
        const { emitter } = basic();
        emitter.on('event', () => results.push('three'));
        expect(emitter.listeners('event')).toHaveLength(1);
    });

    test('unmount custodian', async() => {
        const emitter = new EventEmitter();
        emitter.on('event', () => results.push('one'));
        emitter.on('event', () => results.push('two'));
        expect(emitter.listeners('event')).toHaveLength(2);
        const custodian = new Custodian(emitter, 'event').mount();
        expect(emitter.listeners('event')).toHaveLength(1);
        custodian.unmount();
        expect(emitter.listeners('event')).toHaveLength(2);
        emitter.emit('event');
        expect(results).toEqual([
            'one', 'two'
        ]);
    });

    test('handlers isolation, errors are caught and reported', () => {
        const { emitter, custodian } = basic();
        emitter.on('event', () => {
            throw new Error('Something must have gone horribly wrong');
        });
        emitter.on('event', () => results.push('three'));
        custodian.on('error', (error) => {
            expect(error.message).toBe('Something must have gone horribly wrong');
            errors.push(error);
        });

        emitter.emit('event');
        expect(results).toEqual([
            'one',
            'two',
            'three'
        ]);
        expect(errors).toHaveLength(1);
    });

    test('no error handler trigger unhandled error', () => {
        const emitter = new EventEmitter();
        emitter.on('event', () => {
            throw new Error('Something must have gone horribly wrong');
        });
        new Custodian(emitter, 'event').mount();
        expect(() => emitter.emit('event')).toThrow();
        try {
            emitter.emit('event');
        } catch ({ code }) {
            expect(code).toBe('ERR_UNHANDLED_ERROR');
        }
    });

    test('removal of error handler', () => {
        const second = [];
        const third = [];
        const emitter = new EventEmitter();
        emitter.on('event', () => {
            throw new Error('Something must have gone horribly wrong');
        });
        const custodian = new Custodian(emitter, 'event').mount();
        custodian.on('error', (error) => errors.push(error));

        emitter.emit('event');
        expect(errors).toHaveLength(1);
        expect(second).toHaveLength(0);
        expect(third).toHaveLength(0);

        custodian.on('error', (error) => second.push(error));
        emitter.emit('event');
        expect(errors).toHaveLength(2);
        expect(second).toHaveLength(1);
        expect(third).toHaveLength(0);

        custodian.off('error');
        custodian.on('error', (error) => third.push(error));
        emitter.emit('event');
        expect(errors).toHaveLength(2);
        expect(second).toHaveLength(1);
        expect(third).toHaveLength(1);
    });

    test('function chaining', () => {
        const emitter = new EventEmitter();
        emitter.on('event', () => results.push('I am here'))
            .on('event', () => results.push('And I am also here'));
        new Custodian(emitter, 'event').mount();

        emitter.removeAllListeners('event')
            .on('event', () => results.push('I am last'))
            .prependListener('event', () => results.push('I am first'))
        ;

        emitter.emit('event');
        expect(results).toEqual([
            'I am first',
            'I am last'
        ]);
    });
});
