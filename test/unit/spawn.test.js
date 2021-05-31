import { expect } from 'chai';
import sinon from 'sinon';
import Promise from 'bluebird';
import Job from 'job';
import spawn from 'spawn';

describe('spawn', function () {
  beforeEach(function () {
    this.sinon = sinon.sandbox.create();
  });

  afterEach(function () {
    this.sinon.restore();
  });

  it('should put and return a job', function () {
    var tube = Math.random().toString(),
      jobId = Math.ceil(Math.random() * 9999),
      values = {},
      tube = {
        command: this.sinon.stub().returns(Promise.resolve(jobId)),
        debug: function () {},
      },
      worker = {
        tube: this.sinon.stub().returns(tube),
      },
      actual;

    values[Math.random().toString()] = Math.random().toString();
    values[Math.random().toString()] = Math.random().toString();
    values[Math.random().toString()] = Math.random().toString();

    actual = spawn(worker, tube, values);

    expect(worker.tube).to.have.been.calledWith(tube);
    expect(tube.command).to.have.been.calledWith(
      'put',
      1000,
      0,
      600,
      JSON.stringify({
        payload: values,
      })
    );

    return actual.then(function (job) {
      expect(job).to.be.an.instanceOf(Job);
      expect(job.id).to.equal(jobId);
      expect(job.worker).to.equal(worker);
    });
  });
});
