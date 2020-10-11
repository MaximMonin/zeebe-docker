const { ZBClient, Duration } = require('zeebe-node');
const express = require('express')
const axios = require ('axios'); axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
const faker = require ('faker');

const url = process.env.ZeebeURL || 'gateway:26500';
const bpm = 'payment-retrieval';
const timeout = process.env.ResponseTimeout || 10000;
const loglevel = process.env.LogLevel || 'INFO';
const bot = process.env.TelegramBot;
const channel = process.env.TelegramChannel;

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
  // subscribe to the task-type: 'generalTask'
  const zbWorker1 = client.createWorker({
    taskType: 'generalTask',
    taskHandler: handler,
    failWorkflowOnException: false,
    maxJobsToActivate: 10,
    timeout: timeout,
    loglevel: loglevel,
    onReady: () => console.log(`Worker connected to 'generalTask'`),
    onConnectionError: () => console.log(`Worker disconnected from 'generalTask'`)
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

main ();

async function handler(task, complete, worker) {
  const { workflowInstanceKey, bpmnProcessId, elementId } = task;

  if (bpmnProcessId != bpm) {
    await complete.forwarded();
    return;
  }
/*
  console.log (JSON.stringify(task));
*/

  // Using one generalTask worker and internal routing to diffrent element inside bpm

  switch (elementId) {
  case 'generate':
    await Generatehandler (task, complete, worker);
    break;
  case 'charge-card':
    await Chargehandler (task, complete, worker);
    break;
  case 'charge-card-premium':
    await ChargePremiumhandler (task, complete, worker);
    break;
  default:
    {
      console.log('Unknown activityId in process ' + bpm + ' (' + elementId + ')');
      await complete.failure('Unknown activetyId in process ' + bpm + ' (' + elementId + ')', 0);
    }
  }
};

function Chargehandler(task, complete, worker) {
  const {workflowInstanceKey} = task;

  // Get a process variable
  const amount = task.variables.amount;
  const item = task.variables.item;

  console.log(`Charging credit card with an amount of ${amount}€ for the item '${item}' ` + ' Process :' + workflowInstanceKey.toString() );
  complete.success();
};

function ChargePremiumhandler(task, complete, worker) {
  const {workflowInstanceKey} = task;

  // Get a process variable
  const amount = task.variables.amount;
  const item = task.variables.item;

  console.log(`Premium charging credit card with an amount of ${amount}€ for the item '${item}' ` + ' Process :' + workflowInstanceKey.toString() );
  complete.success();

/*
  // send message to telegram channel
  axios.post( 'https://api.telegram.org/bot' + bot + '/sendMessage', {chat_id: channel,  parse_mode: 'HTML', 
               text: 'Bingo! We got ' + amount + '€ for ' + item  }).then(response => {
     const data = response.data;
     console.log('Telegram answer: ' + JSON.stringify(data));

     // Complete the task
     complete.success();
  })
  .catch(function (error) {
    if (error.response) {
      console.log('Telegram error: ' + error.response.data);
    } 
    else {
      console.log('error sending data to telegram');
    }
    // repeat task
    complete.failure('Something goes wrong', 1);
  });
*/
};

function Generatehandler(task, complete, worker) {
  const { workflowInstanceKey } = task;

  console.log(`Generating amount and item for Process ` + workflowInstanceKey.toString());

  complete.success({ 
      amount: Number(faker.fake('{{finance.amount}}')),
      item: faker.fake('{{commerce.product}}')
  });
};
