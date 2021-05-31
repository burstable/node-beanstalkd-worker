import { expect } from 'chai';
import sinon from 'sinon';
import Promise from 'bluebird';
import Watcher from 'tube/watcher';

describe('Watcher', function () {
  describe('loop', function () {
    beforeEach(function () {
      this.sinon = sinon.sandbox.create();

      this.watcher = new Watcher(
        { running: true, debug: function () {} },
        0,
        function () {}
      );
      this.connection = {
        reserveWithTimeout: this.sinon.stub().resolves(),
      };

      this.sinon.stub(this.watcher, 'run');
      this.sinon.stub(this.watcher, 'connection').resolves(this.connection);
    });

    afterEach(function () {
      this.sinon.restore();
    });

    it('should wait for run() and loop again', function () {
      var resolve, reject;
      var promise = new Promise(function (_resolve, _reject) {
        resolve = _resolve;
        reject = _reject;
      });

      var jobId = Math.random().toString(),
        options = {};

      this.connection.reserveWithTimeout.resolves([jobId, options]);
      this.watcher.run.returns(promise);

      var actual = this.watcher.loop();

      this.sinon.stub(this.watcher, 'loop');

      // Let the event loop tick a few times
      return Promise.delay(50)
        .then(() => {
          expect(this.watcher.current()).to.equal(promise);
          resolve();
        })
        .then(() => {
          return actual.then(() => {
            expect(this.watcher.connection).to.have.been.calledOnce;
            expect(this.connection.reserveWithTimeout).to.have.been.calledOnce;
            expect(this.watcher.run).to.have.been.calledWith(jobId, options);
            expect(this.watcher.loop).to.have.been.calledOnce;
          });
        });
    });
  });
});
