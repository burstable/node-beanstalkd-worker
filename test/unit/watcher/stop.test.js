var chai = require('chai')
  , expect = chai.expect
  , sinon = require('sinon')
  , Promise = require('bluebird')
  , Watcher = require('tube/watcher');

describe('Watcher', function () {
  describe('stop', function () {
    beforeEach(function () {
      this.sinon = sinon.sandbox.create();
      this.watcher = new Watcher({}, 0, function () {});
    });

    afterEach(function () {
      this.sinon.restore();
    });

    it('should wait for current', async function () {
      this.sinon.stub(this.watcher, 'current').returns(Promise.resolve());
      await this.watcher.stop();
      expect(this.watcher.current).to.have.been.calledOnce;

      this.watcher.current.returns(null);
      await this.watcher.stop();
    });
  });
});
