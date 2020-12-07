<template>
    <div class="container">
        <div
            class="joinBox"
            v-if="JoinShow"
        >
            <div class="join_center">
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
        </div>

        <div class="videos">
            <div class="videoItem">
                <video
                    id="mainVideo"
                    muted="true"
                    autoplay
                ></video>

            </div>
        </div>
        <el-drawer
            size="300"
            title="当前房间用户列表"
            :visible.sync="drawerShow"
            :wrapperClosable="false"
            direction="rtl"
            :modal="false"
        >
            <div class="sidebar">
                <video
                    class="sideUser"
                    id="localVideo"
                    muted="true"
                    width="300px"
                    autoplay
                ></video>
            </div>
        </el-drawer>

        <div class="handlebar">
            <div
                class="handleItem"
                @click="connect"
            >
                <i class="el-icon-position"></i>
                <p>连接</p>
            </div>
            <div
                :class="tempSignVideo?'handleItem':'handleItem disenabledBt'"
                @click="videoEnabledChange"
            >
                <i class="el-icon-video-camera-solid"></i>
                <p>视频</p>
            </div>
            <div
                :class="tempSignAudio?'handleItem':'handleItem disenabledBt'"
                @click="audioEnabledChange"
            >
                <i class="el-icon-microphone"></i>
                <p>音频</p>
            </div>
            <div
                class="handleItem"
                @click="screenSharing"
            >
                <i class="el-icon-monitor"></i>
                <p>分享屏幕</p>
            </div>
            <div
                class="handleItem"
                @click="consolePcInfo"
            >
                <i class="el-icon-chat-line-round"></i>
                <p>消息记录</p>
            </div>
            <div
                class="handleItem closeBt"
                @click="closePc"
            >
                <i class="el-icon-error"></i>
                <p>退出</p>
            </div>
            <div
                class="handleItem"
                @click="drawerShow=!drawerShow"
            >
                <i class="el-icon-user-solid"></i>
                <p>用户列表</p>
            </div>
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
                roomId: '123',
            },
            subject: null,
            JoinShow: false,
            loading: false,
            localUserId: null,
            remoteUserId: null,
            localStream: null,
            ws: null,
            configuration: {
                iceServers: [
                    {
                        urls: ['turn:122.112.210.91:3478?transport=udp'],
                        username: 'lvlei',
                        credential: 'lvlei',
                    },
                ],
            },

            pc: {},
            remoteSdp: {},
            answer: 0,
            tempSignVideo: true,
            tempSignAudio: true,
            drawerShow: true,
            peer: null,
            peerList: {},
        };
    },
    created() {
        this.initSocket();
        this.handleIconType();
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
        consolePcInfo() {
            console.log(this.pc, 'this.pc');
        },
        //控制底部操作栏图标颜色
        handleIconType() {
            if (this.localStream == null) {
                this.tempSignVideo = true;
                this.tempSignAudio = true;
                return;
            }
            if (this.localStream.getAudioTracks()[0].enabled) {
                this.tempSignAudio = true;
            } else {
                this.tempSignAudio = false;
            }
            if (this.localStream.getVideoTracks()[0].enabled) {
                this.tempSignVideo = true;
            } else {
                this.tempSignVideo = false;
            }
            console.log(this.tempSignVideo, this.tempSignAudio);
        },
        //控制音频开启关闭
        audioEnabledChange() {
            this.localStream.getAudioTracks()[0].enabled = !this.localStream.getAudioTracks()[0]
                .enabled;
            this.handleIconType();
        },
        //控制视频开启关闭
        videoEnabledChange() {
            this.localStream.getVideoTracks()[0].enabled = !this.localStream.getVideoTracks()[0]
                .enabled;
            this.handleIconType();
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
                        // width: 640,
                        // height: 400,
                        frameRate: { ideal: 30, max: 60 },
                    },
                    /* audio: true,
                    video: true, */
                })
                .then(
                    (stream) => {
                        this.openLocalStream(stream);
                    },
                    (e) => {
                        this.$message({
                            type: 'error',
                            message: e + '==>getUserMedia',
                        });
                    }
                );
        },
        //分享屏幕
        screenSharing() {
            navigator.mediaDevices
                .getDisplayMedia({
                    audio: true,
                    video: {
                        width: 640,
                        height: 350,
                        frameRate: { ideal: 30, max: 60 },
                    },
                })
                .then(
                    (stream) => {
                        this.openLocalStream(stream);
                    },
                    (e) => {
                        alert(e + '============getUserMedia');
                    }
                );
        },
        openLocalStream(stream) {
            let localVideo = document.getElementById('localVideo');
            localVideo.srcObject = stream;
            this.localStream = stream;
            localVideo.addEventListener('loadedmetadata', () => {
                console.log('localUserId', this.localUserId);
                this.publish('client-call', {
                    userId: this.localUserId,
                });
            });
        },
        sendMessage() {
            console.log('sendMessage', this.remoteUserId);
            this.pcChannel.send(this.remoteUserId);
        },
        closePc() {
            this.pcChannel.send(this.remoteUserId);
            this.pc[this.remoteUserId].close();
            this.pc[this.remoteUserId] = null;
            // window.location.reload();
            /*  console.log('close?', this.pc.connectionState);
            this.pcChannel.send(this.remoteUserId);
            document.getElementById(this.remoteUserId).remove();
            this.pc.close();
            window.location.reload(); */
        },
        initSocket() {
            this.localUserId = Math.random().toString(36).substr(2);
            // 基于订阅，把房间id作为主题
            this.subject = 'private-video-room-' + this.joinForm.roomId;
            this.ws = new WebSocket('wss://webrtc.ncyymt.com:8877');
            this.ws.onopen = () => {
                this.subscribe(this.subject); //加入房间
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
                if (userId) {
                    this.remoteUserId = userId;
                }
                switch (JSON.parse(e.data).event) {
                    case 'client-call':
                        console.log('client-call==>', userId);
                        !this.pc[this.remoteUserId] && this.createOffer(userId);
                        break;
                    case 'client-offer':
                        console.log('client-offer==>', userId);
                        !this.pc[this.remoteUserId] &&
                            this.handleRemoteOffer(sdp, userId);
                        break;
                    case 'client-answer':
                        this.pc[this.remoteUserId] &&
                            this.pc[this.remoteUserId].setRemoteDescription(
                                new RTCSessionDescription({
                                    type: 'answer',
                                    sdp: sdp,
                                })
                            );
                        // debugger;
                        break;
                    case 'client-candidate':
                        console.log('client-candidate===>', userId);
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
        async handleRemoteOffer(sdp, remoteUserId) {
            // set remote sdp
            var sdpData = new RTCSessionDescription({
                type: 'offer',
                sdp: sdp,
            });
            await this.createPc(this.localStream, remoteUserId);
            // console.log(
            //     'handleRemoteOffer===>this.pc[remoteUserId]',
            //     this.pc[remoteUserId]
            // );
            this.remoteSdp[remoteUserId] = sdpData;
            // this.setRemoteDescription(sdpData, remoteUserId);

            this.pc[remoteUserId].setRemoteDescription(sdpData, () => {
                this.pc[remoteUserId].createAnswer().then(
                    (desc) => {
                        this.createAnswerAndSendMessage(desc, remoteUserId);
                    },
                    (e) => {
                        console.error('client-offer中捕获的错误', e);
                    }
                );
            });
            // debugger;
        },
        createAnswerAndSendMessage(desc, remoteUserId) {
            this.pc[this.remoteUserId]
                .setLocalDescription(desc)
                .then(() => {
                    var message = {
                        sdp: desc.sdp,
                        userId: this.localUserId,
                        targetUserId: remoteUserId,
                    };
                    this.publish('client-answer', message);
                })
                .catch((e) => {
                    console.error('createAnswerAndSendMessage中捕获的 错误', e);
                });
        },
        setRemoteDescription(sdpData, remoteUserId) {
            // console.log(
            //     this.pc[remoteUserId],
            //     '===========setRemoteDescription=========='
            // );
            if (this.remoteSdp[remoteUserId] != null) {
                return;
            }
            this.pc[remoteUserId].setRemoteDescription(sdpData);
        },

        handleRemoteCandidate(label, candidate, remoteUserId) {
            /* if (this.pc[remoteUserId] == null) {
                return;
            } */
            var candidateData = new RTCIceCandidate({
                sdpMLineIndex: label,
                candidate: candidate,
            });
            // console.log('handleRemoteCandidate==>', candidateData);
            this.pc[remoteUserId].addIceCandidate(candidateData);
        },
        createOffer(remoteUserId) {
            if (this.pc[remoteUserId] == null) {
                this.createPc(this.localStream, remoteUserId);
            }
            // debugger;
            // console.group(this.pc[remoteUserId], remoteUserId);
            this.createOfferAndSendMessage(remoteUserId);
        },
        createOfferAndSendMessage(remoteUserId) {
            this.pc[remoteUserId].createOffer().then(
                (desc) => {
                    this.pc[remoteUserId]
                        .setLocalDescription(desc)
                        .then(() => {
                            var message = {
                                sdp: desc.sdp,
                                userId: this.localUserId,
                                targetUserId: remoteUserId,
                            };
                            this.publish('client-offer', message);
                        })
                        .catch((e) => {
                            console.error('createOfferAndSendMessage', e);
                        });
                },
                (err) => {
                    console.error('CreateOffer error: ', err);
                }
            );
        },
        initDataChannel(remoteUserId, peer) {
            this.pcChannel = peer.createDataChannel('myChat', {
                negotiated: true,
                id: 0,
            });
            this.pcChannel.onmessage = function (event) {
                console.log('收到的数据', event);
            };
        },
        createPc(localStream, remoteUserId) {
            //兼容浏览器的PeerConnection写法
            const PeerConnection =
                window.RTCPeerConnection ||
                window.webkitRTCPeerConnection ||
                window.mozRTCPeerConnection;

            let peer = new PeerConnection(this.configuration);
            this.initDataChannel(remoteUserId, peer);
            peer.ontrack = this.handleRemoteStreamAdded.bind(
                this,
                remoteUserId
            );

            peer.onnegotiationneeded = (e) => {
                // console.log(e, '*********onnegotiationneeded*******');
                // console.log('*******signalingState***', peer.signalingState);
            };
            peer.onremovestream = (e) => {
                this.handleRemoteStreamRemoved(e);
            };
            peer.onicecandidate = (e) => {
                console.log('handleIceCandidate==>', this.pc);
                this.handleIceCandidate(e);
            };
            peer.onconnectionstatechange = (e) => {
                this.handleConnectionstatechange(e);
            };
            const tracks = localStream.getTracks();
            for (let i = 0; i < tracks.length; i++) {
                peer.addTrack(tracks[i], localStream);
            }
            this.pc[remoteUserId] = peer;
        },

        removeVideo(userId) {
            var video = document.getElementById(userId);
            if (video) {
                peerConnections[userId] = null;
                video.remove();
            }
        },
        handleRemoteStreamRemoved(e) {
            // console.log('onremovestream***', e);
        },
        handleConnectionstatechange(e) {
            switch (this.pc[this.remoteUserId].connectionState) {
                case 'connected':
                    break;
                case 'disconnected':
                    this.$message({
                        type: 'warning',
                        message: '连接中断!',
                    });
                    document.getElementById(this.remoteUserId).remove();
                    document
                        .getElementById('mainVideo')
                        .srcObject.getVideoTracks()[0].enabled = false;
                    break;
                case 'failed':
                    break;
                case 'closed':
                    break;
            }
            // console.log(
            //     'handleConnectionstatechange',
            //     this.pc[this.remoteUserId].connectionState
            // );
        },
        handleRemoteStreamAdded(remoteUserId, e) {
            // console.log('*********onaddstream', e, this.localStream);
            if (document.getElementById(this.remoteUserId)) {
                return;
            }
            let mainVideo = document.getElementById('mainVideo');
            let remoteVidoe = document.createElement('video');
            mainVideo.srcObject = e.streams[0];
            remoteVidoe.srcObject = e.streams[0];
            remoteVidoe.id = this.remoteUserId;
            remoteVidoe.className = 'sideUser';
            remoteVidoe.autoplay = 'autoplay';
            remoteVidoe.width = '300';
            // remoteVidoe.height = '180';
            document
                .getElementsByClassName('sidebar')[0]
                .appendChild(remoteVidoe);
        },
        handleIceCandidate(event) {
            if (event.candidate) {
                var message = {
                    id: event.candidate.sdpMid,
                    label: event.candidate.sdpMLineIndex,
                    candidate: event.candidate.candidate,
                    userId: this.localUserId,
                    targetUserId: this.remoteUserId,
                };
                this.publish('client-candidate', message);
            } else {
                // console.log(
                //     'handleIceCandidate=>No',
                //     this.pc[this.remoteUserId],
                //     event
                // );
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
    },
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped lang="less">
.container {
    height: 100vh;
    width: 100vw;
    background: #282c34;
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
        .join_center {
            text-align: center;
            width: 300px;
            background: rgba(255, 255, 255, 0.842);
            border-radius: 30px;
            padding: 25px 40px;
            float: right;
            margin-top: 300px;
            margin-right: 200px;
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
        }
    }
    .videos {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        .videoItem {
            overflow: hidden;
            // margin: 15px;
            // border-radius: 30px;
            video {
                object-fit: cover;
                height: calc(100vh - 4px);
                width: calc(100vw - 4px);
                // height: 100%;
                // width: 100%;
                max-height: 100%;
                max-width: 100%;
            }
        }
    }
    .handlebar {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 70px;
        vertical-align: bottom;
        background: rgba(0, 0, 0, 0.5);
        text-align: left;
        padding: 10px 100px 0;
        box-sizing: border-box;
        display: flex;
        flex-direction: row;
        justify-content: flex-start;
        .handleItem {
            position: relative;
            width: 90px;
            cursor: pointer;
            text-align: center;
            display: inline-block;
            color: white;
            // margin: 0 10px;
            &:hover {
                background: rgba(255, 255, 255, 0.842);
            }
            p {
                height: 20px;
                margin: 0;
                padding: 0;
            }
            i {
                display: inline-block;
                line-height: 29px;
                font-size: 29px;
            }
        }
        .disenabledBt {
            color: rgb(163, 162, 162);
        }
        .disenabledBt::after {
            position: absolute;
            left: 40px;
            top: 0px;
            content: '/';
            color: red;
            margin: 0 auto;
            font-size: 30px;
            font-weight: bold;
            display: block;
            line-height: 30px;
            height: 30px;
        }
        .closeBt {
            border-radius: 30px;
            background: #fff;
            position: absolute;
            right: 100px;
            color: rgb(221, 6, 6);
            margin: 0 auto;
        }
    }
    //el-drawer自定义样式
    /deep/ .el-drawer__wrapper {
        z-index: unset !important;
    }
    /deep/ .el-drawer__header {
        padding: 0px;
        margin: 0;
    }
    /deep/ .el-drawer:focus {
        outline: none;
    }
    /deep/ .el-drawer__header span:focus {
        outline: none;
    }
    /deep/ .el-drawer,
    .rtl {
        outline: none;
        background: transparent;
        bottom: unset !important;
        height: unset;
    }
    .sidebar {
        max-height: calc(100vh - 70px);
        overflow: auto;
        width: 300px;
        background: rgba(0, 0, 0, 0.5);
        // position: absolute;
        // right: 0;
        // top: 0;
        .sideUser {
            overflow: hidden;
            border-radius: 10px;
            margin: 10px 0px;
        }
    }
}
</style>
