import { expect } from 'chai';
import sinon from 'sinon';
import Promise from 'bluebird';
import WatcherJob from 'tube/watcher/job';

describe('WatcherJob', function () {
  beforeEach(function () {
    this.tube = {
      debug: function () {},
    };
    this.burstable = {};
    this.id = Math.ceil(Math.random() * 5555);
    this.job = new WatcherJob(this.burstable, this.tube, this.id);

    this.sinon = sinon.sandbox.create();
  });

  afterEach(function () {
    this.sinon.restore();
  });

  describe('done', function () {
    beforeEach(function () {
      this.statsSpy = this.sinon.stub(this.job, 'stats').returns(
        Promise.resolve({
          state: 'ready',
        })
      );
    });

    it('should reject if job is buried', function () {
      this.statsSpy.returns(
        Promise.resolve({
          state: 'buried',
        })
      );

      return expect(this.job.done()).to.be.rejected;
    });

    it('should resolved if job is not found', function () {
      this.statsSpy.returns(Promise.resolve(null));

      return expect(this.job.done()).to.be.resolved;
    });

    it('should poll while job is ready or reserved', async function (done) {
      this.delaySpy = this.sinon
        .stub(Promise, 'delay')
        .returns(Promise.resolve());

      this.statsSpy.onFirstCall().returns(
        Promise.resolve({
          state: 'ready',
        })
      );
      this.statsSpy.onSecondCall().returns(
        Promise.resolve({
          state: 'ready',
        })
      );
      this.statsSpy.onThirdCall().returns(Promise.resolve(null));

      await this.job.done().then(() => {
        expect(this.statsSpy).to.have.been.calledThrice;
        expect(this.delaySpy).to.have.been.calledTwice;
      });

      done();
    });

    it('should call the onDone callback each time it polls', async function (done) {
      var resultA = { state: Math.random().toString() },
        resultB = { state: Math.random().toString() },
        onDone = this.sinon.spy();

      this.delaySpy = this.sinon
        .stub(Promise, 'delay')
        .returns(Promise.resolve());

      this.statsSpy.onFirstCall().returns(Promise.resolve(resultA));
      this.statsSpy.onSecondCall().returns(Promise.resolve(resultB));
      this.statsSpy.onThirdCall().returns(Promise.resolve(null));

      await this.job.done(onDone).then(() => {
        expect(onDone).to.have.been.calledTwice;
        expect(onDone.getCall(0)).to.have.been.calledWith(resultA.state);
        expect(onDone.getCall(1)).to.have.been.calledWith(resultB.state);
      });

      done();
    });
  });

  describe('child', function () {
    it('should spawn a job and return job.done()', function () {
      var childId = Math.random().toString(),
        childJob = new WatcherJob(this.burstable, {}, childId),
        payload = {},
        options = {
          payload: payload,
        },
        childTube = Math.random().toString();

      childJob.done = this.sinon.stub().returns(Promise.resolve());
      this.burstable.spawn = this.sinon
        .stub()
        .returns(Promise.resolve(childJob));
      this.job.touch = this.sinon.spy();

      payload[Math.random().toString()] = Math.random().toString();
      payload[Math.random().toString()] = Math.random().toString();
      payload[Math.random().toString()] = Math.random().toString();

      return this.job.child(childTube, options).then(() => {
        expect(this.burstable.spawn).to.have.been.calledWith(
          childTube,
          options
        );
        expect(childJob.done).to.have.been.called;

        childJob.done.getCall(0).args[0]();
        expect(this.job.touch).to.have.been.calledOnce;
      });
    });
  });

  describe('wait', function () {
    it('should call burstable.done for tube and job', function () {
      let tube = Math.random().toString(),
        jobId = Math.random().toString();

      this.burstable.done = this.sinon
        .stub()
        .withArgs(tube, jobId)
        .returns(Promise.resolve());

      return this.job.wait(tube, jobId).then(() => {
        expect(this.burstable.done).to.have.been.calledOnce;
      });
    });
  });
});
