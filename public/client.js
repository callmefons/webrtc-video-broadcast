'use strict'
// getting dom elements
var divLobby = document.getElementById("lobby")
var inputUsername = document.getElementById("username");
var inputRoomNumber = document.getElementById("roomNumber");
// var btnLeaveRoom = document.getElementById("btnLeaveRoom");
// var divGoRoom = document.getElementById("goRoom");
var btnGoRoom = document.getElementById("btnGoRoom");
var btnClose = document.getElementById("btnClose");
var divLeaveRoom = document.getElementById("leaveRoom");
var divConferenceRoom = document.getElementById("conferenceRoom");
var localVideo = document.getElementById("localVideo");

// variables
var roomNumber;
var localStream;
var broadcasterStream;
var broadcaster_username;
var member_username;
var receivedStreamsId = [];
var showLocalVideo = true;

var rtcPeerConnection; 
var rtcPeerConnections = {}; 
var tempConnection;

var servers = { iceServers: [{
    urls: [ "stun:ss-turn1.xirsys.com" ]
 }, {
    username: "I29911_4EW9_83UfF7eApgoAnDdGYM8_FY3xdJHxtXsL6fV4MLtZGVa6-0Xrc527AAAAAGDUFNZjYWxsbWVmb25z",
    credential: "210cce00-d4ab-11eb-9770-0242ac140004",
    urls:["turn:ss-turn1.xirsys.com:80?transport=udp",
    "turn:ss-turn1.xirsys.com:3478?transport=udp",
    "turn:ss-turn1.xirsys.com:80?transport=tcp",
    "turn:ss-turn1.xirsys.com:3478?transport=tcp",
    "turns:ss-turn1.xirsys.com:443?transport=tcp",
    "turns:ss-turn1.xirsys.com:5349?transport=tcp"]
 }]};
 

var streamConstraints = { audio: true, video: true };
var isBroadcaster;
var myUsername;

// Let's do this
var socket = io();

btnGoRoom.onclick = function () {
    if (inputRoomNumber.value === '') {
        alert("Please type a room number")
    } 
    else if (inputUsername.value === '') {
        alert("Please choose a username")
    }
    else {
        roomNumber = inputRoomNumber.value;
        myUsername = inputUsername.value;
        socket.emit('create or join', roomNumber, myUsername);
        hideUI();
    }
};

btnClose.onclick = function () {
    console.log("closeDialog")
    socket.emit('closeDialog');
};

socket.on('broadcast', function () {
    console.log("broadcast");
});

socket.on('clearRoom', function () {
    // location.reload()
    console.log("clearRoom");
});

function hideUI(){
    divLobby.style = "display: none;";
    // divGoRoom.style = "display: none;";
    divConferenceRoom.style = "display: block;";
    divLeaveRoom.style = "display: block;";
    createLeaveBtn();
}

function createLeaveBtn(){
    let leaveBtn = document.createElement("button");
    leaveBtn.setAttribute("id", "btnLeaveRoom");
    leaveBtn.setAttribute("type", "button");
    leaveBtn.setAttribute("class", "btn btn-primary");
    leaveBtn.append("Leave")

    divLeaveRoom.appendChild(leaveBtn)

    leaveBtn.onclick = function () {
        console.log("btnLeaveRoom click", roomNumber)
        socket.emit('clearRoom', roomNumber);
    };
}

function markSolved(id) { 
    document.getElementById("roomNumber").value = id; 
}

socket.on('created', function () {
    navigator.mediaDevices.getUserMedia(streamConstraints).then(function (stream) {
        localVideo = createVideo(stream, "You", true);
        localStream = stream;
        isBroadcaster = true;
    }).catch(function (err) {
        console.log('An error ocurred when accessing media devices', err);
        alert("Having error opening your camera and/or microphone: ", err.message);
    });

    console.log(socket.id, ' (me) is the broadcaster');
});

socket.on('ready', function (member_id) {
    if (isBroadcaster) {
        console.log("member_id: ", member_id, " has just joined the room. Let's start connecting with him/her")
        tempConnection = new RTCPeerConnection(servers);

        tempConnection.oniceconnectionstatechange = () => {
                console.log("*** ICE connection state changed to " + String(rtcPeerConnections[member_id].iceConnectionState));
        }
        tempConnection.onicecandidate = onIceCandidate;
        
        tempConnection.ontrack = onTrackHandler;
        
        tempConnection.onnegotiationneeded = () => {
            tempConnection.createOffer({iceRestart: true}).then(sessionDescription => {
                tempConnection.setLocalDescription(sessionDescription);
                socket.emit('offer', {
                    type: 'offer',
                    sdp: sessionDescription,
                    room: roomNumber,
                }, member_id, myUsername);
            })
            .catch(error => {
                console.log(error)
            })                                                                                                                                                                                                  
        }                                                                                                             
        localStream.getTracks().forEach(track => tempConnection.addTrack(track, localStream));        
        
        rtcPeerConnections[member_id] = tempConnection;

        console.log(socket.id, " is handling the ready event (so I'm supposed to be the host)", " from " + String(member_id));
    }   
});

