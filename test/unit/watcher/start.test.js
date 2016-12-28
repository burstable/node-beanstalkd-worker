var chai = require('chai')
  , expect = chai.expect
  , sinon = require('sinon')
  , Promise = require('bluebird')
  , Watcher = require('tube/watcher');

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
