var chai = require('chai')
  , expect = chai.expect
  , sinon = require('sinon')
  , Promise = require('bluebird')
  , Worker = require('index');

describe('Worker', function () {
  beforeEach(function () {
    this.sinon = sinon.sandbox.create();
    this.worker = new Worker({}, Math.random().toString());
  });

  afterEach(function () {
    this.sinon.restore();
  });

  describe('stopTubes', function () {
    it('should wait for all tubes to stop', async function () {
      this.sinon.spy(Promise, 'all');

      this.worker.tubes = {
        a: {stop: this.sinon.stub().resolves()},
        b: {stop: this.sinon.stub().resolves()},
        c: {stop: this.sinon.stub().resolves()}
      };

      await this.worker.stopTubes();

      expect(this.worker.tubes.a.stop).to.have.been.calledOnce;
      expect(this.worker.tubes.b.stop).to.have.been.calledOnce;
      expect(this.worker.tubes.c.stop).to.have.been.calledOnce;

      expect(Promise.all).to.have.been.calledOnce;
      expect(Promise.all.getCall(0).args[0].length).to.equal(Object.keys(this.worker.tubes).length);
    });
  });
});
