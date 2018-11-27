const Job = require('../../job');
const _ = require('lodash');
const Promise = require('bluebird');

function defer() {
  var resolve, reject;
  var promise = new Promise(function () {
    resolve = arguments[0];
    reject = arguments[1];
  });
  return {
    resolve: resolve,
    reject: reject,
    promise: promise
  };
}

/*
 * A job class with extra commands only available to the connection that has reserved the job
 */

module.exports =class WatcherJob extends Job {
  constructor(worker, tube, id, client) {
    super(worker, tube, id);

    this.client = client;
    this.$timeout = null;

    this.touch = _.throttle(() => {
      this._touch();
    }, 1000, {
      leading: true,
      trailing: true
    });
  }

  timeout(delay, action) {
    if (this.$timeout) {
      throw new Error('Only a single timeout can be active');
    }

    this.$timeout = setTimeout(() => {
      this.$timeout.defered.reject('Timed out!');
    }, delay);

    this.$timeout.defered = defer();
    this.$timeout.delay = delay;

    if (action) {
      action = Promise.resolve(action);

      action.then((result) => {
        this.$timeout.defered.resolve(result);
      }).catch((err) => {
        this.$timeout.defered.reject(err);
      }).finally(() => {
        this.cancelTimeout();
      });
    }

    return this.$timeout.defered.promise;
  }

  refreshTimeout() {
    if (!this.$timeout) return;

    let delay = this.$timeout.delay;
    let defered = this.$timeout.defered;

    clearTimeout(this.$timeout);

    this.$timeout = setTimeout(() => {
      this.$timeout.defered.reject('Timed out!');
    }, delay);

    this.$timeout.delay = delay;
    this.$timeout.defered = defered;
  }

  cancelTimeout() {
    if (this.$timeout) {
      clearTimeout(this.$timeout);
    }
    this.$timeout = null;
  }

  async _touch() {
    try {
      await this.client.touch(this.id);
      this.refreshTimeout();
      this.debug('touched');
    } catch (err) {
      this.error('unable to touch: ' + err.toString());
    }
  }

  async spawn(tube, payload, options) {
    return await this.worker.spawn(tube, payload, options);
  }

  async child(tube, payload, options) {
    let job = await this.spawn(tube, payload, options);

    try {
      await job.done(() => {
        this.touch();
      });
    } catch (err) {
      throw new Error(`Child job failed: ${err.toString()}`);
    }
  }

  async wait(tube, id) {
    await this.worker.done(tube, id, () => {
      this.touch();
    });
  }

  async delay(delay, exponent) {
    let stats = await this.stats();
    if (!delay) delay = stats.delay * 1000;
    if (exponent) delay = Math.pow(delay, exponent);

    delay = Math.ceil(delay / 1000) * 1000;
    await this._release(stats.pri, delay / 1000);

    this.debug(`Delayed ${delay}ms`);
    return DELAYED;
  }

  async _bury() {
    try {
      await this.client.bury(this.id, 0);
      this.debug(`buried`);
    } catch (err) {
      this.debug(`failed to bury: ${err.toString()}`);
    }
  }

  async _destroy() {
    try {
      await this.client.destroy(this.id);
      this.debug('destroyed');
    } catch (err) {
      this.debug(`failed to destroy: ${err.toString()}`);
    }
  }

  async _release(priority, delay) {
    try {
      await this.client.release(this.id, priority, delay);
      this.debug(`released with ${delay * 1000}ms delay`);
    } catch (err) {
      this.debug(`failed to release: ${err.toString()}`);
    }
  }
}

module.exports.DELAYED = 1;
