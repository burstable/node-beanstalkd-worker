const Promise = require('bluebird');
const debug = require('debug');

module.exports = class Job {
  constructor(worker, tube, id) {
    this.worker = worker;
    this.tube = tube;
    this.id = id;
    this.debug = debug(`beanstalkd-worker:${tube.name}/${id}`);
    this.error = debug(`beanstalkd-worker:${tube.name}/${id}:error`);
  }

  async command(command, ...args) {
    return await this.tube.command(command, ...args);
  }

  stats(catchNotFound) {
    return this.command('statsJob', this.id).catch(function (err) {
      if (catchNotFound && err && err.message === 'NOT_FOUND') return null;
      throw err;
    });
  }

  async status() {
    let stats = await this.stats(true);
    return Job.status(stats);
  }

  async done(onPoll) {
    let stats = await this.stats(true).catch(console.error.bind(console));


    if (!stats) return null;
    if (onPoll) onPoll(stats.state);

    if (stats.state === 'buried') {
      throw new Error('buried');
    }

    await Promise.delay(500);

    await this.done(onPoll);
  }
}

Job.status = function (stats) {
  if (!stats) return 'success';
  return stats.state;
};
