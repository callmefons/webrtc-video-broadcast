const express = require('express'),
  es6Renderer = require('express-es6-template-engine'),
  app = express();

app.engine('html', es6Renderer);
app.set('views', 'views');
app.set('view engine', 'html');

var http = require('http').Server(app);
var io = require('socket.io')(http);

const port = process.env.PORT || 3000;

// express routing
app.use(express.static('public'));

app.get('/rtc', function(req, res) {
    const room = req.query.room;
    const username = req.query.username;
    res.render('index', {locals: {
        room: room,
        username: username
    }});
});


var BROADCASTER_ID;
// signaling
io.on('connection', function (socket) {
    console.log('a user connected: ', socket.id);

    socket.on('create or join', function (room, username) {
        console.log('create or join to room ', room, ' username ', username);
        var myRoom = io.sockets.adapter.rooms[room] || { length: 0 };
        var numClients = myRoom.length;

        console.log(room, ' has ', numClients, ' clients', ' before', socket.id, ' join');

        if (numClients == 0) {
            BROADCASTER_ID = socket.id;
            socket.join(room);
            socket.emit('created', room);
            //broadcast to all members 
            socket.broadcast.emit('broadcast', room, username);
        } else {
            socket.join(room);
            socket.emit('joined', room);
        }
        console.log("The current sockets are: ", Object.keys(io.sockets.adapter.rooms[room].sockets))
        
    });

    socket.on('ready', function (sender_id){
        socket.broadcast.to(BROADCASTER_ID).emit('ready', String(sender_id));
    });

    socket.on('candidate', function (event, sender_id){
        if (sender_id === BROADCASTER_ID){
            socket.broadcast.to(event.room).emit('candidate', event, String(sender_id));
        }
        else
        {
            socket.broadcast.to(BROADCASTER_ID).emit('candidate', event, String(sender_id));
        }

    });

    socket.on('offer', function(event, receiver_id, sender_username){
        socket.broadcast.to(receiver_id).emit('offer',event.sdp, sender_username);
    });

    socket.on('username', function(student_username){
        socket.broadcast.to(BROADCASTER_ID).emit('username', student_username);
    })
    socket.on('answer', function(event, sender_id){
        socket.broadcast.to(BROADCASTER_ID).emit('answer',event.sdp, String(sender_id));
    });

    socket.on('clearRoom', function(room){
        let roomObj = io.sockets.adapter.rooms[room];
        if (roomObj) {
            // now kick everyone out of this room
            Object.keys(roomObj.sockets).forEach(function(id) {
                io.sockets.connected[id].leave(room);
            })
        }

        console.log("clearRoom");        
        socket.emit('clearRoom');
        socket.broadcast.emit('clearRoom');
    });

    socket.on('closeDialog', function(){
        socket.emit('closeDialog');
        socket.broadcast.emit('closeDialog');
    });

});

// listener
http.listen(port, function () {
    console.log('listening on', port);
});

