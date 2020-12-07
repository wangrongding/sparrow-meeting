<template>
    <div class="room">
        <div
            class="video-box"
            ref="video-box"
        >
            <video
                class="video-mine"
                muted="true"
                autoplay
                controls
                ref="video-mine"
            ></video>
        </div>
    </div>
</template>

<script>
import socket from '../../utils/socket';
export default {
    name: 'home',
    data() {
        return {
            roomid: '',
            peer: null,
            peerList: {},
            candidate: null,
            localStream: null,
            subject: null,
            joinForm: {
                roomId: '123',
            },
            iceServer: {
                iceServers: [
                    {
                        urls: ['turn:122.112.210.91:3478?transport=udp'],
                        username: 'lvlei',
                        credential: 'lvlei',
                    },
                ],
            },
        };
    },
    watch: {
        userList: {
            handler() {},
            deep: true,
        },
    },
    beforeDestroy() {
        for (let k in this.peerList) {
            this.peerList[k].close();
            this.peerList[k] = null;
        }
    },
    methods: {
        getUserMedia() {
            //兼容浏览器的getUserMedia写法
            let myVideo = this.$refs['video-mine'];
            let getUserMedia =
                navigator.getUserMedia ||
                navigator.webkitGetUserMedia ||
                navigator.mozGetUserMedia ||
                navigator.msGetUserMedia;
            //获取本地的媒体流，并绑定到一个video标签上输出，并且发送这个媒体流给其他客户端
            return new Promise((resolve, reject) => {
                getUserMedia.call(
                    navigator,
                    {
                        audio: true,
                        video: false,
                        // "video": true
                    },
                    (stream) => {
                        //绑定本地媒体流到video标签用于输出
                        myVideo.srcObject = stream;
                        this.localStream = stream;
                        resolve();
                    },
                    function (error) {
                        reject(error);
                        // console.log(error);
                        //处理媒体流创建失败错误
                    }
                );
            });
        },

        getPeerConnection(v) {
            let videoBox = this.$refs['video-box'];
            //兼容浏览器的PeerConnection写法
            let PeerConnection =
                window.RTCPeerConnection ||
                window.webkitRTCPeerConnection ||
                window.mozRTCPeerConnection;
            // 创建
            let peer = new PeerConnection(this.iceServer);
            //向PeerConnection中加入需要发送的流
            peer.addStream(this.localStream);

            //如果检测到媒体流连接到本地，将其绑定到一个video标签上输出
            peer.onaddstream = function (event) {
                // console.log('event-stream', event);
                let videos = document.querySelector('#' + v.account);
                if (videos) {
                    videos.srcObject = event.stream;
                } else {
                    let video = document.createElement('video');
                    video.controls = true;
                    video.autoplay = 'autoplay';
                    video.srcObject = event.stream;
                    video.id = v.account;
                    videoBox.append(video);
                }
            };
            //发送ICE候选到其他客户端
            peer.onicecandidate = (event) => {
                if (event.candidate) {
                    socket.emit('client-candidate', {
                        candidate: event.candidate,
                        roomid: this.joinForm.roomid,
                        account: v.account,
                    });
                }
            };
            // console.log('v.account', v.account);
            this.peerList[v.account] = peer;
        },

        createOffer(account, peer) {
            //发送offer，发送本地session描述
            peer.createOffer({
                offerToReceiveAudio: 1,
                offerToReceiveVideo: 1,
            }).then((desc) => {
                // console.log('send-offer', desc);
                peer.setLocalDescription(desc, () => {
                    socket.emit('client-offer', {
                        sdp: peer.localDescription,
                        roomid: this.joinForm.roomid,
                        account: account,
                    });
                });
            });
        },
        socketInit() {
            this.localUserId = Math.random().toString(36).substr(2);
            this.subject = 'private-video-room-' + this.joinForm.roomId;

            socket.on('joined', (data, account) => {
                console.log('joined', data);
                if (data.length > 1) {
                    data.forEach((v) => {
                        let obj = {};
                        let arr = [v.account, this.localUserId];
                        obj.account = arr.sort().join('-');
                        if (
                            !this.peerList[obj.account] &&
                            v.account !== this.localUserId
                        ) {
                            // console.log('obj', obj);
                            this.getPeerConnection(obj);
                        }
                    });
                    if (account === this.localUserId) {
                        // console.log('account', account);
                        for (let k in this.peerList) {
                            this.createOffer(k, this.peerList[k]);
                        }
                    }
                }
            });

            socket.on('client-offer', (v) => {
                // console.log('take_offer', this.peerList[v.account]);
                this.peerList[v.account] &&
                    this.peerList[v.account].setRemoteDescription(
                        v.sdp,
                        () => {
                            this.peerList[v.account]
                                .createAnswer()
                                .then((desc) => {
                                    // console.log('send-answer', desc);
                                    this.peerList[
                                        v.account
                                    ].setLocalDescription(desc, () => {
                                        socket.emit('client-answer', {
                                            sdp: this.peerList[v.account]
                                                .localDescription,
                                            roomid: this.joinForm.roomid,
                                            account: v.account,
                                        });
                                    });
                                });
                        },
                        () => {
                            // console.log(err)
                        }
                    );
            });

            socket.on('client-answer', (v) => {
                console.log('take_answer', v.sdp);
                this.peerList[v.account] &&
                    this.peerList[v.account].setRemoteDescription(
                        v.sdp,
                        function () {},
                        () => {
                            // console.log(err)
                        }
                    );
            });

            socket.on('client-candidate', (v) => {
                // console.log('take_candidate', v.candidate);
                //如果是一个ICE的候选，则将其加入到PeerConnection中
                if (v.candidate) {
                    this.peerList[v.account] &&
                        this.peerList[v.account]
                            .addIceCandidate(v.candidate)
                            .catch(
                                () => {} // console.log('err', e)
                            );
                }
            });

            socket.on('disconnected', (id) => {
                // console.log('disconnected', id);
                let dom = document.querySelector('#' + id);
                if (dom) {
                    dom.remove();
                }
            });
        },
    },
    mounted() {
        this.$nextTick(() => {
            this.getUserMedia().then(() => {
                socket.emit('client-call', {
                    roomid: this.joinForm.roomid,
                    account: this.localUserId,
                });
            });
            this.socketInit();
        });
    },
};
</script>

<style lang="scss">
.room {
    padding: 30px;
}
.video-box {
    display: flex;
    justify-content: flex-start;
    flex-wrap: wrap;
    video {
        width: 400px;
        height: 300px;
        margin-right: 10px;
    }
}
</style>
