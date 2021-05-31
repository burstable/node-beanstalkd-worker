import { expect } from 'chai';
import sinon from 'sinon';
import Promise from 'bluebird';
import Tube from 'Tube';

describe('Tube', function () {
  beforeEach(function () {
    this.sinon = sinon.sandbox.create();
    this.tube = new Tube({}, Math.random().toString());
  });

  afterEach(function () {
    this.sinon.restore();
  });

  describe('stop', function () {
    it('should wait for all watchers to stop', async function () {
      this.sinon.spy(Promise, 'all');

      this.tube.watchers = [
        { stop: this.sinon.stub().resolves() },
        { stop: this.sinon.stub().resolves() },
        { stop: this.sinon.stub().resolves() },
      ];

      await this.tube.stop();

      expect(this.tube.watchers[0].stop).to.have.been.calledOnce;
      expect(this.tube.watchers[1].stop).to.have.been.calledOnce;
      expect(this.tube.watchers[2].stop).to.have.been.calledOnce;

      expect(Promise.all).to.have.been.calledOnce;
      expect(Promise.all.getCall(0).args[0].length).to.equal(
        this.tube.watchers.length
      );
    });
  });
});
