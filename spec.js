const EventEmitter = require('events');
const wait = require('@lets/wait');
const Custodian = require('.');

const existing = [];
const results = [];
const errors = [];

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
        new Custodian(process, 'unhandledRejection');
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

    test('add event handler first', () => {
        const emitter = new EventEmitter();
        emitter.on('event', () => results.push('I am here'));
        emitter.on('event', () => results.push('And I am also here'));

        const custodian = new Custodian(emitter, 'event');
        custodian.prepend(() => results.push('I am first'));

        emitter.emit('event');
        expect(results).toEqual([
            'I am first',
            'I am here',
            'And I am also here'
        ]);
    });

    test('add event handler last', () => {
        const emitter = new EventEmitter();
        emitter.on('event', () => results.push('I am here'));
        emitter.on('event', () => results.push('And I am also here'));

        const custodian = new Custodian(emitter, 'event');
        custodian.append(() => results.push('I am last'));

        emitter.emit('event');
        expect(results).toEqual([
            'I am here',
            'And I am also here',
            'I am last'
        ]);
    });

    test('new handlers are pulled into the custodian', async() => {
        const emitter = new EventEmitter();
        emitter.on('event', () => results.push('I am here'));
        emitter.on('event', () => results.push('And I am also here'));
        new Custodian(emitter, 'event');

        emitter.on('event', () => results.push('And finally, we were three'));
        expect(emitter.listeners('event')).toHaveLength(2);
        await wait(10);
        expect(emitter.listeners('event')).toHaveLength(1);

        emitter.emit('event');
        expect(results).toEqual([
            'I am here',
            'And I am also here',
            'And finally, we were three'
        ]);
    });

    test('purge all existing listeners', () => {
        const emitter = new EventEmitter();
        emitter.on('event', () => results.push('I am here'));
        emitter.on('event', () => results.push('And I am also here'));
        const custodian = new Custodian(emitter, 'event');
        custodian.purge();

        emitter.emit('event');
        expect(results).toHaveLength(0);
    });

    test('handlers isolation, errors are caught and reported', () => {
        const emitter = new EventEmitter();
        emitter.on('event', () => results.push('I am here'));
        emitter.on('event', () => results.push('And I am also here'));
        emitter.on('event', () => {
            throw new Error('Something must have gone horribly wrong');
        });
        emitter.on('event', () => results.push('And finally, we were three'));
        const custodian = new Custodian(emitter, 'event');
        custodian.on('error', (error) => {
            expect(error.message).toBe('Something must have gone horribly wrong');
            errors.push(error);
        });

        emitter.emit('event');
        expect(results).toEqual([
            'I am here',
            'And I am also here',
            'And finally, we were three'
        ]);
        expect(errors).toHaveLength(1);
    });

    test('no error handler trigger unhandled error', () => {
        const emitter = new EventEmitter();
        emitter.on('event', () => {
            throw new Error('Something must have gone horribly wrong');
        });
        new Custodian(emitter, 'event');
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
        const custodian = new Custodian(emitter, 'event');
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
        emitter.on('event', () => results.push('I am here'));
        emitter.on('event', () => results.push('And I am also here'));
        new Custodian(emitter, 'event')
            .purge()
            .on('error', () => null)
            .append(() => results.push('I am last'))
            .prepend(() => results.push('I am first'))
        ;

        emitter.emit('event');
        expect(results).toEqual([
            'I am first',
            'I am last'
        ]);
    });
});