socket.on('answer', function (event, member_id) {
    if(isBroadcaster){
        rtcPeerConnections[member_id].setRemoteDescription(new RTCSessionDescription(event)).catch(
            ()=>{ console.log("The error occured while processing the answer of member: ", member_id) }
        );
        console.log(socket.id, " is handling the answer event (so I'm supposed to be a host)" + " from " + String(member_id)
                    + " which means I'm setting remote description");
    }   
})

socket.on('username', function(sender_username) {
    if (isBroadcaster){
        member_username = sender_username;
    }
})

socket.on('joined', function () {
    navigator.mediaDevices.getUserMedia(streamConstraints).then(function (stream) {
        localStream = stream;
        // localVideo = createVideo(stream, "You", true);
        isBroadcaster = false;
        socket.emit('ready', socket.id);
    }).catch(function (err) {
        console.log('An error ocurred when accessing media devices', err);
    });
    console.log(socket.id, '(me) is a member');
});

socket.on('offer', function (event, sender_username) {
    if (!isBroadcaster) {
        broadcaster_username = sender_username;
        rtcPeerConnection = new RTCPeerConnection(servers);
        rtcPeerConnection.onicecandidate = onIceCandidate(roomNumber);
        rtcPeerConnection.ontrack = onTrackHandler;
        rtcPeerConnection.oniceconnectionstatechange = () => {
                console.log("*** ICE connection state changed to " + String(rtcPeerConnection.iceConnectionState));
        }

        rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event))
        .then(function() 
        {
            let tracksSent = 0;
            localStream.getTracks().forEach(function(track)
            {
                rtcPeerConnection.addTrack(track, localStream)
                socket.emit("username", myUsername)
                
            })
        })
          .then(function() {
            return rtcPeerConnection.createAnswer();
          })
          .then(function(answer) {
            return rtcPeerConnection.setLocalDescription(answer);
          })
          .then(function() {
            socket.emit('answer', {
                type: 'answer',
                sdp: rtcPeerConnection.localDescription,
                room: roomNumber
            }, socket.id);
            }
          )
          .catch(error => {
            console.log(error)
            })
        console.log(socket.id, " is handling the offer event (so I'm supposed to be a member)"
                    + " which means I'm creating answer")
    }
});


function onIceCandidate(event) {
    if (event.candidate) {
        console.log('sending ice candidate: ' + JSON.stringify(event.candidate));
        socket.emit('candidate', {
            type: 'candidate',
            candidate: event.candidate,
            room: roomNumber
        }, socket.id)
    }
}

socket.on('candidate', function (event, sender_id) {
    var candidate = new RTCIceCandidate(event.candidate);
    console.log("Receive this candidate: " + JSON.stringify(event) + " from " + String(sender_id));
    if (isBroadcaster){
        rtcPeerConnections[sender_id].addIceCandidate(candidate).then(function() {
            console.log("added ICE candidate from: " + String(sender_id));
        })
        .catch(e => {
            console.log("Failure during addIceCandidate(): " + e.name);
        })
    }   
    else{
            rtcPeerConnection.addIceCandidate(candidate).then(function() {
                console.log("added ICE candidate from: " + String(sender_id));
            })
            .catch(e => {
                console.log("Failure during addIceCandidate(): " + e.name);
            })
    }
});

function onTrackHandler(event) {

    if (!receivedStreamsId.includes(event.streams[0].id) && !isBroadcaster) {
        createVideo(event.streams[0], isBroadcaster ? member_username : broadcaster_username)
        receivedStreamsId.push(event.streams[0].id);
    }  
    console.log("receivedStreamsId: ", receivedStreamsId);
}

function createVideo(src, caption, isMuted)
{
    let fig = document.createElement("figure")

    let video = document.createElement("video");
    video.setAttribute("id", "localVideo");
    video.srcObject = src;
    video.autoplay = true;
    video.controls = true;
    video.muted = isMuted;
    video.poster = "http://rmhc.org.sg/wp-content/uploads/tvc//vidloading.gif"
    fig.appendChild(video)
    
    let figCaption = document.createElement("figcaption")
    let text = document.createTextNode(caption)
    figCaption.appendChild(text)
    fig.appendChild(figCaption)

    divConferenceRoom.appendChild(fig)
    return fig;
}

