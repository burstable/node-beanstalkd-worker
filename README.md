# Beanstalkd Worker for node

## Features
- Wait for job completion
- Child jobs (keeping parent alive till done)

## How-To

### Setup

```sh
npm install --save beanstalkd-worker
```

```js
import BeanstalkdWorker from 'beanstalkd-worker';

const worker = new BeanstalkdWorker(
  host, // beanstalkd host
  port, // beanstalkd port
);
```

### Spawning jobs

```js
worker.spawn(tube, {
  // job payload/values
}, {
  delay: 0,
  priority: 1000,
  timeout: 10 * 60 * 1000 // ms
}).then(function (job) {
  console.log(job.id);
});
```

### Handling jobs

```js
worker.handle(tube, function (payload) {
  // Complete job
  return Promise.resolve();

  // Job error
  return Promise.reject();

  // Spawn a job
  this.spawn(someTub);

  // Refresh timeout
  this.touch();

  // Spawn child job and wait for completion before completing this job
  await this.child(anotherTube, {/* payload */});

  // Await another job
  await this.wait(anotherTube, jobId);

  // Puts current job back in queue with delay, does not affect retries counter
  return this.delay(5000); // ms, default: original timeout
}, {
  tries: 3, // Total amount of tries including the first one
  backoff: {
    initial: 60 * 1000, // ms
    exponential: 1.5 // multiple backoff by N each try
  }
});

worker.start(); // Enable handlers and start processing jobs, make sure handlers are setup before calling start
```

Keep in mind that worker will spawn a connection equal to width * amount of tubes. You'll want to make sure that your server is configured to handle that amount of connections (ulimit).

## Debugging

Use `DEBUG=beanstalkd-worker*` to enable verbose debugging.
