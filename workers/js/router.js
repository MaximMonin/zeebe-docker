const { paymentretrieval } = require ('./paymentretrieval.js');
const { searchdomain } = require ('./search-domain.js');

async function router(task, complete, wss) {
  const { workflowInstanceKey, bpmnProcessId, elementId } = task;

/*  console.log (JSON.stringify(task)); */

  switch (bpmnProcessId) {
  case 'payment-retrieval':
    await paymentretrieval(task, complete, wss);
    break;
  case 'search-domain':
    searchdomain(task, complete, wss);
    break;
  default:
    {
      console.log('Unknown ProcessId ' + bpmnProcessId);
      await complete.failure('Unknown ProcessId ' + bpmnProcessId, 0);
    }
  }
};

module.exports = { router };
