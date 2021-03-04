const { ZBClient, Duration, ZBLogger } = require('zeebe-node');
const express = require('express');
const WebSocket = require('ws');
const { router } = require ('./js/router.js');

const url = process.env.ZeebeUrl || 'gateway:26500';
const timeout = process.env.ResponseTimeout || 60000;
const loglevel = process.env.LogLevel || 'INFO';
const tasktype = process.env.TaskType || 'service-task';

console.log('Zeebe Node worker is starting...')
const app = express();
const port = 3000;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const server = app.listen(port, () =>
  console.log(`Zeebe REST handler listening on port ${port}!`)
);
// Create websocket server to accept commands and return async api result data
console.log('Zeebe Websocket server listening on port 8080...');
const wss = new WebSocket.Server({ port: 8080 });

const client = new ZBClient(url, {
//    loglevel: 'DEBUG',
    retry: true,
    maxRetries: -1, // infinite retries
    maxRetryTimeout: Duration.seconds.of(30),
    onReady: () => console.log(`Client connected to gateway`),
    onConnectionError: () => console.log(`Client disconnected from gateway`),
    connectionTolerance: 3000 // milliseconds
});

// Websocket protocol
function heartbeat() {
  this.isAlive = true;
};
function noop() {};

wss.on('connection', function connection(ws, req) {
  ws.isAlive = true;
  ws.channel = "";
  ws.processId = null;

  ws.on('pong', heartbeat);

  ws.on('message', function incoming(message) {
//    console.log('received: %s', message);
    if (message.startsWith("{")) {
      obj = JSON.parse (message);
      if (obj.command == 'subscribe') {
        ws.channel = obj.channel;
        ws.processId = obj.processId;
      }
      if (obj.command == 'startProcess') {
        try {
          (async (obj) => {
            const data = await client.createWorkflowInstance(obj.ProcessKey, obj.variables);
            console.log('Workflow instance started: ' + JSON.stringify(data));
            ws.channel = 'Camunda';
            ws.processId = data.workflowInstanceKey;
            ws.send ('processId=' + data.workflowInstanceKey);
            ws.send (JSON.stringify({message: 'startProcessResult', data: data}));
          })(obj)
        }
        catch (error) {
          console.error(error);
          ws.send (JSON.stringify({message: 'startProcessError', data: error}));
        }
      }
      if (obj.command == 'publishMessage') {
        var processId = obj.processInstanceId;
        if (processId == null && ws.processId) {
          processId = ws.processId;
        } 
        if (obj.processInstanceId) {
          ws.channel = 'Camunda';
          ws.processId = obj.processInstanceId;
        }
        try {
          (async (obj, processId) => {
            const mesdata = await client.publishMessage({
              correlationKey: processId,
              name: obj.messageName,
              variables: obj.processVariables,
              timeToLive: 10000
            });
            console.log('Message delivered: ' + JSON.stringify(mesdata));
            ws.send (JSON.stringify({message: 'publishMessageResult', data: mesdata}));
          })(obj, processId)
        }
        catch (error) {
          console.error(error);
          ws.send (JSON.stringify({message: 'publishMessageError', data: error}));
        }
      }
    }
  });
 
  ws.send('welcome');
//  console.log ('welcome -> ws');
});

const interval = setInterval(function ping() {
  wss.clients.forEach(function each(ws) {
    if (ws.isAlive === false) return ws.terminate();
 
    ws.isAlive = false;
    ws.ping(noop);
  });
}, 30000);

wss.on('close', function close() {
  clearInterval(interval);
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
    client.close().then(() => console.log('All workers closed'));

    console.log(`Camunda Node WebSocket server is shutdowning`);
    wss.clients.forEach(function each(ws) {
      ws.terminate();
    });
    wss.close();
    console.log(`Camunda Node WebSocket server stoped`);

    shutdown(signal, signals[signal]);
  });
});


async function main() {
  try {
    const res = await client.topology()
    console.log(JSON.stringify(res, null, 2))
  } 
  catch (e) {
    console.error(e)
  }
  const zbWorker1 = client.createWorker({
//    debug: true,
    taskType: tasktype,
    taskHandler: async (task, complete, worker) => {
//      console.log (JSON.stringify(task)); 
      await router (task, complete, wss);
    },
    failWorkflowOnException: false,
    maxJobsToActivate: 200,
    longPoll: Duration.minutes.of(2),
    pollInterval: Duration.seconds.of (0.005),
    timeout: Duration.seconds.of (timeout / 1000),
    loglevel: loglevel,
    onReady: () => console.log('Worker connected to ' + tasktype),
    onConnectionError: () => console.log('Worker disconnected from ' + tasktype)
  });

  app.post('/process-definition/:key/start', startWorkflow);
  app.post('/process-definition/key/:key/start', startWorkflow);
  app.post('/process-definition/:key/startwithresult', startWorkflow);
  app.post('/process-definition/key/:key/startwithresult', startWorkflow);
  app.post('/message', publishMessage);
  app.post('/deployment/create', deployWorkflow);
};

async function startWorkflow (req, res) {
  const workflowKey = req.params.key;
  const iParams = Object.assign({}, req.query, req.body);

  console.log ('Starting workflow...' + workflowKey + ' ' + JSON.stringify(iParams));
  const vars = iParams.variables;

  try {
//    console.log (req.originalUrl);
    if (req.originalUrl.includes("withresult") == false) {
      const { workflowInstanceKey } = await client.createWorkflowInstance(workflowKey,vars);
      var obj = {workflowInstanceKey: workflowInstanceKey};
      res.status(200).end(JSON.stringify(obj));
    }
    else {
      const obj = await client.createWorkflowInstanceWithResult(workflowKey,vars,{requestTimeout: 2 * 60 * 1000 });
      res.status(200).end(JSON.stringify(obj));
    }
  }
  catch (e) {
    console.error(e);
    res.status(200).end(JSON.stringify(e));
  }
};

async function publishMessage (req, res) {
  const iParams = Object.assign({}, req.query, req.body);

  console.log ('Message published... ' + JSON.stringify(iParams));
  const messageName = iParams.messageName;
  const Key = iParams.correlationKey;
  const vars = iParams.variables;

  try {
    await client.publishMessage({
      correlationKey: Key,
      name: messageName,
      variables: vars,
      timeToLive: 10000
    });
    res.status(200).end(JSON.stringify({Result: 'OK'}));
  }
  catch (e) {
    console.error(e);
    res.status(200).end(JSON.stringify(e));
  }
};

async function deployWorkflow (req, res) {
  const iParams = Object.assign({}, req.query, req.body);

  console.log ('Deploying workflow... ' + JSON.stringify(iParams));
  const filename = iParams.upload;

  try {
    const data = await client.deployWorkflow(filename);
    console.log(data);
    res.status(200).end(JSON.stringify(data));
  }
  catch (e) {
    console.error(e);
    res.status(200).end(JSON.stringify(e));
  }
};

main ();
