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
            answer: 0,
        };
    },
    created() {
        this.initSocket();
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
                console.log('websocket opened');
            };
            this.ws.onmessage = (e) => {
                let { data, userId, targetUserId, label, sdp } = JSON.parse(
                    e.data
                ).data;
                console.log(
                    'socket监听onmessage',
                    JSON.parse(e.data).data,
                    'data',
                    JSON.parse(e.data)
                );
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
                        console.log('*****call');
                        this.icecandidate(this.localStream);
                        this.createOffer();
                        break;
                    case 'client-answer':
                        this.pc.setRemoteDescription(
                            new RTCSessionDescription({
                                type: 'answer',
                                sdp: sdp,
                            })
                        );
                        console.log('****answer');
                        break;
                    case 'client-offer':
                        console.log('client-offer');
                        this.icecandidate(this.localStream);
                        this.pc.setRemoteDescription(
                            new RTCSessionDescription({
                                type: 'offer',
                                sdp: sdp,
                            }),
                            () => {
                                this.pc.createAnswer(
                                    (desc) => {
                                        this.pc.setLocalDescription(
                                            desc,
                                            () => {
                                                this.publish(
                                                    'client-answer',
                                                    this.pc.localDescription
                                                );
                                            },
                                            (e) => {
                                                alert(e);
                                            }
                                        );
                                    },
                                    (e) => {
                                        alert(e);
                                    }
                                );
                            },
                            (e) => {
                                alert(e);
                            }
                        );
                        console.log('****offer');
                        break;
                    case 'client-candidate':
                        console.log('******candidate');
                        this.pc.addIceCandidate(
                            new RTCIceCandidate(JSON.parse(e.data).data)
                        );
                        break;
                }
            };
            this.ws.onerror = (e) => {
                console.log('wserror', e);
            };
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
            console.log('CreateOfferSdp:', sessionDescription);
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
            console.log('Broadcast Offer:', message);
        },
        createAnswerAndSendMessage(sessionDescription) {
            console.log('CreateAnswerSdp:', sessionDescription);
            this.pc.setLocalDescription(sessionDescription);
            var message = {
                sdp: sessionDescription.sdp,
            };
            this.publish(
                'client-answer',
                message,
                this.localUserId,
                this.remoteUserId
            );
            console.log('Broadcast Answer:', message);
        },
        icecandidate(localStream) {
            this.pc = new RTCPeerConnection(this.configuration);
            this.pc.onicecandidate = (event) => {
                // console.log('onicecandidate', event);
                if (event.candidate) {
                    this.publish('client-candidate', event.candidate);
                }
            };
            const tracks = localStream.getTracks();
            for (let i = 0; i < tracks.length; i++) {
                this.pc.addTrack(tracks[i], localStream);
            }
            this.pc.ontrack = (e) => {
                // debugger;
                console.log(e, '*********onaddstream');
                let remoteVidoe = document.createElement('video');
                remoteVidoe.autoplay = 'autoplay';
                remoteVidoe.srcObject = e.streams[0];
                document
                    .getElementsByClassName('videos')[0]
                    .appendChild(remoteVidoe);
            };
        },
        //发送websocket消息
        publish(event, data) {
            // debugger;
            // data.userId = localUserId;
            // data.targetUserId = targetUserId;
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
                    audio: true,
                    video: true,
                })
                .then((stream) => {
                    console.log(stream, 'stream========');
                    let localVideo = document.getElementById('localVideo');
                    localVideo.srcObject = stream;
                    this.localStream = stream;
                    localVideo.addEventListener('loadedmetadata', () => {
                        console.log('视频加载完毕', this.localStream);
                        console.log('localUserId', this.localUserId);
                        let msg = {};
                        this.publish('client-call', msg, this.localUserId);
                    });
                    // this.openLocalStream(stream);
                })
                .catch((e) => {
                    alert(e);
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
