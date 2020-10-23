// Camunda and Zeebe web client to websocket server

class CamundaClient {
  constructor(url) {
    this.url = this.transformUrl(url);
    this.socket = null;
    this.processId = null;
    this.callback = null;
  };
  setUrl (url) {
    url = this.transformUrl (url);
    if (this.url != url) {
      if (this.socket && this.socket.readyState == 1) {
        this.socket.close ();
        this.socket = new WebSocket(url, ["Camunda"]);
        this.socket.camunda = this;
        if (this.processId) {
           this.socket.send (JSON.stringify({command: 'subscribe', channel: 'Camunda', processId: this.processId}));
        }
      }
    }
    this.url = url;
    return this;
  }; 
  transformUrl (url) {
    if (url) {
      if (url.startsWith ('http')) {
        url = url.replace('http', 'ws');
      }
      if (url.startsWith ('ws')) {
      }
      else {
        if (window.location.protocol == 'http:') {
          url = 'ws://' + window.location.host + '/' + url;
        }
        else {
          url = 'wss://' + window.location.host + '/' + url;
        }
      }
    }
    return url;
  };
  openSocket (command, callback) {
    this.callback = callback;
    if (this.socket && this.socket.readyState == 1) {
      this.socket.send (command);
      return;
    }
    try {
      var socket = new WebSocket(this.url, ["Camunda"]);
      this.socket = socket;
      this.socket.camunda = this;
      socket.onopen = function (event) {
        console.log ('ws connection opened');
        socket.send (command);
      };
      socket.onclose = function(event) {
        console.log ('ws connection closed');
      };
      socket.onerror = function (error) {
        console.log('ws error ' + error);
      };
      socket.onmessage = function (event) {
        if (event.data === undefined) {
           return;
        }
        if (event.data == 'welcome') {
          socket.send ("welcome");
          return;
        }
        if (event.data.startsWith('processId=')) {
          this.camunda.processId = event.data.substr(10);
          return;
        }
        this.camunda.callback (event.data);
      };
    }
    catch (e) {
      console.log(e);
    }
  };
  disconnect () {
    this.closeSocket ();
  }
  closeSocket () {
    this.socket.close ();
    this.socket = null;
    this.processId = null;
    this.callback = null;
  }

  async startProcess(ProcessKey, Variables, callback) {
    const command = JSON.stringify({command: 'startProcess', ProcessKey: ProcessKey, variables: Variables});
    await this.openSocket (command, callback);
  };
  async publishMessage (messageName, Variables, callback) {
    const command = JSON.stringify({command: 'publishMessage', messageName: messageName, processInstanceId: this.processId, processVariables: Variables});
    await this.openSocket (command, callback);
  }
};

export {
  CamundaClient
}
