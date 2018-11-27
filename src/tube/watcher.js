const Promise = require('bluebird');
const WatcherJob = require('./watcher/job');

const { DELAYED } = WatcherJob;

const RESERVE_TIMEOUT = 30 * 1000;

module.exports = class Watcher {
  constructor(tube, index, handler, options = {}) {
    this.tube = tube;
    this.index = index;
    this.handler = handler;
    this.options = options || {};
    this.tries = this.options.tries || 3;
    this.backoff = this.options.backoff || {};
    this.backoff.initial = this.backoff.initial || 60 * 1000;
    this.backoff.exponential = this.backoff.exponential || 1.5;
    this.reconnectBackoff = this.options.reconnectBackoff || 1000;
  }

  async connection() {
    let client = await this.tube.connection(`watcher/${this.index}`);

    if (client.watching !== this.tube.name) {
      client.unref();

      await client.watch(this.tube.name);
      await client.ignore('default');

      client.watching = this.tube.name;
    }

    return client;
  }

  debug(...args) {
    this.tube.debug(...args);
  }

  current() {
    return this.$current;
  }

  start() {
    this.loop();
  }

  async stop() {
    await Promise.resolve(this.current()).reflect();
  }

  async loop() {
    if (!this.tube.running) return;

    try {
      let client = await this.connection();

      this.debug(`Reserving job, timeout: ${RESERVE_TIMEOUT}`);

      let [jobId, options] = await client.reserveWithTimeout(RESERVE_TIMEOUT);

      try {
        this.$current = this.run(jobId, options, client);
        await this.$current;
      } catch (err) {
        this.debug(`run error: ${err && err.toString()}`);
      }
    } catch (err) {
      if (err.message === 'TIMED_OUT') {
        return this.debug('reserve timed out');
      }
      if (err.message === 'DEADLINE_SOON') {
        await Promise.delay(500);
      }
      this.debug(`reserve error ${err.toString()}`);
      throw err; // rethrow to allow a reconnection to happen
    } finally {
      this.$current = null;
      setTimeout(() => this.loop(), this.reconnectBackoff);
    }
  }

  async run(jobId, options, client) {
    if (Buffer.isBuffer(options)) {
      options = JSON.parse(options.toString());
    }

    if (!options.payload) {
      // payload gets nested, if no payload key we treat it as a plain payload object
      options = {
        payload: options
      };
    }

    let job = new WatcherJob(this.tube.worker, this.tube, jobId, client);

    let stats = await job.stats();
    let tries = stats.reserves;
    let timeout = stats.ttr * 1000;

    job.debug(`running, try: ${tries}, timeout: ${timeout}`);
    let result = null;
    try {
      result = await job.timeout(timeout - 1000, this.handler.call(job, options && options.payload));

      if (result === DELAYED) {
        return;
      }
      job.debug(`completed`);
    } catch (err) {
      if (tries >= this.tries) {
        await job._bury();
        throw err;
      }

      let delay = this.backoff.initial / 1000;
      if (tries > 1) {
        delay = delay * (tries - 1) * this.backoff.exponential;
      }
      delay = Math.ceil(delay);

      await job._release(0, delay);

      throw err;
    } finally {
      job.cancelTimeout();
    }

    // Destroy job from beanstalkd if we completed successfully
    await job._destroy();
  }
}
