'use strict'
// getting dom elements
var divSelectRoom = document.getElementById("selectRoom");
var divConsultingRoom = document.getElementById("consultingRoom");
var divSelectName = document.getElementById("selectName")
var inputRoomNumber = document.getElementById("roomNumber");
var btnGoRoom = document.getElementById("goRoom");
var btnShowHideLocalVideo = document.getElementById("show/hide localVideo");
var inputUsername = document.getElementById("username");
var localVideo = document.getElementById("localVideo");


// variables
var roomNumber;
var localStream;
var broadcasterStream;
var broadcaster_username;
var student_username;
var receivedStreamsId = [];
var showLocalVideo = true;

// A STUDENT ONLY NEED ONE RTCPeerConnection to connect with the only teacher in the room. If a student can see
// many teachers then this logic need to change
var rtcPeerConnection; 
var rtcPeerConnections = {}; // REALLY IMPORTANT: THE BROADCASTER NEEDS A DISTINCT RTCPeerConnection FOR EACH STUDENT
var tempConnection;

var servers = { iceServers: [{
    urls: [ "stun:ss-turn2.xirsys.com" ]
 }, {
    username: "jeC-OpdXXcOw3AcJrkOal49dPFBAE3SAWuLpWe89XUR_iCl4crBb0V7MTFVB6gkLAAAAAF2dgE1xaHV5NDExOQ==",
    credential: "595b7762-ea5f-11e9-8493-322c48b34491",
    urls: [
        "turn:ss-turn2.xirsys.com:80?transport=udp",
        "turn:ss-turn2.xirsys.com:3478?transport=udp",
        "turn:ss-turn2.xirsys.com:80?transport=tcp",
        "turn:ss-turn2.xirsys.com:3478?transport=tcp",
        "turns:ss-turn2.xirsys.com:443?transport=tcp",
        "turns:ss-turn2.xirsys.com:5349?transport=tcp"
    ]
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
        socket.emit('create or join', roomNumber);
        divSelectRoom.style = "display: none;";
        divConsultingRoom.style = "display: block;";
        divSelectName.style = "display: none;";
    }
};

btnShowHideLocalVideo.onclick = function () {
    if (showLocalVideo){
        localVideo.style.display = "none";
        showLocalVideo = false;
    }
    else {
        localVideo.style.display = "block";
        showLocalVideo = true;
    }
};

// message handlers


///////////////////////////////// Broadcaster only message handlers
socket.on('created', function (room) {
    navigator.mediaDevices.getUserMedia(streamConstraints).then(function (stream) {
        localVideo = createVideo(stream, "You", true);
        localStream = stream;
        isBroadcaster = true;
    }).catch(function (err) {
        console.log('An error ocurred when accessing media devices', err);
        alert("Having error opening your camera and/or microphone: ", err.message);
    });
    //alert("You are the broadcaster of room " + String(room));
    console.log(socket.id, ' (me) is the broadcaster');
});

socket.on('ready', function (student_id) {
    if (isBroadcaster) {
        console.log("Student_id: ", student_id, " has just joined the room. Let's start connecting with him/her")
        tempConnection = new RTCPeerConnection(servers);

        tempConnection.oniceconnectionstatechange = () => {
                console.log("*** ICE connection state changed to " + String(rtcPeerConnections[student_id].iceConnectionState));
        }
        tempConnection.onicecandidate = onIceCandidate;
        // The local ICE layer calls your icecandidate event handler
        // when it needs you to transmit an ICE candidate to the other peer,
        // through your signaling server

        tempConnection.ontrack = onTrackHandler;
        // /This handler for the track event is called by the local WebRTC layer when a track is 
        // added to the connection. This lets you connect the incoming media to an element to display it  

        tempConnection.onnegotiationneeded = () => {
            tempConnection.createOffer({iceRestart: true}).then(sessionDescription => {
                tempConnection.setLocalDescription(sessionDescription);
                socket.emit('offer', {
                    type: 'offer',
                    sdp: sessionDescription,
                    room: roomNumber
                }, student_id, myUsername);
            })
            .catch(error => {
                console.log(error)
            })                                                                                                                                                                                                  
        }                                                                                                             
        localStream.getTracks().forEach(track => tempConnection.addTrack(track, localStream));        
        // adds a new media track to the set of tracks which will be transmitted to the other peer.                             
        // Adding a track to a connection triggers renegotiation by firing a negotiationneeded event                            
        
        rtcPeerConnections[student_id] = tempConnection;

        // console.log("The current student ids: ",Object.keys(rtcPeerConnections));
        // console.log("The number of students in the room: ", Object.keys(rtcPeerConnections).length);  
        console.log(socket.id, " is handling the ready event (so I'm supposed to be the teacher)", " from " + String(student_id));
    }   
});

socket.on('answer', function (event, student_id) {
    if(isBroadcaster){
        rtcPeerConnections[student_id].setRemoteDescription(new RTCSessionDescription(event)).catch(
            ()=>{ console.log("The error occured while processing the answer of student: ", student_id) }
        );
        console.log(socket.id, " is handling the answer event (so I'm supposed to be a teacher)" + " from " + String(student_id)
                    + " which means I'm setting remote description");
    }   
})

socket.on('username', function(sender_username) {
    if (isBroadcaster){
        student_username = sender_username;
    }
})

/////////////////////////// Student only message handlers
socket.on('joined', function (room) {
    navigator.mediaDevices.getUserMedia(streamConstraints).then(function (stream) {
        localStream = stream;
        localVideo = createVideo(stream, "You", true);
        isBroadcaster = false;
        socket.emit('ready', roomNumber, socket.id);
    }).catch(function (err) {
        console.log('An error ocurred when accessing media devices', err);
    });
    console.log(socket.id, '(me) is a student');
});

socket.on('offer', function (event, sender_username) {
    if (!isBroadcaster) {
        broadcaster_username = sender_username;
        rtcPeerConnection = new RTCPeerConnection(servers);
        rtcPeerConnection.onicecandidate = onIceCandidate;
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
        console.log(socket.id, " is handling the offer event (so I'm supposed to be a student)"
                    + " which means I'm creating answer")
    }
});



// Handlers of both roles

// when icecandidate event is fired after a call of setLocalDescription(). This handler will send ice candidate 
// to the other end of the call
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

// When receiving ICE candidate from the other end
socket.on('candidate', function (event, sender_id) {
    var candidate = new RTCIceCandidate(event.candidate);
    console.log("Receive this candidate: " + JSON.stringify(event) + " from " + String(sender_id));
    if (isBroadcaster){
        rtcPeerConnections[sender_id].addIceCandidate(candidate).then(function() {
            console.log("added ICE candidate from: " + String(sender_id));
        })
        .catch(e => {
            console.log("Failure during addIceCandidate(): " + e.name);
        }
        )
    }   
    else{
            rtcPeerConnection.addIceCandidate(candidate).then(function() {
                console.log("added ICE candidate from: " + String(sender_id));
            })
            .catch(e => {
                console.log("Failure during addIceCandidate(): " + e.name);
            }
            )
    }
    
    
});

function onTrackHandler(event) {

    if (!receivedStreamsId.includes(event.streams[0].id)) {
        createVideo(event.streams[0], isBroadcaster ? student_username : broadcaster_username)
        receivedStreamsId.push(event.streams[0].id);
    }  
    console.log("receivedStreamsId: ", receivedStreamsId);
}

function createVideo(src, caption, isMuted)
{
    let fig = document.createElement("figure")

    let video = document.createElement("video");
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

    divConsultingRoom.appendChild(fig)
    return fig;
}

