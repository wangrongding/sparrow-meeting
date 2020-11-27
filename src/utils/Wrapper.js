////////////////////////////////////////////////////
//发送websocket消息
export function publish(event, data, localUserId, targetUserId = null) {
    // debugger;
    data.userId = localUserId;
    data.targetUserId = targetUserId;
    let jsonstr = JSON.stringify({
        cmd: "publish",
        subject: this.subject,
        event: event,
        data: data,
    });
    this.ws.send(jsonstr);
}

export function RTCPeerConnectionWrapper(
    localUserId,
    remoteUserId,
    localStream,
    configuration
) {
    this.localUserId = localUserId;
    this.remoteUserId = remoteUserId;
    this.pc = this.create(localStream, configuration);
    this.remoteSdp = null;
}

RTCPeerConnectionWrapper.prototype.create = function(stream, configuration) {
    var pc = new RTCPeerConnection(configuration);
    pc.onicecandidate = this.handleIceCandidate.bind(this);
    pc.onaddstream = this.handleRemoteStreamAdded.bind(this);
    pc.onremovestream = this.handleRemoteStreamRemoved.bind(this);
    pc.addStream(stream);
    return pc;
};

RTCPeerConnectionWrapper.prototype.close = function() {
    this.pc.close();
};

RTCPeerConnectionWrapper.prototype.handleIceCandidate = function(event) {
    if (event.candidate) {
        var message = {
            id: event.candidate.sdpMid,
            label: event.candidate.sdpMLineIndex,
            candidate: event.candidate.candidate,
        };
        publish("client-candidate", message, localUserId, this.remoteUserId);
        console.log("Broadcast Candidate:", message);
    } else {
        console.log("End of candidates.");
    }
};

RTCPeerConnectionWrapper.prototype.handleRemoteStreamAdded = function(event) {
    console.log("Remote stream added: ", this.remoteUserId);
    addVideo(this.remoteUserId, event.stream);
};

RTCPeerConnectionWrapper.prototype.handleRemoteStreamRemoved = function(event) {
    console.log("Handle remote stream removed.");
};

RTCPeerConnectionWrapper.prototype.createOffer = function() {
    this.pc.createOffer(
        this.createOfferAndSendMessage.bind(this),
        this.handleCreateOfferError.bind(this)
    );
};

RTCPeerConnectionWrapper.prototype.createAnswer = function() {
    this.pc
        .createAnswer()
        .then(
            this.createAnswerAndSendMessage.bind(this),
            this.handleCreateAnswerError.bind(this)
        );
};

RTCPeerConnectionWrapper.prototype.createOfferAndSendMessage = function(
    sessionDescription
) {
    console.log("CreateOfferSdp:", sessionDescription);
    this.pc.setLocalDescription(sessionDescription);
    var message = {
        sdp: sessionDescription.sdp,
    };
    publish("client-offer", message, localUserId, this.remoteUserId);
    console.log("Broadcast Offer:", message);
};

RTCPeerConnectionWrapper.prototype.createAnswerAndSendMessage = function(
    sessionDescription
) {
    console.log("CreateAnswerSdp:", sessionDescription);
    this.pc.setLocalDescription(sessionDescription);
    var message = {
        sdp: sessionDescription.sdp,
    };
    publish("client-answer", message, localUserId, this.remoteUserId);
    console.log("Broadcast Answer:", message);
};

RTCPeerConnectionWrapper.prototype.handleCreateOfferError = function(event) {
    console.log("CreateOffer() error: ", event);
};

RTCPeerConnectionWrapper.prototype.handleCreateAnswerError = function(error) {
    console.log("CreateAnswer() error: ", error);
};

RTCPeerConnectionWrapper.prototype.setRemoteDescription = function(
    sessionDescription
) {
    if (this.remoteSdp != null) {
        return;
    }
    this.remoteSdp = sessionDescription;
    this.pc.setRemoteDescription(sessionDescription);
};

RTCPeerConnectionWrapper.prototype.addIceCandidate = function(candidate) {
    this.pc.addIceCandidate(candidate);
};
