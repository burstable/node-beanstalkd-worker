var chai = require('chai')
  , expect = chai.expect
  , sinon = require('sinon')
  , Promise = require('bluebird')
  , WatcherJob = require('tube/watcher/job').default
  , Watcher = require('tube/watcher');

describe('Watcher', function () {
  describe('run', function () {
    beforeEach(function () {
      this.sinon = sinon.sandbox.create();

      this.buryStub = this.sinon.stub(WatcherJob.prototype, '_bury').resolves();
      this.statsStub = this.sinon.stub(WatcherJob.prototype, 'stats').resolves({
        ttr: 5,
        reserves: 0
      });
      this.waitStub = this.sinon.stub(WatcherJob.prototype, 'wait');
      this.timeoutSpy = this.sinon.spy(WatcherJob.prototype, 'timeout');
      this.destroyStub = this.sinon.stub(WatcherJob.prototype, '_destroy').resolves();
      this.releaseStub = this.sinon.stub(WatcherJob.prototype, '_release').resolves();

      this.handler = this.sinon.stub().resolves(),
      this.watcher = new Watcher({burstable: {}}, 0, this.handler, {
        maxTries: 3
      });
    });

    afterEach(function () {
      this.sinon.restore();
    });

    it('should setup a job timeout from the beanstalkd job stats', async function () {
      let ttr = Math.ceil(Math.random() * 9);

      this.statsStub.resolves({
        ttr: ttr
      });

      await this.watcher.run(Math.random().toString(), {});

      expect(this.timeoutSpy).to.have.been.calledWith(ttr * 1000 - 1000);
    });

    it('should call the handler with the payload', async function () {
      let payload = {
        [Math.random().toString()]: Math.random().toString(),
        [Math.random().toString()]: Math.random().toString()
      };

      await this.watcher.run(Math.random().toString(), {payload: payload});

      expect(this.handler).to.have.been.calledWith(payload);
    });

    it('should destroy on success', async function () {
      await this.watcher.run(Math.random().toString(), {payload: {}});

      expect(this.destroyStub).to.have.been.calledOnce;
    });

    it('should call the handler with a non-burstable payload', async function () {
      let options = {
        [Math.random().toString()]: Math.random().toString(),
        [Math.random().toString()]: Math.random().toString()
      };

      await this.watcher.run(Math.random().toString(), options);

      expect(this.handler).to.have.been.calledWith(options);
    });

    it('should release for retry on failure', async function () {
      this.handler.rejects();

      await this.watcher.run(Math.random().toString(), {payload: {}}).catch(function () {});

      expect(this.releaseStub).to.have.been.calledOnce;
    });

    it('should bury if last retry', async function () {
      this.handler.rejects();

      this.statsStub.resolves({
        ttr: 5,
        reserves: 3
      })

      await this.watcher.run(Math.random().toString(), {payload: {}}).catch(function () {});

      expect(this.buryStub).to.have.been.calledOnce;
    });
  });
});
