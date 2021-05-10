import sinon from 'sinon';
import { expect } from 'chai';
import BeanstalkdWorker from '../../src/index';

describe('Connection', () => {
  it('should throw an error when it\'s not able to connect to the queue', async function () {
    this.timeout(10000);

    let error, tube;
    const callback = sinon.spy();

    const promise = new Promise((resolve, reject) => {
      const worker = new BeanstalkdWorker('127.0.0.1', '65534', {
        onConnectionError: (err, tube) => {
          callback(err, tube);

          reject(err);
        },
      });

      tube = Math.random().toString();

      worker.handle(tube, () => resolve());
      worker.start();
    });

    try {
      await promise;
    } catch (err) {
      error = err;
    }

    expect(error.message).to.equal('connect ECONNREFUSED 127.0.0.1:65534');
    expect(callback.called).to.equal(true);
    expect(callback.args[0][0]).to.equal(error);
    expect(callback.args[0][1].name).to.equal(tube);
  });
});
