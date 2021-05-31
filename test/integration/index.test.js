import BeanstalkdWorker from '../../src/index';
import {expect} from 'chai';
import Promise from 'bluebird';
import sinon from 'sinon';
import Job from '../../src/job';

const host = process.env.BEANSTALKD_PORT_11300_TCP_ADDR;
const port = process.env.BEANSTALKD_PORT_11300_TCP_PORT;

describe('BeanstalkdWorker', function () {
  beforeEach(function () {
    this.sinon = sinon.sandbox.create();
    this.worker = new BeanstalkdWorker(host, port);
    this.worker.start();
  });

  afterEach(function () {
    this.sinon.restore();

    return this.worker.stop();
  });

  it('should be able to spawn to a handler through a tube', function () {
    this.timeout(10000);

    let tube = Math.random().toString()
      , values = {};

    values[Math.random().toString()] = Math.random().toString();
    values[Math.random().toString()] = Math.random().toString();
    values[Math.random().toString()] = Math.random().toString();

    this.worker.handle(tube, function *(payload) {
      expect(payload).to.deep.equal(values);
      expect(this).to.be.an.instanceOf(Job);
      expect(this.id).to.be.ok;
    });

    return this.worker.spawn(tube, values).then(function (job) {
      return job.done();
    });
  });

  it('should be able to process multiple jobs sequentially', function () {
    this.timeout(10000);

    let tube = Math.random().toString()
      , values = {}
      , handleStub = this.sinon.stub().resolves();

    this.worker.handle(tube, handleStub);

    return Promise.join(
      this.worker.spawn(tube, values).then(function (job) {
        return job.done();
      }),
      this.worker.spawn(tube, values).then(function (job) {
        return job.done();
      }),
      this.worker.spawn(tube, values).then(function (job) {
        return job.done();
      })
    ).then(function () {
      expect(handleStub).to.have.been.calledThrice;
    });
  });

  it('should properly report working stats', async function () {
    this.timeout(10000);

    let tube = Math.random().toString()
      , values = {}
      , handleStub = this.sinon.stub().returns(Promise.delay(2000));

    expect(this.worker.working()).to.equal(false);
    this.worker.handle(tube, handleStub);

    expect(this.worker.working()).to.equal(false);

    this.worker.spawn(tube, values).then(function (job) {
      return job.done();
    });

    await Promise.delay(100);
    expect(this.worker.working()).to.equal(true);

    await Promise.delay(1000);
    expect(this.worker.working()).to.equal(true);

    await Promise.delay(1000);
    expect(this.worker.working()).to.equal(false);
  });

  it('should be able to process multiple jobs in parallel', function () {
    this.timeout(10000);

    let tube = Math.random().toString()
      , values = {}
      , handleStub = this.sinon.stub().returns(Promise.resolve());

    this.worker.handle(tube, handleStub, {
      width: 3
    });

    return Promise.join(
      this.worker.spawn(tube, values).then(function (job) {
        return job.done();
      }),
      this.worker.spawn(tube, values).then(function (job) {
        return job.done();
      }),
      this.worker.spawn(tube, values).then(function (job) {
        return job.done();
      })
    ).then(function () {
      expect(handleStub).to.have.been.calledThrice;
    });
  });

  it('should handle child job completion', function () {
    this.timeout(10000);

    let parentTube = Math.random().toString()
      , childTube = Math.random().toString()
      , childEntered = false;

    this.worker.handle(parentTube, function (payload) {
      return this.child(childTube, {});
    });

    this.worker.handle(childTube, function (payload) {
      childEntered = true;
      return Promise.resolve();
    });

    return this.worker.spawn(parentTube, {}).then(function (job) {
      return job.done();
    }).then(function () {
      expect(childEntered).to.equal(true);
    });
  });

  it('should fail if child job fails', function () {
    this.timeout(10000);

    let parentTube = Math.random().toString()
      , childTube = Math.random().toString();

    this.worker.handle(parentTube, function (payload) {
      return this.child(childTube, {});
    }, {
      tries: 1
    });

    this.worker.handle(childTube, function (payload) {
      return Promise.reject();
    }, {
      tries: 1
    });

    return expect(this.worker.spawn(parentTube, {}).then(function (job) {
      return job.done();
    })).to.be.rejected;
  });

  it('should wait for dependent jobs when called in handler', function () {
    this.timeout(10000);

    let dependencyTube = Math.random().toString()
      , dependentTube = Math.random().toString()
      , firstDoneAt = null;

    this.worker.handle(dependencyTube, function () {
      return Promise.delay(1000).then(function () {
        firstDoneAt = new Date();
      });
    });

    this.worker.handle(dependentTube, function (payload) {
      return this.wait(dependencyTube, payload.dependentJobId);
    });

    return this.worker.spawn(dependencyTube, {}).then((job) => {
      return this.worker.spawn(dependentTube, {
        dependentJobId: job.id
      }).then(function (job) {
        return job.done().then(function () {
          expect(firstDoneAt.valueOf()).to.be.below(Date.now());
        });
      });
    });
  });

  it('should handle resolving job failure with no retries', function () {
    this.timeout(10000);

    let tube = Math.random().toString()
      , handleLog = this.sinon.stub()
      , error = new Error('Arf!');

    this.worker.handle(tube, function (payload) {
      return Promise.reject(error);
    }, {
      tries: 1
    });

    return expect(this.worker.spawn(tube, {}).then(function (job) {
      return job.done();
    })).to.have.been.rejected;
  });

  it('should retry untill max tries', function () {
    this.timeout(10000);

    let tube = Math.random().toString();
    let handleStub = this.sinon.stub().rejects(new Error('Simulated error'));

    this.worker.handle(tube, handleStub, {
      tries: 3,
      backoff: {
        initial: 1000
      }
    });

    return expect(this.worker.spawn(tube, {}).then(function (job) {
      return job.done();
    })).to.have.been.rejected.then(function () {
      expect(handleStub).to.have.been.calledThrice;
    });
  });

  it('should allow manual delays / retries', function () {
    this.timeout(15000);

    let tube = Math.random().toString();
    let count = 0;
    let delays = [];

    this.worker.handle(tube, function () {
      return this.stats().then(stats => {
        delays.push(stats.delay);

        if (count === 0) {
          count++;
          return this.delay(1000);
        }
        if (count === 1) {
          count++;
          return this.delay(undefined, 1.1);
        }
        count++;
        return Promise.resolve();
      });
    });

    return this.worker.spawn(tube, {}).tap(function (job) {
      return job.done();
    }).then(function () {
      expect(count).to.equal(3);
      expect(delays).to.deep.equal([0, 1, 2]);
    });
  });

  it('should be kept alive by a longer running child job', function () {
    this.timeout(10000);

    let parentTube = Math.random().toString()
      , childTube = Math.random().toString()
      , timeout = 3000
      , childHandler = this.sinon.stub().returns(Promise.delay(timeout + 3000));

    this.worker.handle(childTube, childHandler);
    this.worker.handle(parentTube, function (payload) {
      return this.child(childTube, payload);
    });

    return this.worker.spawn(parentTube, {}, {
      timeout: timeout
    }).then(function (job) {
      return job.done();
    }).then(function () {
      expect(childHandler).to.have.been.calledOnce;
    });
  });

  it('should throw an internal timeout error before TTR to bury before release', function () {
    let tube = Math.random().toString()
      , timeout = 5000;

    this.timeout(timeout + 4000);

    this.worker.handle(tube, function () {
      return Promise.delay(timeout + 2000);
    }, {
      tries: 1
    });

    return expect(this.worker.spawn(tube, {}, {
      timeout: timeout
    }).then(function (job) {
      return job.done();
    })).to.have.been.rejected;
  });

  it('should be able to spawn and handle extremely large jobs', function () {
    this.timeout(10000);

    let values = {}
      , tube = Math.random().toString();

    for (let i = 0; i < 10000; i++) {
      values[Math.random().toString()] = Math.random().toString();
    }

    this.worker.handle(tube, function *(payload) {
      expect(payload).to.deep.equal(values);
    });

    return this.worker.spawn(tube, values).then(function (job) {
      return job.done();
    });
  });

  it('should be able to spawn and handle extremely large jobs in parallel', function () {
    this.timeout(10000);

    let values = {}
      , tube = Math.random().toString();

    for (let i = 0; i < 10000; i++) {
      values[Math.random().toString()] = Math.random().toString();
    }

    this.worker.handle(tube, async function (payload) {
      expect(payload).to.deep.equal(values);
    }, {
      width: 1
    });

    return Promise.join(
      this.worker.spawn(tube, values).then(function (job) {
        return job.done();
      }),
      this.worker.spawn(tube, values).then(function (job) {
        return job.done();
      }),
      this.worker.spawn(tube, values).then(function (job) {
        return job.done();
      }),this.worker.spawn(tube, values).then(function (job) {
        return job.done();
      })
    );
  });
});
