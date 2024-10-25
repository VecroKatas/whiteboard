const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 3000 });
let sockets=[];
var state;

server.on('connection', socket => {
  sockets.push(socket);

  socket.send(JSON.stringify({socketId: sockets.length - 1}));
  if (sockets.indexOf(socket) != 0){
    sockets[0].send(JSON.stringify({type: 'state'}));
  }

  socket.on('message', data => {
    let message = JSON.parse(data);

    if (message.type == "state"){
      state = message.objects;
      state.forEach(o =>{
        sockets[sockets.length - 1].send(JSON.stringify(o));
      });
    }
    else{
      sockets.forEach(client => {
        if (client !== socket && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify(message));
        }
      });
    }
  });
});