<template>
    <div class="container">

        <el-drawer
            size="375"
            :visible.sync="drawerShow"
            :wrapperClosable="false"
            direction="rtl"
            :modal="false"
        >
            <template #title>
                <h3 style="color: #fff">当前房间用户列表</h3>
            </template>
            <div class="sidebar">
                <audio
                    class="sideUser"
                    id="localVideo"
                    controls
                    autoplay
                    v-show="localStream"
                ></audio>
            </div>
        </el-drawer>

        <div class="handlebar">
            <div
                class="handleItem"
                :style="isShowItem && { display: 'flex' }"
                @click="connect"
            >
                <i class="el-icon-position"></i>
                <p>连接</p>
            </div>
            <div
                :style="isShowItem && { display: 'flex' }"
                :class="tempSignVideo ? 'handleItem' : 'handleItem disenabledBt'"
                @click="videoEnabledChange"
            >
                <i class="el-icon-video-camera-solid"></i>
                <p>视频</p>
            </div>
            <div
                :style="isShowItem && { display: 'flex' }"
                :class="tempSignAudio ? 'handleItem' : 'handleItem disenabledBt'"
                @click="audioEnabledChange"
            >
                <i class="el-icon-microphone"></i>
                <p>音频</p>
            </div>
            <div
                class="handleItem"
                :style="isShowItem && { display: 'flex' }"
                @click="screenSharing"
            >
                <i class="el-icon-monitor"></i>
                <p>分享屏幕</p>
            </div>
            <div
                class="handleItem"
                :style="isShowItem && { display: 'flex' }"
                @click="consolePcInfo"
            >
                <i class="el-icon-chat-line-round"></i>
                <p>消息记录</p>
            </div>
            <div
                class="handleItem closeBt"
                :style="isShowItem && { display: 'flex' }"
                @click="closePc"
            >
                <i class="el-icon-error"></i>
                <p>退出</p>
            </div>
            <div
                class="handleItem"
                :style="isShowItem && { display: 'flex' }"
                @click="drawerShow = !drawerShow"
            >
                <i class="el-icon-user-solid"></i>
                <p>用户列表</p>
            </div>
            <div
                class="handle-menu"
                @click="isShowItem = !isShowItem"
            >
                <i class="el-icon-menu"></i>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'container',
    data() {
        return {
            isShowItem: false,
            joinForm: {
                roomId: 'test11',
            },
            subject: null,
            loading: false,
            localUserId: null,
            remoteUserId: null,
            localStream: null,
            pc: {},
            dc: {},
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
            tempSignVideo: true,
            tempSignAudio: true,
            drawerShow: true,
        };
    },
    created() {
        this.initSocket();
        this.handleIconType();
        window.onbeforeunload = () => {
            Object.keys(this.pc).forEach(async (key) => {
                await this.dc[key].send(
                    JSON.stringify({ message: 'close', data: this.localUserId })
                );
                this.pc[key].close();
                this.pc[key] = null;
                delete this.pc[key];
                document.getElementById(key).remove();
            });
        };
    },
    methods: {
        /* 初始化WebSocket连接 */
        initSocket() {
            /* 随机生成用户ID */
            this.localUserId = Math.random().toString(36).substr(2);

            // 基于订阅，把房间id作为主题
            this.subject = 'private-video-room-' + this.joinForm.roomId;

            this.ws = new WebSocket('wss://webrtc.ncyymt.com:8877');

            /* 监听连接到信令服务器 */
            this.ws.onopen = () => {
                this.subscribe(this.subject); //加入房间
            };

            /* 监听信令服务器发过来的消息 */
            this.ws.onmessage = async (e) => {
                /* 本地元数据为加载成功 用来屏蔽client-call事件 */
                if (!this.localStream) {
                    console.log('远端有用户加入房间');
                    return;
                }

                let { userId, targetUserId, sdpData, candidate } = JSON.parse(
                    e.data
                ).data;
                let event = JSON.parse(e.data).event;
                if (this.localUserId == userId) {
                    return;
                }
                /* 专门屏蔽信令服务器发送过来的client-offer事件 */
                Object.keys(this.pc).forEach((key) => {
                    if (key === userId) {
                        return;
                    }
                });
                /* 专门屏蔽信令服务器发送过来的client-answer事件 */
                if (targetUserId && targetUserId !== this.localUserId) {
                    return;
                }

                this.remoteUserId = userId;

                switch (event) {
                    case 'client-call':
                        this.offerOperation(this.remoteUserId);
                        break;
                    case 'client-offer':
                        this.handleRemoteOffer(sdpData, this.remoteUserId);
                        break;
                    case 'client-answer':
                        this.handleRemoteAnswer(sdpData, this.remoteUserId);
                        break;
                    case 'client-candidate':
                        this.handleRemoteCandidate(
                            candidate,
                            this.remoteUserId
                        );
                        break;
                }
            };

            /* 监听信令服务器抛出的错误 */
            this.ws.onerror = (e) => {
                console.error('ws error', e);
            };
        },
        //加入房间
        subscribe(subject) {
            this.ws.send(
                JSON.stringify({
                    cmd: 'subscribe',
                    subject,
                })
            );
        },
        //连接音视频
        async connect() {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false,
            });
            this.openLocalStream(stream);
            /* if (!this.localStream) {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: false,
                });
                this.openLocalStream(stream);
            } */
        },
        openLocalStream(stream) {
            const localVideo = document.getElementById('localVideo');
            /* 指定视频/音频（audio/video）的元数据加载后触发 */
            localVideo.addEventListener('loadedmetadata', () => {
                /* 告诉房间里的每个人(除了自己)我来了 */
                this.publish('client-call', {
                    userId: this.localUserId,
                });
            });
            localVideo.srcObject = stream;
            localVideo.muted = true;
            this.localStream = stream;
        },
        async offerOperation(remoteUserId) {
            await this.createPc(this.localStream, remoteUserId);
            await this.createOfferAndSendMessage(remoteUserId);
        },
        createPc(localStream, remoteUserId) {
            const PeerConnection =
                window.RTCPeerConnection ||
                window.webkitRTCPeerConnection ||
                window.mozRTCPeerConnection;

            const peer = new PeerConnection(this.configuration);
            const tracks = localStream.getTracks();
            for (let i = 0; i < tracks.length; i++) {
                peer.addTrack(tracks[i], localStream);
            }
            peer.onicecandidate = (event) => {
                if (event.candidate) {
                    const message = {
                        candidate: event.candidate,
                        userId: this.localUserId,
                        targetUserId: this.remoteUserId,
                    };
                    this.publish('client-candidate', message);
                }
            };
            peer.ontrack = (e) => {
                console.log('远程流加入到本地页面-->：', e);
                if (document.getElementById(remoteUserId)) {
                    return;
                }
                const remoteVidoe = document.createElement('audio');
                remoteVidoe.srcObject = e.streams[0];
                remoteVidoe.id = remoteUserId;
                remoteVidoe.className = 'sideUser';
                remoteVidoe.autoplay = 'autoplay';
                remoteVidoe.controls = 'controls';
                remoteVidoe.width = '375';
                remoteVidoe.height = '250';
                document
                    .getElementsByClassName('sidebar')[0]
                    .appendChild(remoteVidoe);
            };
            peer.ondatachannel = (e) => {
                const channel = e.channel;
                channel.onmessage = (e) => {
                    const data = JSON.parse(e.data);
                    console.log('message', data);
                    switch (data.message) {
                        case 'close':
                            this.pc[data.data].close();
                            this.pc[data.data] = null;
                            delete this.pc[data.data];
                            document.getElementById(data.data).remove();
                            break;
                        default:
                            break;
                    }
                };
            };
            this.dc[remoteUserId] = peer.createDataChannel(remoteUserId);
            this.pc[remoteUserId] = peer;
        },
        async createOfferAndSendMessage(remoteUserId) {
            const desc = await this.pc[remoteUserId].createOffer();
            await this.pc[remoteUserId].setLocalDescription(desc);
            const message = {
                sdpData: this.pc[remoteUserId].localDescription,
                userId: this.localUserId,
                targetUserId: remoteUserId,
            };
            await this.publish('client-offer', message);
        },
        async handleRemoteOffer(sdpData, remoteUserId) {
            await this.createPc(this.localStream, remoteUserId);
            await this.pc[remoteUserId].setRemoteDescription(sdpData);
            await this.createAnswerAndSendMessage(remoteUserId);
        },
        async createAnswerAndSendMessage(remoteUserId) {
            const desc = await this.pc[remoteUserId].createAnswer();
            await this.pc[remoteUserId].setLocalDescription(desc);
            const message = {
                sdpData: this.pc[remoteUserId].localDescription,
                userId: this.localUserId,
                targetUserId: remoteUserId,
            };
            await this.publish('client-answer', message);
        },
        handleRemoteAnswer(sdpData, remoteUserId) {
            this.pc[remoteUserId].setRemoteDescription(sdpData);
        },
        handleRemoteCandidate(candidate, remoteUserId) {
            this.pc[remoteUserId].addIceCandidate(
                new RTCIceCandidate(candidate)
            );
        },
        closePc() {
            Object.keys(this.pc).forEach(async (key) => {
                await this.dc[key].send(
                    JSON.stringify({ message: 'close', data: this.localUserId })
                );
                this.pc[key].close();
                this.pc[key] = null;
                delete this.pc[key];
                document.getElementById(key).remove();
            });
        },

        consolePcInfo() {
            // console.log(this.pc, "this.pc");
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
            // console.log(this.tempSignVideo, this.tempSignAudio);
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
        // 发送websocket消息
        publish(event, data) {
            let jsonstr = JSON.stringify({
                cmd: 'publish',
                subject: this.subject,
                event: event,
                data: data,
            });
            this.ws.send(jsonstr);
        },
    },
};
</script>

