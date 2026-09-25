// ========== Improved WebRTC Calling ==========
async function startCall(type) {
    if (!activeChatReceiverId) return alert("আগে চ্যাট খুলুন");
    
    currentCallType = type;
    activeCallPartnerId = activeChatReceiverId;
    const callRoomId = getChatRoomId(auth.currentUser.uid, activeCallPartnerId);

    // আগের পুরনো কল ডাটা মুছে ফেলা
    await set(ref(db, `calls/${callRoomId}`), null);

    document.getElementById("callModal").style.display = "flex";
    document.getElementById("callPartnerName").innerText = document.getElementById("chatReceiverName")?.innerText || "User";
    document.getElementById("callTimer").innerText = "00:00";
    playRingtone();

    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: type === 'video' ? { facingMode: currentFacingMode } : false
        });

        const localVideo = document.getElementById("localVideo");
        if (localVideo) {
            localVideo.srcObject = localStream;
            localVideo.style.display = type === 'video' ? 'block' : 'none';
        }
        document.getElementById("switchCameraBtn").style.display = type === 'video' ? 'flex' : 'none';

        peerConnection = new RTCPeerConnection(rtcConfig);

        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        peerConnection.ontrack = (e) => {
            const remoteVideo = document.getElementById("remoteVideo");
            if (remoteVideo) remoteVideo.srcObject = e.streams[0];
        };

        peerConnection.onicecandidate = (e) => {
            if (e.candidate) {
                push(ref(db, `calls/${callRoomId}/senderCandidates`), e.candidate.toJSON());
            }
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // কল ডাটা পাঠানো
        await set(ref(db, `calls/${callRoomId}`), {
            type: type,
            caller: auth.currentUser.uid,
            callerName: cachedUserName,
            receiver: activeCallPartnerId,
            offer: {
                type: offer.type,
                sdp: offer.sdp
            },
            status: "ringing",
            timestamp: Date.now()
        });

        // Answer এর জন্য লিসেন
        onValue(ref(db, `calls/${callRoomId}/answer`), async (snapshot) => {
            const answer = snapshot.val();
            if (answer && peerConnection && !peerConnection.currentRemoteDescription) {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                stopRingtone();
                startCallTimer();
            }
        });

        // Receiver ICE candidates
        onValue(ref(db, `calls/${callRoomId}/receiverCandidates`), (snapshot) => {
            if (snapshot.exists() && peerConnection) {
                Object.values(snapshot.val()).forEach(cand => {
                    peerConnection.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
                });
            }
        });

        // Status লিসেন
        onValue(ref(db, `calls/${callRoomId}/status`), (snapshot) => {
            const status = snapshot.val();
            if (status === "ended" || status === "rejected") {
                stopRingtone();
                endCallUI();
            }
        });

    } catch (err) {
        console.error(err);
        alert("মাইক্রোফোন/ক্যামেরা চালু করা যায়নি!");
        endCall();
    }
}

function listenToIncomingCalls(myUid) {
    // পুরো calls নোড লিসেন না করে শুধু নতুন কল ধরার চেষ্টা
    onValue(ref(db, 'calls'), (snapshot) => {
        if (!snapshot.exists()) return;

        const calls = snapshot.val();
        Object.keys(calls).forEach(roomId => {
            const call = calls[roomId];

            // শুধু আমার কাছে আসা এবং ringing স্ট্যাটাসের কল
            if (call && call.receiver === myUid && call.status === "ringing") {
                
                // যদি ইতিমধ্যে incoming modal খোলা থাকে তাহলে আবার না খোলা
                const modal = document.getElementById("incomingCallModal");
                if (modal && modal.style.display === "flex") return;

                incomingCallerId = call.caller;
                activeCallPartnerId = call.caller;
                currentCallType = call.type || "audio";

                document.getElementById("incomingCallerName").innerText = call.callerName || "Someone";
                document.getElementById("incomingCallType").innerText = 
                    call.type === "video" ? "ভিডিও কল আসছে..." : "অডিও কল আসছে...";
                
                modal.style.display = "flex";
                playRingtone();
            }
        });
    });
}

async function acceptIncomingCall() {
    stopRingtone();
    document.getElementById("incomingCallModal").style.display = "none";
    document.getElementById("callModal").style.display = "flex";

    const callRoomId = getChatRoomId(auth.currentUser.uid, incomingCallerId);
    document.getElementById("callPartnerName").innerText = 
        document.getElementById("incomingCallerName")?.innerText || "User";

    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: currentCallType === "video" ? { facingMode: currentFacingMode } : false
        });

        const localVideo = document.getElementById("localVideo");
        if (localVideo) {
            localVideo.srcObject = localStream;
            localVideo.style.display = currentCallType === "video" ? "block" : "none";
        }
        document.getElementById("switchCameraBtn").style.display = currentCallType === "video" ? "flex" : "none";

        peerConnection = new RTCPeerConnection(rtcConfig);

        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        peerConnection.ontrack = (e) => {
            const remoteVideo = document.getElementById("remoteVideo");
            if (remoteVideo) remoteVideo.srcObject = e.streams[0];
        };

        peerConnection.onicecandidate = (e) => {
            if (e.candidate) {
                push(ref(db, `calls/${callRoomId}/receiverCandidates`), e.candidate.toJSON());
            }
        };

        // Offer নেওয়া
        const callSnap = await get(ref(db, `calls/${callRoomId}`));
        const callData = callSnap.val();

        if (callData && callData.offer) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(callData.offer));
            
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            await update(ref(db, `calls/${callRoomId}`), {
                answer: {
                    type: answer.type,
                    sdp: answer.sdp
                },
                status: "connected"
            });

            startCallTimer();
        }

        // Sender ICE candidates
        onValue(ref(db, `calls/${callRoomId}/senderCandidates`), (snapshot) => {
            if (snapshot.exists() && peerConnection) {
                Object.values(snapshot.val()).forEach(cand => {
                    peerConnection.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
                });
            }
        });

        // Status
        onValue(ref(db, `calls/${callRoomId}/status`), (snapshot) => {
            if (snapshot.val() === "ended") {
                stopRingtone();
                endCallUI();
            }
        });

    } catch (err) {
        console.error(err);
        alert("কল রিসিভ করতে সমস্যা হয়েছে!");
        rejectIncomingCall();
    }
}

function rejectIncomingCall() {
    stopRingtone();
    document.getElementById("incomingCallModal").style.display = "none";
    
    if (incomingCallerId && auth.currentUser) {
        const callRoomId = getChatRoomId(auth.currentUser.uid, incomingCallerId);
        update(ref(db, `calls/${callRoomId}`), { status: "rejected" });
    }
    incomingCallerId = null;
}

function endCall() {
    stopRingtone();
    
    if (activeCallPartnerId && auth.currentUser) {
        const callRoomId = getChatRoomId(auth.currentUser.uid, activeCallPartnerId);
        update(ref(db, `calls/${callRoomId}`), { status: "ended" });
    }
    endCallUI();
}

function endCallUI() {
    stopRingtone();
    stopCallTimer();
    
    isMicMuted = false;
    isSpeakerOn = true;
    currentFacingMode = "user";
    incomingCallerId = null;
    activeCallPartnerId = null;

    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    document.getElementById("callModal").style.display = "none";
    document.getElementById("incomingCallModal").style.display = "none";
    document.getElementById("callTimer").innerText = "00:00";
    document.getElementById("muteMicBtn")?.classList.remove("muted");
}
