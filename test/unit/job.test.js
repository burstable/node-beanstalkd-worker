import { expect } from 'chai';
import sinon from 'sinon';
import Promise from 'bluebird';
import Job from 'job';

describe('Job', function () {
  beforeEach(function () {
    this.tube = {
      debug: function () {},
    };
    this.burstable = {};
    this.id = Math.ceil(Math.random() * 5555);
    this.job = new Job(this.burstable, this.tube, this.id);

    this.sinon = sinon.sandbox.create();
  });

  afterEach(function () {
    this.sinon.restore();
  });

  describe('command', function () {
    it('should call tube.commmand with command and arguments', function () {
      var commandSpy = this.sinon.stub().returns(Promise.resolve()),
        command = Math.random().toString(),
        arg1 = Math.random().toString(),
        arg2 = Math.random().toString();

      this.tube.command = commandSpy;

      return this.job.command(command, arg1, arg2).then(function () {
        expect(commandSpy).to.have.been.calledWith(command, arg1, arg2);
      });
    });
  });

  describe('stats', function () {
    it('should make a command and return a command', function () {
      var self = this,
        response = {};

      this.commandSpy = this.sinon
        .stub(this.job, 'command')
        .returns(Promise.resolve(response));

      return expect(this.job.stats())
        .to.eventually.equal(response)
        .then(function () {
          expect(self.commandSpy).to.have.been.calledOnce;
        });
    });

    it('should return null for NOT_FOUND if catchNotFound', function () {
      this.commandSpy = this.sinon
        .stub(this.job, 'command')
        .returns(Promise.reject(new Error('NOT_FOUND')));

      return expect(this.job.stats(true)).to.eventually.equal(null);
    });

    it('should rethrow any rejections', function () {
      this.commandSpy = this.sinon
        .stub(this.job, 'command')
        .returns(Promise.reject());

      return expect(this.job.stats(true)).to.eventually.be.rejected;
    });
  });

  describe('status', function () {
    describe('Job.status', function () {
      it('should return success for null', function () {
        expect(Job.status(null)).to.equal('success');
      });

      it('should return stats.state', function () {
        var state = Math.random().toString();

        expect(
          Job.status({
            state: state,
          })
        ).to.equal(state);
      });
    });

    describe('job.status', function () {
      it('should call Job.status with the result of job.stats()', function () {
        var self = this,
          statusSpy = this.sinon.spy(Job, 'status'),
          stats = {
            state: 'reserved',
          };

        this.statsSpy = this.sinon
          .stub(this.job, 'stats')
          .returns(Promise.resolve(stats));

        return expect(this.job.status())
          .to.eventually.equal('reserved')
          .then(function () {
            expect(statusSpy).to.have.been.calledWith(stats);
            expect(self.statsSpy).to.have.been.calledWith(true);

            statusSpy.restore();
          });
      });
    });
  });
});
