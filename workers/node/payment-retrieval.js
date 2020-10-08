const { client, Duration } = require('zeebe-node');
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

const topology = await client.topology()
console.log(JSON.stringify(topology, null, 2))

// susbscribe to the task-type: 'charge-card'
const zbWorker = client.createWorker({
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
const zbWorker = client.createWorker({
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
const zbWorker = client.createWorker({
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
    worker.log('Task variables', job.variables)

    // Task worker business logic goes here
    const updateToBrokerVariables = {
	updatedProperty: 'newValue',
    }
    complete.success(updateToBrokerVariables)

  // Get a process variable
  const amount = task.variables.get('amount');
  const item = task.variables.get('item');

  console.log(`Charging credit card with an amount of ${amount}€ for the item '${item}'...` );
  console.log(`Process: ` + url + '/process-instance/' + task.processInstanceId )

  axios.get(url + '/process-instance/' + task.processInstanceId ).then(response => {
     const data = response.data;
     console.log('Process data: ' + JSON.stringify(data));

     // Complete the task
     taskService.complete(task);
  })
  .catch(function (error) {
    if (error.response) {
      // Request made and server responded
      console.log(error.response.data);
      console.log(error.response.status);
      console.log(error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.log(error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.log('Error', error.message);
    }

    // Handle a Failure
    if (Math.random() > 0.1)
    {
    // repeat again and again
      taskService.handleFailure(task, {
        errorMessage: "Cannot exctract process id data",
        errorDetails: error.response.data.message,
        retries: 1,
        retryTimeout: 1000
      });
    }
    else {
    // Create incident
      taskService.handleFailure(task, {
        errorMessage: "Cannot exctract process id data",
        errorDetails: error.response.data.message,
        retries: 0,
        retryTimeout: 1000
      });
    }
  });

});

// susbscribe to the topic: 'charge-card-premium'
client.subscribe('charge-card-premium', {processDefinitionKey: bpm}, async function({ task, taskService }) {
  // Put your business logic here

  // Get a process variable
  const amount = task.variables.get('amount');
  const item = task.variables.get('item');

  console.log(`Premium charging credit card with an amount of ${amount}€ for the item '${item}'...`);

  // send message to telegram channel
  axios.post( 'https://api.telegram.org/bot' + bot + '/sendMessage', {chat_id: channel,  parse_mode: 'HTML', 
               text: 'Bingo! We got ' + amount + '€ for ' + item  }).then(response => {
     const data = response.data;
     console.log('Telegram answer: ' + JSON.stringify(data));

     // Complete the task
     taskService.complete(task);
  })
  .catch(function (error) {
    if (error.response) {
      console.log(error.response.data);
    } 
    else {
      console.log('error sending data to telegram');
    }
    // Complete the task
    taskService.complete(task);
  });
});


// susbscribe to the topic: 'generate-item-amount'
client.subscribe('generate-item-amount', {processDefinitionKey: bpm},  async function({ task, taskService }) {

  console.log(`Generating amount and item for process...`);

  const processVariables = new Variables();
  processVariables.set("amount", Number(faker.fake('{{finance.amount}}')));
  processVariables.set('item', faker.fake('{{commerce.product}}'));

  // Complete the task
  await taskService.complete(task, processVariables);
});
