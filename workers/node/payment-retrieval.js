const { ZBClient, Duration } = require('zeebe-node');
const axios = require ('axios'); axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
const faker = require ('faker');

const url = process.env.ZeebeURL || 'gateway:26500';
const bpm = 'payment-retrieval';
const timeout = process.env.ResponseTimeout || 10000;
const bot = process.env.TelegramBot;
const channel = process.env.TelegramChannel;

const client = new ZBClient(url, {
    retry: true,
    maxRetries: -1, // infinite retries
    maxRetryTimeout: Duration.seconds.of(30),
    onReady: () => console.log(`Client connected to gateway`),
    onConnectionError: () => console.log(`Client disconnected from gateway`),
    connectionTolerance: 3000 // milliseconds
});

const topology = client.topology();
console.log(JSON.stringify(topology, null, 2));

// susbscribe to the task-type: 'charge-card'
const zbWorker1 = client.createWorker({
    taskType: 'charge-card',
    taskHandler: Chargehandler,
    failWorkflowOnException: false,
    maxJobsToActivate: 10,
    timeout: timeout,
    loglevel: 'INFO',
    onReady: () => console.log(`Worker connected to 'charge-card'`),
    onConnectionError: () => console.log(`Worker disconnected from 'change-card'`)
})

// susbscribe to the task-type: 'charge-card-premium'
const zbWorker2 = client.createWorker({
    taskType: 'charge-card-premium',
    taskHandler: ChargePremiumhandler,
    failWorkflowOnException: false,
    maxJobsToActivate: 10,
    timeout: timeout,
    loglevel: 'INFO',
    onReady: () => console.log(`Worker connected to 'charge-card-premium'`),
    onConnectionError: () => console.log(`Worker disconnected from 'change-card-premium'`)
})

// susbscribe to the task-type: 'generate-item-amount'
const zbWorker3 = client.createWorker({
    taskType: 'generate-item-amount',
    taskHandler: Generatehandler,
    failWorkflowOnException: false,
    maxJobsToActivate: 10,
    timeout: timeout,
    loglevel: 'INFO',
    onReady: () => console.log(`Worker connected to 'generate-item-amount'`),
    onConnectionError: () => console.log(`Worker disconnected from 'generate-item-amount'`)
})

function Chargehandler(task, complete, worker) {
  // Get a process variable
  const amount = task.variables.amount;
  const item = task.variables.item;

  console.log(`Charging credit card with an amount of ${amount}€ for the item '${item}'...` );

  complete.success();
};

function ChargePremiumhandler(task, complete, worker) {
  // Get a process variable
  const amount = task.variables.amount;
  const item = task.variables.item;

  console.log(`Premium charging credit card with an amount of ${amount}€ for the item '${item}'...`);

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
};


function Generatehandler(task, complete, worker) {
  console.log(`Generating amount and item for process...`);

  complete.success({ 
      amount: Number(faker.fake('{{finance.amount}}')),
      item: faker.fake('{{commerce.product}}')
  });
};
