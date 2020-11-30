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
                width="640"
                height="350"
                autoplay
                muted="true"
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
            answer: 0,
        };
    },
    created() {
        this.initSocket();
        /* window.onbeforeunload = function () {
            setTimeout(onunloadcancel, 10);
            return '真的离开?';
        };

        window.onunloadcancel = function () {
            console.log('close');
            this.pc.close();
        }; */
    },
    destroyed() {
        /*  if (this.pc) {
            this.pc.close();
        } */
    },
    methods: {
        initSocket() {
            this.localUserId = Math.random().toString(36).substr(2);
            this.ws = new WebSocket('wss://webrtc.ncyymt.com:8877');
            // 基于订阅，把房间id作为主题
            this.subject = 'private-video-room-' + this.joinForm.roomId;
            this.ws.onopen = () => {
                this.connect();
                this.subscribe(this.subject); //加入房间
                // console.log('websocket opened');
            };
            this.ws.onmessage = (e) => {
                let { userId, targetUserId, label, sdp } = JSON.parse(
                    e.data
                ).data;
                let data = JSON.parse(e.data).data;
                //不允许自己发给自己
                if (this.localUserId == userId) {
                    return;
                }
                // if message is not send to me. ignore it
                if (targetUserId && targetUserId != this.localUserId) {
                    return;
                }
                switch (JSON.parse(e.data).event) {
                    case 'client-call':
                        console.log('userId', userId);
                        this.createPc(this.localStream);
                        this.createOffer();
                        break;
                    case 'client-answer':
                        this.pc.setRemoteDescription(
                            new RTCSessionDescription({
                                type: 'answer',
                                sdp: sdp,
                            })
                        );
                        break;
                    case 'client-offer':
                        console.log('userId', userId);
                        this.handleRemoteOffer(sdp, userId);
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
            this.ws.onerror = (e) => {
                console.error('wserror', e);
            };
        },
        handleRemoteOffer(sdp, remoteUserId) {
            // set remote sdp
            var sdpData = new RTCSessionDescription({
                type: 'offer',
                sdp: sdp,
            });
            this.createPc(this.localStream);
            this.pc.setRemoteDescription(sdpData);
            this.pc.createAnswer().then(
                (desc) => {
                    this.createAnswerAndSendMessage(desc);
                },
                (e) => {
                    console.error('client-offer中捕获的错误', e);
                }
            );
        },
        createAnswerAndSendMessage(desc) {
            // console.log('CreateAnswerSdp:', desc);
            this.pc.setLocalDescription(desc).catch((e) => {
                console.error('createAnswerAndSendMessage中捕获的 错误', e);
            });
            var message = {
                sdp: desc.sdp,
            };
            this.publish(
                'client-answer',
                message,
                this.localUserId,
                this.remoteUserId
            );
            // console.log('Broadcast Answer:', message);
        },
        handleRemoteCandidate(label, candidate, remoteUserId) {
            /* console.log('Remote candidate received: ', remoteUserId);
            if (peerConnections[remoteUserId] == null) {
                console.log(
                    'Invlid state, can not find the offerer ',
                    remoteUserId
                );
                return;
            } */
            var candidateData = new RTCIceCandidate({
                sdpMLineIndex: label,
                candidate: candidate,
            });
            this.pc.addIceCandidate(candidateData);
        },
        createOffer() {
            this.pc
                .createOffer({ offerToReceiveAudio: 1, offerToReceiveVideo: 1 })
                .then((desc) => {
                    this.createOfferAndSendMessage(desc),
                        this.handleCreateOfferError(desc);
                });
        },
        handleCreateOfferError(event) {
            console.log('CreateOffer() error: ', event);
        },
        createOfferAndSendMessage(sessionDescription) {
            // console.log('CreateOfferSdp:', sessionDescription);
            this.pc.setLocalDescription(sessionDescription);
            var message = {
                sdp: sessionDescription.sdp,
            };
            this.publish(
                'client-offer',
                message,
                this.localUserId,
                this.remoteUserId
            );
            // console.log('Broadcast Offer:', message);
        },

        createPc(localStream) {
            this.pc = new RTCPeerConnection(this.configuration);
            this.pc.onaddstream = this.handleRemoteStreamAdded();
            // this.pc.onicecandidate = this.handleIceCandidate(event);
            this.pc.onicecandidate = (event) => {
                if (event.candidate) {
                    var message = {
                        id: event.candidate.sdpMid,
                        label: event.candidate.sdpMLineIndex,
                        candidate: event.candidate.candidate,
                    };
                    this.publish(
                        'client-candidate',
                        message,
                        this.localUserId,
                        this.remoteUserId
                    );
                } else {
                    console.log('peerConnections', this.pc);
                    console.log('End of candidates.');
                }
            };
            this.pc.onremovestream = this.handleRemoteStreamRemoved();
            this.pc.onconnectionstatechange = this.handleConnectionstatechange();
            const tracks = localStream.getTracks();
            for (let i = 0; i < tracks.length; i++) {
                this.pc.addTrack(tracks[i], localStream);
            }
        },
        handleRemoteStreamRemoved() {
            console.log('Handle remote stream removed.');
        },
        removeVideo(userId) {
            var video = document.getElementById(userId);
            if (video) {
                peerConnections[userId] = null;
                video.remove();
            }
        },
        handleConnectionstatechange() {
            console.log(
                '00000000000handleConnectionstatechange000000000',
                this.pc.connectionState
            );
            switch (this.pc.connectionState) {
                case 'connected':
                    console.log('11111111111111connected');
                    // The connection has become fully connected
                    break;
                case 'disconnected':
                    console.log('22222222222222disconnected');
                    // removeVideo(this.remoteUserId);
                    break;
                case 'failed':
                    console.log('3333333333333333333333failed');
                    // One or more transports has terminated unexpectedly or in an error
                    // removeVideo(this.remoteUserId);
                    break;
                case 'closed':
                    console.log('4444444444444444444444closed');
                    // The connection has been closed
                    // removeVideo(this.remoteUserId);
                    break;
            }
            console.log('onconnectionstatechange.', this.pc.connectionState);
        },
        handleRemoteStreamAdded() {
            let flag = false;
            this.pc.ontrack = (e) => {
                if (flag) {
                    return;
                }
                // debugger;
                console.log(e, '*********onaddstream');
                let remoteVidoe = document.createElement('video');
                remoteVidoe.autoplay = 'autoplay';
                remoteVidoe.width = '640';
                remoteVidoe.height = '350';
                remoteVidoe.srcObject = e.streams[0];
                document
                    .getElementsByClassName('videos')[0]
                    .appendChild(remoteVidoe);
                flag = true;
            };
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
                    this.localUserId,
                    this.remoteUserId
                );
                console.log('Broadcast Candidate:', message);
            } else {
                console.log('peerConnections', this.pc);
                console.log('End of candidates.');
            }
        },
        //发送websocket消息
        publish(event, data) {
            let jsonstr = JSON.stringify({
                cmd: 'publish',
                subject: this.subject,
                event: event,
                data: data,
            });
            this.ws.send(jsonstr);
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
                    audio: {
                        echoCancellation: true, //使用回声消除来尝试去除通过麦克风回传到扬声器的音频
                        noiseSuppression: true, //去除音频信号中的背景噪声
                        channelCount: 2, //立体音
                    },
                    video: {
                        width: 640,
                        height: 350,
                        frameRate: { ideal: 30, max: 60 },
                    },
                })
                .then((stream) => {
                    let localVideo = document.getElementById('localVideo');
                    localVideo.srcObject = stream;
                    this.localStream = stream;
                    localVideo.addEventListener('loadedmetadata', () => {
                        // console.log('视频加载完毕', this.localStream);
                        console.log('localUserId', this.localUserId);
                        // let msg = {};
                        this.publish('client-call', {
                            userId: this.localUserId,
                        });
                    });
                    // this.openLocalStream(stream);
                })
                .catch((e) => {
                    alert(e + '============getUserMedia');
                });
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
    .hidden {
        display: none;
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
