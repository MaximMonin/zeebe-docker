const WebSocket = require('ws');
const axios = require ('axios'); axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
const whois = require('whois-json');

const bot = process.env.TelegramBot;
const channel = process.env.TelegramChannel;

function searchdomain (task, taskService, wss)
{
  const { workflowInstanceKey, bpmnProcessId, elementId } = task;
  switch (elementId) {
  case 'default-zone-list':
    defaultzonelist (task, taskService, wss);
    break;
  case 'full-zone-list':
    fullzonelist (task, taskService, wss);
    break;
  case 'get-domains-data':
    getdomainsdata (task, taskService, wss);
    break;
  case 'get-whois-data':
    getwhoisdata (task, taskService, wss);
    break;
  case 'domain-register-notify':
    registernotify (task, taskService, wss);
    break;
  case 'domain-stop-session':
    stopsession (task, taskService, wss);
    break;
  default:
    {
      console.log('Unknown activityId in process ' + bpmnProcessId + ' (' + elementId + ')');
      taskService.failure('Unknown activetyId in process ' + bpmnProcessId + ' (' + elementId + ')', 0);
    }
  }
};

module.exports = {searchdomain};

function defaultzonelist(task, taskService, wss) {
  const zonelist = convertlist(task.customHeaders.default_zone_list);
  var result = {
    activityId: task.elementId,
    processId: task.workflowInstanceKey,
    data: {zonelist: zonelist}
  }
  // Callback to web client
  wss.clients.forEach(function each(client) {
    // Only send to client subscribed on process with processId
    if (client.readyState === WebSocket.OPEN && client.channel == 'Camunda' && client.processId == task.workflowInstanceKey) {
      client.send(JSON.stringify(result));
    }
  });

  taskService.success();
};

function fullzonelist(task, taskService, wss) {
  zone1 = convertlist(task.customHeaders.ukraine_zone);
  zone2 = convertlist(task.customHeaders.international_zone);
  zone3 = convertlist(task.customHeaders.international_new_zone);
  obj1 = {name: 'ukraine_zone', zonelist: zone1};
  obj2 = {name: 'international_zone', zonelist: zone2};
  obj3 = {name: 'international_new_zone', zonelist: zone3};

  var result = {
    activityId: task.elementId,
    processId: task.workflowInstanceKey,
    data: {zonelist: [obj1, obj2, obj3]}
  }
  // Callback to web client
  wss.clients.forEach(function each(client) {
    // Only send to client subscribed on process with processId
    if (client.readyState === WebSocket.OPEN && client.channel == 'Camunda' && client.processId == task.workflowInstanceKey) {
      client.send(JSON.stringify(result));
    }
  });

  taskService.success({processId: task.workflowInstanceKey});
};

function convertlist (list) {
  list = list.split(" ");
  var stringArray = new Array();
  for(var i =0; i < list.length; i++) {
    if (list[i] == '' || list[i] == ' ') {
    }
    else {
      stringArray.push(list[i]);
    }
  }
  return stringArray;
}

function getdomainsdata(task, taskService, wss) {
  searchname = task.variables.searchname.value;
  zonelist = JSON.parse (task.variables.zonelist.value);

  domains = new Array();
  for(var i =0; i < zonelist.length; i++) {
    domains.push (searchname + zonelist[i]);
  }

  // We can answer to query many times
  // Now we return domain-list only
  var result = {
    activityId: task.elementId,
    processId: task.workflowInstanceKey,
    data: domains
  }

  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN && client.channel == 'Camunda' && client.processId == task.workflowInstanceKey) {
      client.send(JSON.stringify(result));
    }
  });

  // We can complete task even if no all data processed
  taskService.success({domains: domains});

  // Lets calc each domain data and return it to client
  // Async and parallel
  for(var i =0; i < domains.length; i++) {
    getdomaindata (domains[i], task, wss);
  }
};

async function getdomaindata(domain, task, wss) {
  var status;
  try {
    var result = await whois(domain);
    if (result.domain) {
      status = 'busy';
    }
    else {
      status = 'free';
    }
  }
  catch (error) {
    console.log ('domain data error:' + JSON.stringify(error));
    status = 'error';
  }
  var result = {
      activityId: task.elementId + '-full',
      processId: task.workflowInstanceKey,
      data: {domain: domain, status: status}
  }
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN && client.channel == 'Camunda' && client.processId == task.workflowInstanceKey) {
      client.send(JSON.stringify(result));
    }
  });
};

function getwhoisdata(task, taskService, wss) {
  domain = task.variables.whoisdomain.value;
  api = task.customHeaders.whoisapi;

  axios.get(api + domain)
  .then(response => {
    const data = response.data;

    var result = {
      activityId: task.elementId,
      processId: task.workflowInstanceKey,
      data: data
    }

//    console.log (task.activityId + " -> ws");
    wss.clients.forEach(function each(client) {
      if (client.readyState === WebSocket.OPEN && client.channel == 'Camunda' && client.processId == task.workflowInstanceKey) {
        client.send(JSON.stringify(result));
      }
    });
    taskService.success();
  })
  .catch(error => {
    console.log ('whois data error:' + JSON.stringify(error));
    taskService.success();
  });
}

function registernotify(task, taskService, wss) {
  const domainlist = task.variables.domainlist.value;

  const info = "Бизнес процесс выбора домена завершен. Для регистрации выбраны следующие домены: " + domainlist;

  // send message to telegram channel
  axios.post( 'https://api.telegram.org/bot' + bot + '/sendMessage', {chat_id: channel,  parse_mode: 'HTML', text: info  })
  .then(response => {})
  .catch(function (error) {
    console.log(error.response.data);
  });

  var result = {
    activityId: task.elementId,
    processId: task.workflowInstanceKey,
    data: {info: info}
  }
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN && client.channel == 'Camunda' && client.processId == task.workflowInstanceKey) {
      client.send(JSON.stringify(result));
    }
  });

  taskService.success();
};

function stopsession(task, taskService, wss) {
  var result = {
    activityId: task.elementId,
    processId: task.workflowInstanceKey,
    data: {info: 'Process stopped by timeout'}
  }
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN && client.channel == 'Camunda' && client.processId == task.workflowInstanceKey) {
      client.send(JSON.stringify(result));
    }
  });
  taskService.success();
};
