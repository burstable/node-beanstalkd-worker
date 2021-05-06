import Watcher from './tube/watcher';
import debug from 'debug';
import Promise from 'bluebird';

export default class Tube {
  constructor(worker, name) {
    if (typeof name !== 'string') throw new Error('Tube name must be a string');

    this.worker = worker;
    this.name = name;
    this.debug = debug('beanstalkd-worker:' + name);

    /* Handling options */
    this.running = false;
    this.width = 1;
    this.watchers = [];
  }

  async connection(id) {
    console.info('Creating connection...');
    let client = await this.worker.connection(`${this.name}/${id}`);

    if (id === 'command' && client.using !== this.name) {
      await client.use(this.name);
      client.using = this.name;
    }

    return client;
  }

  command(command, ...args) {
    return this.connection('command').call(command, ...args);
  }

  handle(handler, options) {
    options = options || {};
    if (options.width) {
      this.width = options.width;
    }

    for (let i = 0; i < this.width; i++) {
      let watcher = new Watcher(this, i, handler, options);
      this.watchers.push(watcher);
    }
  }

  start() {
    if (this.running) return;
    this.running = true;

    this.debug('Starting watchers');

    const onError = this.worker.options.onError;

    this.watchers.forEach(function (watcher) {
      watcher.start({
        onError,
      });
    });
  }

  async stop() {
    this.running = false;

    this.debug('Stopping watchers');

    await Promise.all(this.watchers.map(async (watcher) => {
      await watcher.stop();
    }));

    this.debug('Watchers stopped');
  }

  working() {
    return this.watchers.some(watcher => watcher.$current);
  }
}
