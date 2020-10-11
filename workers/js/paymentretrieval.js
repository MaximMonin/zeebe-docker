const axios = require ('axios'); axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
const faker = require ('faker');

const bot = process.env.TelegramBot;
const channel = process.env.TelegramChannel;

function paymentretrieval (task, complete, worker )
{
  const { workflowInstanceKey, bpmnProcessId, elementId } = task;
  switch (elementId) {
  case 'generate':
    generate (task, complete, worker);
    break;
  case 'charge-card':
    charge (task, complete, worker);
    break;
  case 'charge-card-premium':
    chargepremium (task, complete, worker);
    break;
  default:
    {
      console.log('Unknown activityId in process ' + bpmnProcessId + ' (' + elementId + ')');
      complete.failure('Unknown activetyId in process ' + bpmnProcessId + ' (' + elementId + ')', 0);
    }
  }
};

module.exports = {paymentretrieval};

function charge(task, complete, worker) {
  const {workflowInstanceKey} = task;

  // Get a process variable
  const amount = task.variables.amount;
  const item = task.variables.item;

  console.log(`Charging credit card with an amount of ${amount}€ for the item '${item}' ` + ' Process :' + workflowInstanceKey.toString() );
  complete.success();
};

function chargepremium(task, complete, worker) {
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

function generate(task, complete, worker) {
  const { workflowInstanceKey } = task;

  console.log(`Generating amount and item for Process ` + workflowInstanceKey.toString());

  complete.success({ 
      amount: Number(faker.fake('{{finance.amount}}')),
      item: faker.fake('{{commerce.product}}')
  });
};
