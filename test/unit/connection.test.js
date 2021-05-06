import { expect } from 'chai';
import BeanstalkdWorker from '../../src/index';

describe('Connection', () => {
  it("should throw an error when it's not able to connect to the queue", async function () {
    this.timeout(10000);

    const promise = new Promise((resolve, reject) => {
      const worker = new BeanstalkdWorker('127.0.0.1', '65534', {
        onError: reject,
      });

      const tube = Math.random().toString();

      worker.handle(tube, () => resolve());
      worker.start();
    });

    let error;

    try {
      await promise;
    } catch (err) {
      error = err;
    }

    expect(error.message).to.equal('connect ECONNREFUSED 127.0.0.1:65534');
  });
});
