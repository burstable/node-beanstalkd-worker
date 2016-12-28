import spawn from './spawn';
import Job from './job';
import Tube from './tube';
import _ from 'lodash';
import Beanstalkd from 'beanstalkd';
import Promise from 'bluebird';

export default class BeanstalkdWorker {
  constructor(host, port, options = {}) {
    this.host = host;
    this.port = port;
    this.options = options;
    this.tubes = {};
    this.dynamicTubes = [];
    this.connections = {};
    this.running = false;
  }

  async connection(id) {
    if (!this.connections[id]) {
      this.connections[id] = (new Beanstalkd(this.host, this.port)).connect();
    }

    let client = await Promise.resolve(this.connections[id]).timeout(10000, 'timed out connecting to beanstalkd (10000ms)');

    if (client.closed) {
      this.connections[id] = undefined;
      client = await this.connection(id);
    }

    return client;
  }

  tube(name) {
    if (!this.tubes[name]) {
      this.tubes[name] = new Tube(this, name);
    }
    return this.tubes[name];
  }

  spawn(tube, payload, options) {
    return spawn(this, tube, payload, options);
  }

  handle(tube, handler, options) {
    this.tube(tube).handle(handler, options);

    if (this.running) {
      this.startTubes();
    }
  }

  job(tube, jobId) {
    return new Job(this, this.tube(tube), jobId);
  }

  async done(tube, jobId, onPoll) {
    return await this.job(tube, jobId).done(onPoll);
  }

  start() {
    if (this.running) return;
    this.running = true;

    if (_.size(this.tubes)) {
      this.startTubes();
    }
  }

  startTubes() {
    Object.keys(this.tubes).forEach((name) => {
      this.tubes[name].start();
    });
  }

  async stop() {
    await this.stopTubes();

    let connections = await Promise.all(_.values(this.connections));
    await Promise.all(connections.map(function (connection) {
      return connection.quit();
    }));
  }

  async stopTubes() {
    await Promise.all(
      Object.keys(this.tubes).map(async (name) => {
        await this.tubes[name].stop();
      }).concat(
        this.dynamicTubes.map(async (tube) => {
          await tube.stop();
        })
      )
    );
  }

  working(tube) {
    let tubes = this.tubes;
    if (tube) {
      tubes = _.filter(tubes, (value, key) => key === tube);
    }

    return _.some(tubes, tube => tube.working());
  }
}
