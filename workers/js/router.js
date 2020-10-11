const { paymentretrieval } = require ('./paymentretrieval.js');

async function router(task, complete, worker) {
  const { workflowInstanceKey, bpmnProcessId, elementId } = task;

/*  console.log (JSON.stringify(task)); */

  switch (bpmnProcessId) {
  case 'payment-retrieval':
    await paymentretrieval(task, complete, worker);
    break;
  default:
    {
      console.log('Unknown ProcessId ' + bpmnProcessId);
      await complete.failure('Unknown ProcessId ' + bpmnProcessId, 0);
    }
  }
};

module.exports = { router };
