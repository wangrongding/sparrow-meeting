<template>
    <div class="container">
        <div
            class="joinBox"
            v-if="JoinShow"
        >
            <div class="login_center">
                <h3>多人协同房间</h3>
                <el-form
                    @submit.native.prevent
                    ref="joinForm"
                    :model="joinForm"
                    class="login-form"
                    autocomplete="on"
                    label-position="left"
                >
                    <el-form-item prop="roomId">
                        <el-input
                            ref="roomId"
                            v-model="joinForm.roomId"
                            placeholder="请输入房间号"
                            name="roomId"
                            type="text"
                            autocomplete="on"
                            @keyup.enter="join"
                        />
                    </el-form-item>
                    <el-form-item>
                        <el-button
                            :loading="loading"
                            type="primary"
                            style="width:100%;height:40px;"
                            @click.native.prevent="join"
                        >加入房间</el-button>
                    </el-form-item>
                </el-form>
            </div>
            <!-- <button id="startBtn">视频连接</button> -->
        </div>
        <div class="videos">
            <video
                id="localVideo"
                autoplay
                style="width: 640px;height: 480px;"
            ></video>
        </div>
    </div>
</template>

<script>
import { RTCPeerConnectionWrapper } from '@/utils/Wrapper.js';
export default {
    name: 'container',
    props: {
        msg: String,
    },
    data() {
        return {
            joinForm: {
                roomId: '12345',
            },
            JoinShow: false,
            loading: false,
            localUserId: null,
            localStream: null,
            peerConnections: [],
            subject: null,
            ws: null,
            configuration: {
                iceServers: [
                    {
                        urls: 'stun:stun.ideasip.com',
                    },
                ],
            },
            pc: {},
        };
    },
    created() {
        this.initSocket();
        this.connect();
    },
    methods: {
        initSocket() {
            this.localUserId = Math.random().toString(36).substr(2);
            this.ws = new WebSocket('wss://webrtc.ncyymt.com:8877');
            // 基于订阅，把房间id作为主题
            this.subject = 'private-video-room-' + this.joinForm.roomId;
            this.ws.onopen = () => {
                this.subscribe(this.subject); //加入房间
                console.log('websocket opened');
            };
            this.ws.onmessage = (e) => {
                let { data, userId, targetUserId } = JSON.parse(e.data).data;
                console.log('socket监听', JSON.parse(e.data).data);
                //不允许自己发给自己
                if (this.localUserId == userId) {
                    return;
                }
                // if message is not send to me. ignore it
                if (targetUserId && targetUserId != this.localUserId) {
                    return;
                }
                /*  if (!this.localStream) {
                    return;
                } */
                switch (JSON.parse(e.data).event) {
                    case 'client-call':
                        // debugger;
                        this.autoSetupCall(userId);
                        break;
                    case 'client-answer':
                        this.handleRemoteAnswer(data.sdp, userId);
                        break;
                    case 'client-offer':
                        this.handleRemoteOffer(data.sdp, userId);
                        break;
                    case 'client-candidate':
                        this.handleRemoteCandidate(
                            data.label,
                            data.candidate,
                            userId
                        );
                        break;
                }
            };
            this.ws.onerror = function (e) {
                console.log('wserror', e);
            };
        },
        //发送websocket消息
        publish(event, data, localUserId, targetUserId = null) {
            // debugger;
            data.userId = localUserId;
            data.targetUserId = targetUserId;
            let jsonstr = JSON.stringify({
                cmd: 'publish',
                subject: this.subject,
                event: event,
                data: data,
            });
            this.ws.send(jsonstr);
        },
        getUrlParam(name) {
            var reg = new RegExp('(^|&)' + name + '=([^&]*)(&|$)');
            var r = window.location.search.substr(1).match(reg);
            if (r != null) return unescape(r[2]);
            return null;
        },
        //加入房间
        subscribe(subject) {
            this.ws.send(
                JSON.stringify({
                    cmd: 'subscribe',
                    subject: this.subject,
                })
            );
        },
        join() {
            this.JoinShow = false;
            this.initSocket();
        },
        //连接视频语音
        connect() {
            navigator.mediaDevices
                .getUserMedia({
                    audio: true, //暂时关闭
                    video: true,
                })
                .then((stream) => {
                    console.log(stream, 'stream====================');
                    this.openLocalStream(stream);
                })
                .catch((e) => {
                    alert(e);
                });
        },

        // After joined room, remote peers will `autoSetupCall`, send offer
        handleRemoteOffer(sdp, remoteUserId) {
            console.log('Remote offer received: ', remoteUserId);
            // set remote sdp
            var sdpData = new RTCSessionDescription({
                type: 'offer',
                sdp: sdp,
            });
            console.log('setRemoteDescription & Answer call: ', remoteUserId);
            this.peerConnections[remoteUserId] = new RTCPeerConnectionWrapper(
                this.localUserId,
                this.remoteUserId,
                this.localStream,
                this.configuration
            );
            this.peerConnections[remoteUserId].setRemoteDescription(sdpData);
            this.peerConnections[remoteUserId].createAnswer();

            //================================================
        },

        //================================================
        createRTCPeerConnection(stream, configuration) {
            this.pc = new RTCPeerConnection(configuration);
            this.pc.onicecandidate = this.handleIceCandidate.bind(this);
            this.pc.onaddstream = this.handleRemoteStreamAdded.bind(this);
            this.pc.onremovestream = this.handleRemoteStreamRemoved.bind(this);
            this.pc.addStream(stream);
            return pc;
        },
        handleIceCandidate(event) {
            if (event.candidate) {
                var message = {
                    id: event.candidate.sdpMid,
                    label: event.candidate.sdpMLineIndex,
                    candidate: event.candidate.candidate,
                };
                publish(
                    'client-candidate',
                    message,
                    localUserId,
                    this.remoteUserId
                );
                console.log('Broadcast Candidate:', message);
            } else {
                console.log('End of candidates.');
            }
        },
        handleRemoteStreamAdded(event) {
            console.log('Remote stream added: ', this.remoteUserId);
            addVideo(this.remoteUserId, event.stream);
        },
        handleRemoteStreamRemoved(event) {
            console.log('Handle remote stream removed.');
        },
        createOffer() {
            this.pc.createOffer(
                this.createOfferAndSendMessage.bind(this),
                this.handleCreateOfferError.bind(this)
            );
        },
        createAnswer() {
            this.pc
                .createAnswer()
                .then(
                    this.createAnswerAndSendMessage.bind(this),
                    this.handleCreateAnswerError.bind(this)
                );
        },
        createOfferAndSendMessage(sessionDescription) {
            console.log('CreateOfferSdp:', sessionDescription);
            this.pc.setLocalDescription(sessionDescription);
            var message = {
                sdp: sessionDescription.sdp,
            };
            publish('client-offer', message, localUserId, this.remoteUserId);
            console.log('Broadcast Offer:', message);
        },
        createAnswerAndSendMessage(sessionDescription) {
            console.log('CreateAnswerSdp:', sessionDescription);
            this.pc.setLocalDescription(sessionDescription);
            var message = {
                sdp: sessionDescription.sdp,
            };
            publish('client-answer', message, localUserId, this.remoteUserId);
            console.log('Broadcast Answer:', message);
        },
        handleCreateOfferError(event) {
            console.log('CreateOffer() error: ', event);
        },
        handleCreateAnswerError(error) {
            console.log('CreateAnswer() error: ', error);
        },
        setRemoteDescription(sessionDescription) {
            if (this.remoteSdp != null) {
                return;
            }
            this.remoteSdp = sessionDescription;
            this.pc.setRemoteDescription(sessionDescription);
        },
        addIceCandidate(candidate) {
            this.pc.addIceCandidate(candidate);
        },
        //================================================
        // After `autoSetupCall`, wait for the remote peer anwser the offer
        handleRemoteAnswer(sdp, remoteUserId) {
            console.log('Remote answer received: ', remoteUserId);
            if (peerConnections[remoteUserId] == null) {
                console.log(
                    'Invlid state, can not find the offerer ',
                    remoteUserId
                );
                return;
            }
            var sdpData = new RTCSessionDescription({
                type: 'answer',
                sdp: sdp,
            });
            this.peerConnections[remoteUserId].setRemoteDescription(sdpData);
        },

        handleRemoteCandidate(label, candidate, remoteUserId) {
            console.log('Remote candidate received: ', remoteUserId);
            if (this.peerConnections[remoteUserId] == null) {
                console.log(
                    'Invlid state, can not find the offerer ',
                    remoteUserId
                );
                return;
            }
            var candidateData = new RTCIceCandidate({
                sdpMLineIndex: label,
                candidate: candidate,
            });
            this.peerConnections[remoteUserId].addIceCandidate(candidateData);
        },

        handleRemoteHangup(remoteUserId) {
            console.log('Remote hangup received: ', remoteUserId);
            if (peerConnections[remoteUserId] == null) {
                console.log(
                    'Invlid state, can not find the offerer ',
                    remoteUserId
                );
                return;
            }
            this.peerConnections[remoteUserId].close();
        },
        openLocalStream(stream) {
            console.log('Open local video stream');
            let localVideo = document.getElementById('localVideo');
            localVideo.srcObject = stream;
            this.localStream = stream;
            localVideo.addEventListener('loadedmetadata', () => {
                console.log('视频加载完毕', this.localStream);
                console.log('localUserId', this.localUserId);
                let msg = {};
                this.publish('client-call', msg, this.localUserId);
            });
        },
        // auto setup call by create & send offer when remote user joined room
        autoSetupCall(remoteUserId) {
            // debugger;
            console.log(
                'autoSetupCall: Sending offer to remote peer:',
                remoteUserId,
                this.peerConnections
            );
            if (this.peerConnections[remoteUserId] == null) {
                this.peerConnections[
                    remoteUserId
                ] = new RTCPeerConnectionWrapper(
                    this.localUserId,
                    this.remoteUserId,
                    this.localStream,
                    this.configuration
                );
            }
            this.peerConnections[remoteUserId].createOffer();
        },

        sendMessage(event, message) {
            socket.send(event, message);
        },
        addVideo(userId, stream) {
            //如果追加的视频和本地是一样的则不处理
            console.log(userId);
            // if (localUserId == userId) {
            //     return;
            // }
            if (userId) {
                let remote =
                    "<video id='" +
                    userId +
                    "' class='remoteVideo' autoplay style='width: 640px;height: 480px;'></video>";
                document.querySelector('.videos').append(remote);
                let remoteVideo = document.getElementById(userId);
                remoteVideo.srcObject = stream;
            }
        },
    },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="less">
.container {
    height: 100vh;
    width: 100vw;
    background: rgb(252, 244, 208);
    #startBtn {
        width: 300px;
        height: 100px;
        margin: 0 auto;
    }
    .joinBox {
        z-index: 999;
        position: absolute;
        left: 0;
        top: 0;
        background: url('../assets/bg.jpg');
        width: 100vw;
        height: 100vh;
        .login_center {
            text-align: center;
            width: 300px;
            background: rgba(255, 255, 255, 0.842);
            border-radius: 30px;
            padding: 25px 40px;
            float: right;
            margin-top: 300px;
            margin-right: 200px;
            // position: unset;
            // right: 100px;
            // top: 300px;

            img {
                width: 50px;
            }
            /deep/ .el-input__inner {
                width: 100%;
                border: none;
                border-bottom: 1px solid #dcdfe6;
                margin-bottom: 10px;
                border-radius: 0;
            }
            .login_entering {
                float: right;
                margin-top: 5px;
            }
            .login_btn {
                width: 100%;
                background: #3171ff;
                color: #fff;
                text-align: center;
                padding: 10px 0;
                border-radius: 3px;
                float: left;
                margin-top: 30px;
            }
        }
    }
}
</style>
