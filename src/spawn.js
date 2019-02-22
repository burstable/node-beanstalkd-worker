const Job = require('./job');

module.exports = function spawn(worker, tube, payload, options = {}) {
  if (!payload) {
    throw new Error('Job has no payload. Use an explicit empty payload ({}) if that is your intention');
  }

  let timeout = 10 * 60 * 1000;
  let priority = 1000;
  let delay = 0;

  if (options.timeout !== undefined) {
    timeout = options.timeout;
    delete options.timeout;
  }

  if (timeout < 3000) {
    console.warn('Jobs with timeouts less than 3000 are not likely to function properly with touching');
  }

  if (options.delay !== undefined) {
    delay = options.delay;
    delete options.delay;
  }

  if (options.priority !== undefined) {
    priority = options.priority;
    delete options.priority;
  }

  options.payload = payload;

  tube = worker.tube(tube);

  return tube
         .command('put', priority, delay / 1000, timeout / 1000, JSON.stringify(options))
         .then(function (id) {
           tube.debug('spawned job: ' + id);
           return new Job(worker, tube, id);
         });
};