<style scoped lang="less">
.container {
    width: 100vw;
    height: 100vh;
    background-color: #282c34;
    @media (min-width: 576px) {
        .handlebar {
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            vertical-align: bottom;
            background: rgba(0, 0, 0, 0.5);
            text-align: left;
            padding: 15px 100px;
            box-sizing: border-box;
            display: flex;
            .handleItem {
                position: relative;
                cursor: pointer;
                color: white;
                margin: 0 30px;
                height: 40px;
                text-align: center;
                transition: all 0.5s;
                &:hover {
                    color: #409eff;
                }
                p {
                    margin: 0;
                    padding: 0;
                }
                i {
                    display: inline-block;
                    font-size: 20px;
                    line-height: 20px;
                }
            }
            .handle-menu {
                display: none;
            }
            .disenabledBt {
                color: rgb(163, 162, 162);
            }
            .disenabledBt::after {
                position: absolute;
                left: 40px;
                top: 0px;
                content: '/';
                color: #f56c6c;
                margin: 0 auto;
                font-size: 30px;
                font-weight: bold;
                display: block;
                line-height: 30px;
                height: 30px;
            }
            .closeBt {
                display: flex;
                justify-content: center;
                align-items: center;
                width: 100px;
                border-radius: 30px;
                background: #fff;
                position: absolute;
                right: 100px;
                color: #f56c6c;
                &:hover {
                    background-color: #f56c6c;
                    color: #fff;
                }
            }
        }
        //el-drawer自定义样式
        /deep/ .el-drawer__wrapper {
            z-index: unset !important;
            height: calc(100vh - 70px);
            button {
                outline: none;
            }
        }
        /deep/ .el-drawer,
        .rtl {
            outline: none;
            background: transparent;
            bottom: unset !important;
            height: 100%;
            overflow-y: auto;
            .el-drawer__header {
                background-color: #606266;
                padding: 0;
                margin: 0;
                position: sticky;
                left: 0;
                top: 0;
                z-index: 10000;
                .el-drawer__close-btn {
                    color: #f56c6c;
                }
            }
        }
        .sidebar {
            width: 375px;
            background: rgba(0, 0, 0, 1);
            display: flex;
            flex-direction: column;
            video {
                width: 375px;
                height: 250px;
            }
        }
    }
    @media (max-width: 575.98px) {
        .handlebar {
            position: fixed;
            bottom: 20px;
            left: 20px;
            color: #409eff;
            .handleItem {
                display: none;
                justify-content: flex-start;
                align-items: center;
                p {
                    margin-left: 8px;
                    color: #fff;
                }
            }
            .handle-menu {
                display: flex;
            }
            .disenabledBt {
            }
            .disenabledBt::after {
            }
            .closeBt {
                &:hover {
                }
            }
        }
        /deep/ .el-drawer__wrapper {
            z-index: unset !important;
            height: 250px;
        }
        /deep/ .el-drawer,
        .rtl {
            width: 100%;
            background-color: #000;
            .el-drawer__header {
                display: none;
            }
        }
        .sidebar {
            background: rgba(0, 0, 0, 1);
            display: flex;
            position: relative;
            width: 100%;
            overflow-x: scroll;
            video {
                width: 375px;
                height: 250px;
            }
        }
    }
}
</style>
