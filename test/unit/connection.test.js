import BeanstalkdWorker from '../../src/index';

describe('Connection', () => {
  it("should throw an error when it's not able to connect to the queue", async function (done) {
    this.timeout(10000);

    const worker = new BeanstalkdWorker('127.0.0.1', '65534');
    const tube = Math.random().toString();

    const promise = new Promise((resolve, reject) => {
      worker.handle(tube, () => resolve());

      worker.start();
    });

    await promise;
  });
});
