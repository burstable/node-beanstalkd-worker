import { expect } from 'chai';
import sinon from 'sinon';
import Promise from 'bluebird';
import Watcher from 'tube/watcher';

describe('Watcher', function () {
  describe('start', function () {
    beforeEach(function () {
      this.sinon = sinon.sandbox.create();

      this.watcher = new Watcher({}, 0, function () {});
      this.sinon.stub(this.watcher, 'loop');
    });

    afterEach(function () {
      this.sinon.restore();
    });

    it('should start looping', function () {
      this.watcher.start();

      expect(this.watcher.loop).to.have.been.calledOnce;
    });
  });
});
