const { ZBClient, Duration } = require('zeebe-node');
const express = require('express');
const { router } = require ('./js/router.js');

const url = process.env.ZeebeURL || 'gateway:26500';
const timeout = process.env.ResponseTimeout || 10000;
const loglevel = process.env.LogLevel || 'INFO';
const tasktype = process.env.TaskType || 'ServiceTask';

console.log('Zeebe Node worker is starting...')
const app = express();
const port = 3000;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const server = app.listen(port, () =>
  console.log(`Zeebe REST handler listening on port ${port}!`)
);

const client = new ZBClient(url, {
    retry: true,
    maxRetries: -1, // infinite retries
    maxRetryTimeout: Duration.seconds.of(30),
    onReady: () => console.log(`Client connected to gateway`),
    onConnectionError: () => console.log(`Client disconnected from gateway`),
    connectionTolerance: 3000 // milliseconds
});

// For docker enviroment it catch docker compose down/restart commands
// The signals we want to handle
// NOTE: although it is tempting, the SIGKILL signal (9) cannot be intercepted and handled
var signals = {
  'SIGHUP': 1,
  'SIGINT': 2,
  'SIGTERM': 15
};
// Do any necessary shutdown logic for our application here
const shutdown = (signal, value) => {
  server.close(() => {
    console.log(`Zeebe Node worker stopped`);
    process.exit(128 + value);
  });
};
// Create a listener for each of the signals that we want to handle
Object.keys(signals).forEach((signal) => {
  process.on(signal, () => {
    console.log(`Zeebe Node worker is shutdowning`);
    shutdown(signal, signals[signal]);
  });
});

async function main() {
  const zbWorker1 = client.createWorker({
    taskType: tasktype,
    taskHandler: handler,
    failWorkflowOnException: false,
    maxJobsToActivate: 200,
    timeout: timeout,
    loglevel: loglevel,
    onReady: () => console.log('Worker connected to ' + tasktype),
    onConnectionError: () => console.log('Worker disconnected from ' + tasktype)
  });

  app.post('/process-definition/:key/start', startWorkflow);
  app.post('/process-definition/key/:key/start', startWorkflow);
};

async function startWorkflow (req, res) {
  const workflowKey = req.params.key;
  const iParams = Object.assign({}, req.query, req.body);

  console.log ('Starting workflow...' + workflowKey + ' ' + JSON.stringify(iParams));
  const vars = iParams.variables;

  const { workflowInstanceKey } = await client.createWorkflowInstance(
      workflowKey,
      vars
  );
  var obj = {workflowInstanceKey: workflowInstanceKey};
  res.status(200).end(JSON.stringify(obj));
}

async function handler(task, complete, worker) {
  await router(task, complete, worker);
}

main ();