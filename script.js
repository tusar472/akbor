import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update, set, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyDub8zDIVWzhHFN7qx4nuYdwCb1a0s3mR0",
    authDomain: "mini-f7bac.firebaseapp.com",
    databaseURL: "https://mini-f7bac-default-rtdb.firebaseio.com",
    projectId: "mini-f7bac",
    storageBucket: "mini-f7bac.firebasestorage.app",
    messagingSenderId: "547201758346",
    appId: "1:547201758346:web:18ea0bbc8921b0d1b2e973",
    measurementId: "G-9KYTTRT5GZ"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);
const storage = getStorage(app);

let selectedImageData = null;
let profilePicData = null;
let cachedUserName = "User";
let viewingUserId = null;
let activeTab = 'homeTab';
let activeChatReceiverId = null;

// WebRTC
let localStream = null;
let peerConnection = null;
let currentCallType = null;
let activeCallPartnerId = null;
let incomingCallerId = null;
let isMicMuted = false;
let isSpeakerOn = true;
let callStartTime = null;
let callTimerInterval = null;
let currentFacingMode = 'user';

// Audio recording
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingStartTime = null;
let recordingTimerInterval = null;

// ========== রিংটন সিস্টেম (নরম সাউন্ড) ==========
let ringtoneCtx = null;
let ringtoneOsc = null;
let ringtoneGain = null;
let ringtoneInterval = null;
let isRingtonePlaying = false;

function playRingtone() {
    stopRingtone();

    try {
        ringtoneCtx = new (window.AudioContext || window.webkitAudioContext)();
        ringtoneOsc = ringtoneCtx.createOscillator();
        ringtoneGain = ringtoneCtx.createGain();

        ringtoneOsc.connect(ringtoneGain);
        ringtoneGain.connect(ringtoneCtx.destination);

        ringtoneOsc.type = 'sine';
        ringtoneOsc.frequency.value = 520;
        ringtoneGain.gain.value = 0;

        ringtoneOsc.start();
        isRingtonePlaying = true;

        let step = 0;
        ringtoneInterval = setInterval(() => {
            if (!isRingtonePlaying) return;

            step++;
            if (step % 2 === 1) {
                ringtoneOsc.frequency.value = 520;
                ringtoneGain.gain.setValueAtTime(0.12, ringtoneCtx.currentTime);
                ringtoneGain.gain.exponentialRampToValueAtTime(0.01, ringtoneCtx.currentTime + 0.35);
            } else {
                ringtoneGain.gain.setValueAtTime(0.001, ringtoneCtx.currentTime);
            }
        }, 600);

    } catch (e) {
        console.log("Ringtone error:", e);
    }
}

function stopRingtone() {
    isRingtonePlaying = false;

    if (ringtoneInterval) {
        clearInterval(ringtoneInterval);
        ringtoneInterval = null;
    }

    try {
        if (ringtoneOsc) {
            ringtoneOsc.stop();
            ringtoneOsc.disconnect();
            ringtoneOsc = null;
        }
        if (ringtoneGain) {
            ringtoneGain.disconnect();
            ringtoneGain = null;
        }
        if (ringtoneCtx && ringtoneCtx.state !== 'closed') {
            ringtoneCtx.close();
            ringtoneCtx = null;
        }
    } catch (e) {}
}

function playNotifSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 800;
        gain.gain.value = 0.1;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.stop(ctx.currentTime + 0.3);
    } catch (e) {}
}

// ICE Servers
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        }
    ]
};

// ========== ইউটিলিটি ==========
async function uploadToStorage(file, path) {
    try {
        console.log("Uploading:", path);
        const fileRef = storageRef(storage, path);
        const snapshot = await uploadBytes(fileRef, file);
        const url = await getDownloadURL(snapshot.ref);
        console.log("Upload success");
        return url;
    } catch (error) {
        console.error("Upload failed:", error);
        throw new Error("আপলোড ব্যর্থ: " + error.message);
    }
}

function compressImage(file, maxWidth = 800) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name, { type: 'image/jpeg' }));
                }, 'image/jpeg', 0.7);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// ========== Event Listeners ==========
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("loginBtn")?.addEventListener("click", handleLogin);
    document.getElementById("signupBtn")?.addEventListener("click", handleSignup);
    document.getElementById("toSignupLink")?.addEventListener("click", (e) => {
        e.preventDefault();
        toggleAuth('signup');
    });
    document.getElementById("toLoginLink")?.addEventListener("click", (e) => {
        e.preventDefault();
        toggleAuth('login');
    });

    document.getElementById("btnHomeTab")?.addEventListener("click", function () { switchTab('homeTab', this); });
    document.getElementById("btnProfileTab")?.addEventListener("click", function () { switchTab('profileTab', this); });
    document.getElementById("btnNotifTab")?.addEventListener("click", function () { switchTab('notifTab', this); });
    document.getElementById("btnMsgTab")?.addEventListener("click", function () { switchTab('msgTab', this); });

    document.getElementById("addPostBtn")?.addEventListener("click", addPost);
    document.getElementById("postImageInput")?.addEventListener("change", showPreview);
    document.getElementById("coverPicInput")?.addEventListener("change", uploadCoverPic);
    document.getElementById("profilePicInput")?.addEventListener("change", uploadProfilePic);

    document.getElementById("settingsBtn")?.addEventListener("click", toggleSettingsModal);
    document.getElementById("saveProfileBtn")?.addEventListener("click", saveProfileDetails);
    document.getElementById("closeModalBtn")?.addEventListener("click", toggleSettingsModal);
    document.getElementById("logoutBtn")?.addEventListener("click", handleLogout);

    document.getElementById("userSearchInput")?.addEventListener("input", handleUserSearch);
    document.getElementById("followBtn")?.addEventListener("click", toggleFollow);

    document.getElementById("sendChatMsgBtn")?.addEventListener("click", sendDirectMessage);
    document.getElementById("chatImageInput")?.addEventListener("change", handleChatAttach);
    document.getElementById("chatCameraInput")?.addEventListener("change", sendChatImage);
    document.getElementById("recordAudioBtn")?.addEventListener("click", toggleAudioRecording);
    document.getElementById("stopRecordBtn")?.addEventListener("click", stopAudioRecording);

    document.getElementById("audioCallBtn")?.addEventListener("click", () => startCall('audio'));
    document.getElementById("videoCallBtn")?.addEventListener("click", () => startCall('video'));
    document.getElementById("endCallBtn")?.addEventListener("click", endCall);
    document.getElementById("acceptCallBtn")?.addEventListener("click", acceptIncomingCall);
    document.getElementById("rejectCallBtn")?.addEventListener("click", rejectIncomingCall);
    document.getElementById("muteMicBtn")?.addEventListener("click", toggleMuteMic);
    document.getElementById("speakerBtn")?.addEventListener("click", toggleSpeaker);
    document.getElementById("switchCameraBtn")?.addEventListener("click", switchCamera);
    document.getElementById("closeImagePreview")?.addEventListener("click", () => {
        document.getElementById("imagePreviewModal").style.display = "none";
    });

    document.getElementById("closeChatBtn")?.addEventListener("click", () => {
        document.getElementById("chatRoomBox").style.display = "none";
        document.getElementById("chatUserList").style.display = "block";
        if (isRecording) stopAudioRecording(true);
    });

    document.getElementById("closeListModalBtn")?.addEventListener("click", () => {
        document.getElementById("listModal").style.display = "none";
    });

    document.getElementById("followersBtnBox")?.addEventListener("click", () => {
        if (viewingUserId) showUserList(viewingUserId, 'followers');
    });
    document.getElementById("followingBtnBox")?.addEventListener("click", () => {
        if (viewingUserId) showUserList(viewingUserId, 'following');
    });

    const chatInputText = document.getElementById('chatInputText');
    if (chatInputText) {
        chatInputText.addEventListener('focus', () => {
            setTimeout(() => {
                const messageDisplayArea = document.getElementById('messageDisplayArea');
                if (messageDisplayArea) messageDisplayArea.scrollTop = messageDisplayArea.scrollHeight;
            }, 300);
        });
        chatInputText.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendDirectMessage();
        });
        chatInputText.addEventListener('input', toggleMicSendButton);
    }

    document.getElementById("locationCheckBtn")?.addEventListener("click", openTerminal);
    document.getElementById("closeTerminalBtn")?.addEventListener("click", closeTerminal);
    document.getElementById("closeMapBtn")?.addEventListener("click", () => {
        document.getElementById("mapModal").style.display = "none";
    });

    const termInput = document.getElementById("terminalInput");
    if (termInput) {
        termInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                handleTerminalCommand(termInput.value.trim());
                termInput.value = "";
            }
        });
    }
});

function toggleMicSendButton() {
    const input = document.getElementById('chatInputText');
    const micBtn = document.getElementById('recordAudioBtn');
    const sendBtn = document.getElementById('sendChatMsgBtn');
    if (!input || !micBtn || !sendBtn) return;

    if (input.value.trim().length > 0) {
        micBtn.style.display = 'none';
        sendBtn.style.display = 'flex';
    } else {
        micBtn.style.display = 'flex';
        sendBtn.style.display = 'none';
    }
}

function handleChatAttach(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type.startsWith('video/')) {
        sendChatVideo(e);
    } else {
        sendChatImage(e);
    }
}

document.addEventListener("click", function (e) {
    if (!e.target.classList.contains("more-btn")) {
        document.querySelectorAll(".menu-popup").forEach(menu => menu.style.display = "none");
    }
    const searchInput = document.getElementById("userSearchInput");
    const resultsContainer = document.getElementById("searchResults");
    if (resultsContainer && searchInput && !searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
        resultsContainer.style.display = "none";
    }
});

// ========== Auth ==========
function toggleAuth(type) {
    if (type === 'signup') {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('signupForm').style.display = 'block';
    } else {
        document.getElementById('signupForm').style.display = 'none';
        document.getElementById('loginForm').style.display = 'block';
    }
}

function handleSignup() {
    const name = document.getElementById('signupName')?.value.trim() || "";
    const email = document.getElementById('signupEmail')?.value.trim() || "";
    const password = document.getElementById('signupPassword')?.value || "";

    if (!name || !email || !password) return alert("দয়া করে সব ঘর পূরণ করুন!");
    if (password.length < 6) return alert("পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে!");

    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            cachedUserName = name;
            set(ref(db, 'userProfile/' + user.uid), { name, email }).then(() => {
                alert("একাউন্ট তৈরি সফল হয়েছে!");
                document.getElementById('signupName').value = '';
                document.getElementById('signupEmail').value = '';
                document.getElementById('signupPassword').value = '';
            });
        })
        .catch((error) => alert("সাইনআপ সমস্যা: " + error.message));
}

function handleLogin() {
    const email = document.getElementById('loginEmail')?.value.trim() || "";
    const password = document.getElementById('loginPassword')?.value || "";
    if (!email || !password) return alert("ইমেইল এবং পাসওয়ার্ড দিন!");

    signInWithEmailAndPassword(auth, email, password)
        .then(() => {
            document.getElementById('loginEmail').value = '';
            document.getElementById('loginPassword').value = '';
        })
        .catch((error) => alert("লগইন ভুল হয়েছে: " + error.message));
}

function handleLogout() {
    stopRingtone();
    endCallUI();
    signOut(auth);
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('authContainer').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        viewingUserId = user.uid;
        loadMyHeaderInfo(user.uid);
        loadUserData(user.uid);
        listenToNotifications();
        listenToIncomingCalls(user.uid);
        loadPosts();
    } else {
        document.getElementById('authContainer').style.display = 'block';
        document.getElementById('mainApp').style.display = 'none';
    }
});

// ========== Profile ==========
function loadMyHeaderInfo(uid) {
    onValue(ref(db, 'userProfile/' + uid), (snapshot) => {
        const data = snapshot.val();
        if (data) {
            cachedUserName = data.name || "User";
            if (data.photo) {
                profilePicData = data.photo;
                const imgHTML = `<img src="${data.photo}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                document.getElementById("headerPicContainer").innerHTML = imgHTML;
                document.getElementById("feedPicContainer").innerHTML = imgHTML;
            }
        }
    });
}

function loadUserData(uid) {
    if (!uid) return;
    viewingUserId = uid;
    const currentUser = auth.currentUser;
    const isMyProfile = currentUser && (currentUser.uid === uid);

    document.getElementById('settingsBtn').style.display = isMyProfile ? 'inline-block' : 'none';
    document.getElementById('coverBtnLabel').style.display = isMyProfile ? 'inline-block' : 'none';
    document.getElementById('avatarBtnLabel').style.display = isMyProfile ? 'inline-block' : 'none';

    onValue(ref(db, 'userProfile/' + uid), (snapshot) => {
        const data = snapshot.val() || {};
        const name = data.name || "User";

        document.getElementById('displayProfileName').innerText = name;
        document.getElementById('profName').value = name;
        document.getElementById('profLocation').value = data.location || "";
        document.getElementById('viewLocation').innerText = data.location || "দেওয়া নেই";
        document.getElementById('profHometown').value = data.hometown || "";
        document.getElementById('viewHometown').innerText = data.hometown || "দেওয়া নেই";
        document.getElementById('profCollege').value = data.college || "";
        document.getElementById('viewCollege').innerText = data.college || "দেওয়া নেই";
        document.getElementById('profMusic').value = data.music || "";
        document.getElementById('viewMusic').innerText = data.music || "দেওয়া নেই";
        document.getElementById('profHobbies').value = data.hobbies || "";
        document.getElementById('viewHobbies').innerText = data.hobbies || "দেওয়া নেই";

        const avatarDisplay = document.getElementById("profileAvatarDisplay");
        avatarDisplay.innerHTML = data.photo
            ? `<img src="${data.photo}" style="width:100%; height:100%; object-fit:cover;">`
            : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:28px; background:#ccc; color:#555;">${(name[0] || 'U').toUpperCase()}</div>`;

        document.getElementById("coverImageDisplay").src = data.coverPhoto || "";
    });

    loadUserPhotosGallery(uid);
    loadProfileStats(uid);
    loadFollowStats(uid);
}

async function uploadProfilePic(event) {
    const user = auth.currentUser;
    const file = event.target.files[0];
    if (!file || !user) return;

    try {
        const compressed = await compressImage(file, 400);
        const url = await uploadToStorage(compressed, `profilePics/${user.uid}_${Date.now()}.jpg`);
        profilePicData = url;
        await update(ref(db, 'userProfile/' + user.uid), { photo: url });
    } catch (err) {
        alert("প্রোফাইল ছবি আপলোড ব্যর্থ: " + err.message);
    }
}

async function uploadCoverPic(event) {
    const user = auth.currentUser;
    const file = event.target.files[0];
    if (!file || !user) return;

    try {
        const compressed = await compressImage(file, 900);
        const url = await uploadToStorage(compressed, `coverPhotos/${user.uid}_${Date.now()}.jpg`);
        await update(ref(db, 'userProfile/' + user.uid), { coverPhoto: url });
    } catch (err) {
        alert("কভার ছবি আপলোড ব্যর্থ: " + err.message);
    }
}

function saveProfileDetails() {
    const user = auth.currentUser;
    if (!user) return;
    const newName = document.getElementById('profName')?.value.trim() || cachedUserName;

    update(ref(db, 'userProfile/' + user.uid), {
        name: newName,
        location: document.getElementById('profLocation')?.value.trim() || "",
        hometown: document.getElementById('profHometown')?.value.trim() || "",
        college: document.getElementById('profCollege')?.value.trim() || "",
        music: document.getElementById('profMusic')?.value.trim() || "",
        hobbies: document.getElementById('profHobbies')?.value.trim() || ""
    }).then(() => {
        alert("প্রোফাইল সেভ হয়েছে!");
        toggleSettingsModal();
    });
}

function showPreview(event) {
    const file = event.target.files[0];
    if (!file) return;
    selectedImageData = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById("imagePreview").src = e.target.result;
        document.getElementById("previewArea").style.display = "block";
    };
    reader.readAsDataURL(file);
}

async function addPost() {
    const user = auth.currentUser;
    if (!user) return;
    const text = document.getElementById("postInput")?.value.trim() || "";
    if (text === "" && !selectedImageData) return;

    const btn = document.getElementById("addPostBtn");
    btn.disabled = true;
    btn.innerText = "পোস্ট হচ্ছে...";

    try {
        let imageUrl = "";
        if (selectedImageData) {
            const compressed = await compressImage(selectedImageData, 900);
            imageUrl = await uploadToStorage(compressed, `posts/${user.uid}_${Date.now()}.jpg`);
        }

        const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const userSnap = await get(ref(db, 'userProfile/' + user.uid));
        const userData = userSnap.val() || {};

        await push(ref(db, 'posts'), {
            userId: user.uid,
            userName: userData.name || cachedUserName,
            userPic: userData.photo || "",
            content: text,
            image: imageUrl,
            time: timeNow,
            timestamp: Date.now()
        });

        document.getElementById("postInput").value = "";
        selectedImageData = null;
        document.getElementById("previewArea").style.display = "none";
        document.getElementById("postImageInput").value = "";
    } catch (err) {
        alert("পোস্ট করতে সমস্যা: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerText = "পোস্ট";
    }
}

function toggleSettingsModal() {
    const modal = document.getElementById('settingsModal');
    modal.style.display = (modal.style.display === 'flex') ? 'none' : 'flex';
}

// ========== Notifications ==========
function sendNotification(targetUserId, text, imageUrl = null) {
    const currentUser = auth.currentUser;
    if (!targetUserId || !currentUser || currentUser.uid === targetUserId) return;

    const notifData = {
        text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(),
        read: false
    };
    if (imageUrl) notifData.image = imageUrl;
    push(ref(db, 'notifications/' + targetUserId), notifData);
    playNotifSound();
}

function listenToNotifications() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    onValue(ref(db, 'notifications/' + currentUser.uid), (snapshot) => {
        const notifContainer = document.getElementById("notifContainer");
        const badge = document.getElementById("notifBadge");
        if (!notifContainer) return;

        notifContainer.innerHTML = "";
        const data = snapshot.val();
        if (!data) {
            if (badge) badge.style.display = "none";
            notifContainer.innerHTML = "<div style='padding:15px; text-align:center; color:gray;'>কোনো নোটিফিকেশন নেই</div>";
            return;
        }

        const notifArray = Object.values(data);
        const unreadCount = notifArray.filter(n => n.read === false).length;

        if (badge && activeTab !== 'notifTab') {
            badge.innerText = unreadCount;
            badge.style.display = unreadCount > 0 ? "inline-block" : "none";
        }

        notifArray.reverse().forEach(notif => {
            const div = document.createElement("div");
            div.style.cssText = `padding:10px; border-bottom:1px solid #eee; font-size:13px; background:${notif.read ? '#fff' : '#e7f3ff'};`;

            if (notif.image) {
                div.className = "notif-with-img";
                div.innerHTML = `
                    <img class="notif-thumb" src="${notif.image}" alt="">
                    <div style="flex:1;">
                        ${notif.text}<br>
                        <span style="color:gray; font-size:11px;">${notif.time || ''}</span>
                    </div>`;
                div.querySelector('.notif-thumb')?.addEventListener('click', () => {
                    document.getElementById("previewImageLarge").src = notif.image;
                    document.getElementById("imagePreviewModal").style.display = "flex";
                });
            } else {
                div.innerHTML = `${notif.text} <span style="color:gray; font-size:11px;">${notif.time || ''}</span>`;
            }
            notifContainer.appendChild(div);
        });
    });
}

// ========== Tab ==========
function switchTab(tabId, element, pushToHistory = true) {
    if (activeTab === tabId && pushToHistory) return;
    activeTab = tabId;

    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId)?.classList.add('active');

    if (!element) {
        if (tabId === 'homeTab') element = document.getElementById('btnHomeTab');
        else if (tabId === 'profileTab') element = document.getElementById('btnProfileTab');
        else if (tabId === 'notifTab') element = document.getElementById('btnNotifTab');
        else if (tabId === 'msgTab') element = document.getElementById('btnMsgTab');
    }
    if (element) element.classList.add('active');

    if (tabId === 'notifTab') {
        const badge = document.getElementById("notifBadge");
        if (badge) {
            badge.innerText = "0";
            badge.style.display = "none";
        }
        const currentUser = auth.currentUser;
        if (currentUser) {
            get(ref(db, 'notifications/' + currentUser.uid)).then(snapshot => {
                if (snapshot.exists()) {
                    const updates = {};
                    Object.keys(snapshot.val()).forEach(key => {
                        updates[`notifications/${currentUser.uid}/${key}/read`] = true;
                    });
                    update(ref(db), updates);
                }
            });
        }
    }

    if (tabId === 'msgTab') loadChatUsersList();
    if (pushToHistory) history.pushState({ tabId }, "", "");
}

function openUserProfile(uid) {
    if (!uid) return;
    switchTab('profileTab', document.getElementById('btnProfileTab'));
    loadUserData(uid);
}

// ========== Gallery ==========
function loadUserPhotosGallery(uid) {
    const gallery = document.getElementById("userPhotosGallery");
    if (!gallery) return;

    onValue(ref(db, 'posts'), (snapshot) => {
        gallery.innerHTML = "";
        if (!snapshot.exists()) {
            gallery.innerHTML = "<p style='color:gray; font-size:12px; grid-column:span 3;'>কোনো ছবি পাওয়া যায়নি</p>";
            return;
        }
        let hasPhotos = false;
        Object.values(snapshot.val()).reverse().forEach(post => {
            if (post.userId === uid && post.image) {
                hasPhotos = true;
                const img = document.createElement("img");
                img.src = post.image;
                img.style.cssText = "width:100%; height:80px; object-fit:cover; border-radius:4px; cursor:pointer;";
                img.onclick = () => {
                    document.getElementById("previewImageLarge").src = post.image;
                    document.getElementById("imagePreviewModal").style.display = "flex";
                };
                gallery.appendChild(img);
            }
        });
        if (!hasPhotos) gallery.innerHTML = "<p style='color:gray; font-size:12px; grid-column:span 3;'>কোনো ছবি পাওয়া যায়নি</p>";
    });
}

function loadProfileStats(targetUid) {
    onValue(ref(db, 'posts'), (snapshot) => {
        let count = 0;
        if (snapshot.exists()) {
            Object.values(snapshot.val()).forEach(p => {
                if (p.userId === targetUid && p.image) count++;
            });
        }
        document.getElementById('photosCount').innerText = count;
    });
}

// ========== Chat ==========
function loadChatUsersList() {
    const listContainer = document.getElementById("usersForChatList");
    if (!listContainer) return;

    document.getElementById("chatUserList").style.display = "block";
    document.getElementById("chatRoomBox").style.display = "none";

    const currentUser = auth.currentUser;
    if (!currentUser) return;

    get(ref(db, 'userProfile')).then((snapshot) => {
        listContainer.innerHTML = "";
        if (!snapshot.exists()) {
            listContainer.innerHTML = "<div style='padding:15px; text-align:center; color:gray;'>কোনো ইউজার পাওয়া যায়নি</div>";
            return;
        }

        const users = snapshot.val();
        let found = false;

        Object.keys(users).forEach(uid => {
            if (uid === currentUser.uid) return;
            found = true;
            const u = users[uid];
            const pic = u.photo
                ? `<img src="${u.photo}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">`
                : `<div style="width:40px; height:40px; border-radius:50%; background:#ccc; display:flex; align-items:center; justify-content:center; font-weight:bold;">${(u.name || 'U')[0]}</div>`;

            const item = document.createElement("div");
            item.style.cssText = "display:flex; align-items:center; gap:10px; padding:10px; border-bottom:1px solid #eee; cursor:pointer; background:#fff;";
            item.innerHTML = `${pic} <span>${u.name || 'User'}</span>`;
            item.onclick = () => openChatRoom(uid, u.name || 'User');
            listContainer.appendChild(item);
        });

        if (!found) {
            listContainer.innerHTML = "<div style='padding:15px; text-align:center; color:gray;'>অন্য কোনো ইউজার রেজিস্টার্ড নেই</div>";
        }
    });
}

function openChatRoom(receiverUid, receiverName) {
    activeChatReceiverId = receiverUid;
    document.getElementById("chatReceiverName").innerText = receiverName;
    document.getElementById("chatUserList").style.display = "none";

    const picContainer = document.getElementById("chatReceiverPic");
    picContainer.innerHTML = "";
    get(ref(db, 'userProfile/' + receiverUid)).then(snap => {
        const data = snap.val() || {};
        if (data.photo) {
            picContainer.innerHTML = `<img src="${data.photo}" alt="">`;
        } else {
            picContainer.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#ccc;color:#555;font-weight:bold;">${(receiverName[0] || 'U').toUpperCase()}</div>`;
        }
    });

    const chatRoomBox = document.getElementById("chatRoomBox");
    chatRoomBox.style.display = "flex";
    if (window.visualViewport) {
        chatRoomBox.style.height = `${window.visualViewport.height}px`;
    }
    listenToMessages(receiverUid);
}

function getChatRoomId(uid1, uid2) {
    return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

function sendDirectMessage() {
    const currentUser = auth.currentUser;
    const input = document.getElementById("chatInputText");
    const text = input?.value.trim() || "";
    if (!currentUser || !activeChatReceiverId || !text) return;

    const roomId = getChatRoomId(currentUser.uid, activeChatReceiverId);
    push(ref(db, 'chats/' + roomId), {
        sender: currentUser.uid,
        text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }).then(() => {
        sendNotification(activeChatReceiverId, `${cachedUserName} আপনাকে একটি মেসেজ পাঠিয়েছেন।`);
        input.value = "";
        toggleMicSendButton();
    });
}

async function sendChatImage(e) {
    const file = e.target.files[0];
    const currentUser = auth.currentUser;
    if (!file || !currentUser || !activeChatReceiverId) return;

    try {
        const compressed = await compressImage(file, 800);
        const url = await uploadToStorage(compressed, `chatImages/${currentUser.uid}_${Date.now()}.jpg`);
        const roomId = getChatRoomId(currentUser.uid, activeChatReceiverId);
        await push(ref(db, 'chats/' + roomId), {
            sender: currentUser.uid,
            image: url,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        sendNotification(activeChatReceiverId, `${cachedUserName} আপনাকে একটি ছবি পাঠিয়েছেন।`);
    } catch (err) {
        alert("ছবি পাঠাতে সমস্যা: " + err.message);
    }
    e.target.value = "";
}

async function sendChatVideo(e) {
    const file = e.target.files[0];
    const currentUser = auth.currentUser;
    if (!file || !currentUser || !activeChatReceiverId) return;

    if (file.size > 25 * 1024 * 1024) {
        alert("ভিডিও খুব বড়! সর্বোচ্চ ২৫ MB পর্যন্ত।");
        e.target.value = "";
        return;
    }

    try {
        const url = await uploadToStorage(file, `chatVideos/${currentUser.uid}_${Date.now()}.mp4`);
        const roomId = getChatRoomId(currentUser.uid, activeChatReceiverId);
        await push(ref(db, 'chats/' + roomId), {
            sender: currentUser.uid,
            video: url,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        sendNotification(activeChatReceiverId, `${cachedUserName} আপনাকে একটি ভিডিও পাঠিয়েছেন।`);
    } catch (err) {
        alert("ভিডিও পাঠাতে সমস্যা: " + err.message);
    }
    e.target.value = "";
}

// Audio Recording
async function toggleAudioRecording() {
    if (isRecording) stopAudioRecording();
    else startAudioRecording();
}

async function startAudioRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        audioChunks = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.onstop = async () => {
            stream.getTracks().forEach(t => t.stop());
            if (audioChunks.length === 0) return;

            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const file = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
            await sendAudioMessage(file);
        };

        mediaRecorder.start();
        isRecording = true;
        recordingStartTime = Date.now();

        document.getElementById("recordAudioBtn")?.classList.add("recording");
        document.getElementById("recordingIndicator").style.display = "flex";
        recordingTimerInterval = setInterval(updateRecordingTimer, 200);
    } catch (err) {
        alert("মাইক্রোফোন অ্যাক্সেস পাওয়া যায়নি!");
    }
}

function stopAudioRecording(cancel = false) {
    if (!isRecording || !mediaRecorder) return;
    isRecording = false;
    clearInterval(recordingTimerInterval);

    document.getElementById("recordAudioBtn")?.classList.remove("recording");
    document.getElementById("recordingIndicator").style.display = "none";

    if (cancel) {
        mediaRecorder.ondataavailable = null;
        mediaRecorder.onstop = null;
        mediaRecorder.stream?.getTracks().forEach(t => t.stop());
        audioChunks = [];
        return;
    }
    if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
}

function updateRecordingTimer() {
    if (!recordingStartTime) return;
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const min = Math.floor(elapsed / 60);
    const sec = elapsed % 60;
    document.getElementById("recordingTimer").innerText = `${min}:${sec.toString().padStart(2, '0')}`;
    if (elapsed >= 60) stopAudioRecording();
}

async function sendAudioMessage(file) {
    const currentUser = auth.currentUser;
    if (!currentUser || !activeChatReceiverId) return;

    try {
        const url = await uploadToStorage(file, `voiceNotes/${currentUser.uid}_${Date.now()}.webm`);
        const roomId = getChatRoomId(currentUser.uid, activeChatReceiverId);
        await push(ref(db, 'chats/' + roomId), {
            sender: currentUser.uid,
            audio: url,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        sendNotification(activeChatReceiverId, `${cachedUserName} আপনাকে একটি ভয়েস নোট পাঠিয়েছেন।`);
    } catch (err) {
        alert("ভয়েস নোট পাঠাতে সমস্যা: " + err.message);
    }
}

function listenToMessages(receiverUid) {
    const currentUser = auth.currentUser;
    const displayArea = document.getElementById("messageDisplayArea");
    if (!currentUser || !displayArea) return;

    const roomId = getChatRoomId(currentUser.uid, receiverUid);

    onValue(ref(db, 'chats/' + roomId), (snapshot) => {
        displayArea.innerHTML = "";
        if (!snapshot.exists()) {
            displayArea.innerHTML = "<div style='text-align:center; color:gray; font-size:12px; margin-top:20px;'>কথা বলা শুরু করুন...</div>";
            return;
        }

        Object.values(snapshot.val()).forEach(m => {
            const isMe = m.sender === currentUser.uid;
            const isImageOnly = m.image && !m.text && !m.audio && !m.video;
            const msgDiv = document.createElement("div");
            msgDiv.className = `msg-bubble ${isMe ? 'msg-sent' : 'msg-received'}${isImageOnly ? ' msg-image-only' : ''}`;

            let contentHTML = '';
            if (m.text) contentHTML += `<div>${m.text}</div>`;
            if (m.image) contentHTML += `<img src="${m.image}" style="max-width:240px; border-radius:8px; display:block;">`;
            if (m.audio) contentHTML += `<div class="msg-audio"><audio controls src="${m.audio}" style="height:32px;"></audio></div>`;
            if (m.video) contentHTML += `<div class="msg-video"><video controls src="${m.video}" style="max-width:240px; max-height:200px; border-radius:10px;"></video></div>`;
            contentHTML += `<div class="msg-time">${m.time || ''}</div>`;

            msgDiv.innerHTML = contentHTML;
            displayArea.appendChild(msgDiv);
        });
        displayArea.scrollTop = displayArea.scrollHeight;
    });
}

// ========== WebRTC Calling ==========
async function startCall(type) {
    if (!activeChatReceiverId) return;
    currentCallType = type;
    activeCallPartnerId = activeChatReceiverId;

    document.getElementById("callModal").style.display = "flex";
    document.getElementById("callPartnerName").innerText = document.getElementById("chatReceiverName")?.innerText || "User";
    playRingtone();

    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
            video: type === 'video' ? { facingMode: currentFacingMode } : false
        });

        const localVideo = document.getElementById("localVideo");
        localVideo.srcObject = localStream;
        localVideo.style.display = type === 'video' ? 'block' : 'none';
        document.getElementById("switchCameraBtn").style.display = type === 'video' ? 'flex' : 'none';

        peerConnection = new RTCPeerConnection(rtcConfig);

        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.ontrack = (e) => {
            document.getElementById("remoteVideo").srcObject = e.streams[0];
        };

        const callRoomId = getChatRoomId(auth.currentUser.uid, activeCallPartnerId);

        peerConnection.onicecandidate = (e) => {
            if (e.candidate) {
                push(ref(db, `calls/${callRoomId}/senderCandidates`), e.candidate.toJSON());
            }
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        await set(ref(db, `calls/${callRoomId}`), {
            type,
            caller: auth.currentUser.uid,
            callerName: cachedUserName,
            receiver: activeCallPartnerId,
            offer: { type: offer.type, sdp: offer.sdp },
            status: 'ringing'
        });

        onValue(ref(db, `calls/${callRoomId}/answer`), (snapshot) => {
            const answer = snapshot.val();
            if (answer && peerConnection && !peerConnection.currentRemoteDescription) {
                peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                stopRingtone();
                startCallTimer();
            }
        });

        onValue(ref(db, `calls/${callRoomId}/receiverCandidates`), (snapshot) => {
            if (snapshot.exists() && peerConnection) {
                Object.values(snapshot.val()).forEach(cand => {
                    peerConnection.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
                });
            }
        });

        onValue(ref(db, `calls/${callRoomId}/status`), (snapshot) => {
            if (snapshot.val() === 'ended') {
                stopRingtone();
                endCallUI();
            }
        });

    } catch (err) {
        alert("মাইক্রোফোন বা ক্যামেরা অ্যাক্সেস পাওয়া যায়নি!");
        endCall();
    }
}

function listenToIncomingCalls(myUid) {
    onValue(ref(db, 'calls'), (snapshot) => {
        if (!snapshot.exists()) return;
        const calls = snapshot.val();
        Object.keys(calls).forEach(roomId => {
            const call = calls[roomId];
            if (call.receiver === myUid && call.status === 'ringing') {
                incomingCallerId = call.caller;
                activeCallPartnerId = call.caller;
                currentCallType = call.type;

                document.getElementById("incomingCallerName").innerText = call.callerName || 'Someone';
                document.getElementById("incomingCallType").innerText = call.type === 'video' ? "ভিডিও কল আসছে..." : "অডিও কল আসছে...";
                document.getElementById("incomingCallModal").style.display = "flex";
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
    document.getElementById("callPartnerName").innerText = document.getElementById("incomingCallerName")?.innerText || "User";

    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
            video: currentCallType === 'video' ? { facingMode: currentFacingMode } : false
        });

        const localVideo = document.getElementById("localVideo");
        localVideo.srcObject = localStream;
        localVideo.style.display = currentCallType === 'video' ? 'block' : 'none';
        document.getElementById("switchCameraBtn").style.display = currentCallType === 'video' ? 'flex' : 'none';

        peerConnection = new RTCPeerConnection(rtcConfig);
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.ontrack = (e) => {
            document.getElementById("remoteVideo").srcObject = e.streams[0];
        };

        peerConnection.onicecandidate = (e) => {
            if (e.candidate) {
                push(ref(db, `calls/${callRoomId}/receiverCandidates`), e.candidate.toJSON());
            }
        };

        const callSnap = await get(ref(db, `calls/${callRoomId}`));
        const callData = callSnap.val();

        if (callData?.offer) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(callData.offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            await update(ref(db, `calls/${callRoomId}`), {
                answer: { type: answer.type, sdp: answer.sdp },
                status: 'connected'
            });
            startCallTimer();
        }

        onValue(ref(db, `calls/${callRoomId}/senderCandidates`), (snapshot) => {
            if (snapshot.exists() && peerConnection) {
                Object.values(snapshot.val()).forEach(cand => {
                    peerConnection.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
                });
            }
        });

        onValue(ref(db, `calls/${callRoomId}/status`), (snapshot) => {
            if (snapshot.val() === 'ended') {
                stopRingtone();
                endCallUI();
            }
        });

    } catch (err) {
        alert("কল রিসিভ করতে সমস্যা হয়েছে!");
        rejectIncomingCall();
    }
}

function rejectIncomingCall() {
    stopRingtone();
    document.getElementById("incomingCallModal").style.display = "none";
    if (incomingCallerId) {
        const callRoomId = getChatRoomId(auth.currentUser.uid, incomingCallerId);
        update(ref(db, `calls/${callRoomId}`), { status: 'ended' });
    }
}

function endCall() {
    stopRingtone();
    if (activeCallPartnerId && auth.currentUser) {
        const callRoomId = getChatRoomId(auth.currentUser.uid, activeCallPartnerId);
        update(ref(db, `calls/${callRoomId}`), { status: 'ended' });
    }
    endCallUI();
}

function endCallUI() {
    stopRingtone();
    stopCallTimer();
    isMicMuted = false;
    isSpeakerOn = true;
    currentFacingMode = 'user';

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

// ========== Follow ==========
function toggleFollow() {
    const currentUser = auth.currentUser;
    if (!currentUser || !viewingUserId || currentUser.uid === viewingUserId) return;

    const myFollowingRef = ref(db, `following/${currentUser.uid}/${viewingUserId}`);
    const userFollowersRef = ref(db, `followers/${viewingUserId}/${currentUser.uid}`);

    get(myFollowingRef).then((snapshot) => {
        if (snapshot.exists()) {
            remove(myFollowingRef);
            remove(userFollowersRef);
            updateFollowBtn(false);
        } else {
            set(myFollowingRef, true);
            set(userFollowersRef, true);
            updateFollowBtn(true);
            sendNotification(viewingUserId, `${cachedUserName} আপনাকে ফলো করা শুরু করেছেন।`);
        }
        loadFollowStats(viewingUserId);
    });
}

function updateFollowBtn(isFollowing) {
    const followBtn = document.getElementById("followBtn");
    if (!followBtn) return;
    if (isFollowing) {
        followBtn.innerText = "Unfollow";
        followBtn.style.background = "#e4e6eb";
        followBtn.style.color = "#000";
    } else {
        followBtn.innerText = "Follow";
        followBtn.style.background = "#1877f2";
        followBtn.style.color = "#fff";
    }
}

function loadFollowStats(uid) {
    if (!uid) return;
    onValue(ref(db, `followers/${uid}`), (snapshot) => {
        document.getElementById("followersCount").innerText = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
    });
    onValue(ref(db, `following/${uid}`), (snapshot) => {
        document.getElementById("followingCount").innerText = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
    });

    const currentUser = auth.currentUser;
    const followBtn = document.getElementById("followBtn");
    if (currentUser && currentUser.uid !== uid) {
        followBtn.style.display = "block";
        get(ref(db, `following/${currentUser.uid}/${uid}`)).then((snapshot) => {
            updateFollowBtn(snapshot.exists());
        });
    } else {
        followBtn.style.display = "none";
    }
}

function showUserList(targetUid, type) {
    const container = document.getElementById("listModalContainer");
    const title = document.getElementById("listModalTitle");
    const modal = document.getElementById("listModal");
    if (!container || !modal || !title) return;

    container.innerHTML = "<div style='text-align:center; padding:15px; color:gray;'>লোড হচ্ছে...</div>";
    title.innerText = type === 'followers' ? "Followers" : "Following";
    modal.style.display = "flex";

    get(ref(db, `${type}/${targetUid}`)).then((snapshot) => {
        if (!snapshot.exists()) {
            container.innerHTML = `<div style="text-align:center; padding:20px; color:gray;">কোনো ইউজার পাওয়া যায়নি</div>`;
            return;
        }

        container.innerHTML = "";
        Object.keys(snapshot.val()).forEach(uid => {
            get(ref(db, `userProfile/${uid}`)).then((userSnap) => {
                if (!userSnap.exists()) return;
                const user = userSnap.val();
                const userPic = user.photo
                    ? `<img src="${user.photo}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">`
                    : `<div style="width:36px; height:36px; border-radius:50%; background:#ccc; display:flex; align-items:center; justify-content:center;">${(user.name || 'U')[0]}</div>`;

                const div = document.createElement("div");
                div.style.cssText = "display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid #eee; cursor:pointer;";
                div.innerHTML = `${userPic} <span>${user.name || 'User'}</span>`;
                div.onclick = () => {
                    openUserProfile(uid);
                    modal.style.display = "none";
                };
                container.appendChild(div);
            });
        });
    });
}

// ========== Search ==========
function handleUserSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    const resultsContainer = document.getElementById("searchResults");
    if (!resultsContainer) return;

    if (!query) {
        resultsContainer.innerHTML = "";
        resultsContainer.style.display = "none";
        return;
    }

    get(ref(db, 'userProfile')).then((snapshot) => {
        if (!snapshot.exists()) {
            resultsContainer.style.display = "none";
            return;
        }

        resultsContainer.innerHTML = "";
        let foundAny = false;

        Object.keys(snapshot.val()).forEach(uid => {
            const user = snapshot.val()[uid];
            if ((user.name || "User").toLowerCase().includes(query)) {
                foundAny = true;
                const userPic = user.photo
                    ? `<img src="${user.photo}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;">`
                    : `<div style="width:32px; height:32px; border-radius:50%; background:#ccc; display:flex; align-items:center; justify-content:center; font-size:13px;">${(user.name || 'U')[0]}</div>`;

                const div = document.createElement("div");
                div.style.cssText = "display:flex; align-items:center; gap:8px; padding:8px; cursor:pointer; border-bottom:1px solid #eee;";
                div.innerHTML = `${userPic} <span>${user.name || 'User'}</span>`;
                div.onclick = () => {
                    openUserProfile(uid);
                    resultsContainer.style.display = "none";
                    document.getElementById("userSearchInput").value = "";
                };
                resultsContainer.appendChild(div);
            }
        });

        resultsContainer.style.display = "block";
        if (!foundAny) {
            resultsContainer.innerHTML = `<div style="padding:10px; text-align:center; color:gray; font-size:13px;">কোনো ইউজার পাওয়া যায়নি</div>`;
        }
    });
}

// ========== Feed ==========
function loadPosts() {
    onValue(ref(db, 'posts'), (snapshot) => {
        const feedContainer = document.getElementById("feedContainer");
        if (!feedContainer) return;
        feedContainer.innerHTML = "";

        const data = snapshot.val();
        if (!data) return;

        const currentUser = auth.currentUser;

        Object.keys(data).reverse().forEach(key => {
            const post = data[key];
            let likeCount = 0, dislikeCount = 0, myReaction = null;

            if (post.reactions) {
                Object.entries(post.reactions).forEach(([uid, type]) => {
                    if (type === 'like') likeCount++;
                    if (type === 'dislike') dislikeCount++;
                    if (currentUser && uid === currentUser.uid) myReaction = type;
                });
            }

            let commentCount = 0, commentsHTML = "";
            if (post.comments) {
                const commentEntries = Object.entries(post.comments);
                commentCount = commentEntries.length;

                commentEntries.forEach(([commentId, c]) => {
                    let repliesHTML = "";
                    if (c.replies) {
                        Object.values(c.replies).forEach(r => {
                            repliesHTML += `<div style="margin-left:15px; font-size:12px; color:#555; margin-top:4px;"><b>${r.userName}:</b> ${r.text}</div>`;
                        });
                    }

                    commentsHTML += `
                        <div style="margin-bottom:8px; font-size:13px;">
                            <b>${c.userName}:</b> ${c.text}
                            <button class="reply-toggle-btn" data-postid="${key}" data-commentid="${commentId}" style="background:none; border:none; color:#1877f2; font-size:11px; cursor:pointer; margin-left:6px;">Reply</button>
                            <div id="reply-box-${key}-${commentId}" style="display:none; margin-top:5px;">
                                <input type="text" id="reply-input-${key}-${commentId}" placeholder="রিপ্লাই লিখুন..." style="width:70%; padding:4px 8px; border:1px solid #ccc; border-radius:12px; font-size:12px;">
                                <button class="send-reply-btn" data-postid="${key}" data-commentid="${commentId}" style="background:#1877f2; color:#fff; border:none; padding:4px 10px; border-radius:10px; font-size:11px; cursor:pointer;">পাঠান</button>
                            </div>
                            ${repliesHTML}
                        </div>`;
                });
            }

            const imageHTML = post.image ? `<img src="${post.image}" style="width:100%; max-height:300px; object-fit:cover; border-radius:8px; margin-top:8px; cursor:pointer;" onclick="document.getElementById('previewImageLarge').src='${post.image}';document.getElementById('imagePreviewModal').style.display='flex'">` : "";
            const userPicHTML = post.userPic
                ? `<img src="${post.userPic}" style="width:36px; height:36px; border-radius:50%; object-fit:cover;">`
                : `<div style="width:36px; height:36px; border-radius:50%; background:#ccc; display:flex; align-items:center; justify-content:center; font-weight:bold;">${(post.userName || 'U')[0]}</div>`;

            const isMyPost = currentUser && currentUser.uid === post.userId;

            const postElement = document.createElement("div");
            postElement.className = "card";
            postElement.style.position = "relative";

            postElement.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div class="post-user-info" data-userid="${post.userId}" style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                        ${userPicHTML}
                        <div>
                            <div style="font-weight:bold; font-size:14px;">${post.userName || 'User'}</div>
                            <div style="font-size:11px; color:gray;">${post.time || ''}</div>
                        </div>
                    </div>
                    <div style="position:relative;">
                        <button class="more-btn" data-postid="${key}" style="background:none; border:none; font-size:18px; cursor:pointer; padding:4px;">⋮</button>
                        <div id="menu-${key}" class="menu-popup">
                            <button class="share-btn" data-content="${(post.content || '').replace(/"/g, '&quot;')}" data-image="${post.image || ''}">🔗 শেয়ার</button>
                            ${post.image ? `<button class="save-img-btn" data-image="${post.image}">📥 সেভ করুন</button>` : ''}
                            ${isMyPost ? `<button class="delete-post-btn" data-postid="${key}" style="color:red; font-weight:bold;">🗑️ ডিলেট</button>` : ''}
                        </div>
                    </div>
                </div>
                ${post.content ? `<div style="margin-top:10px; font-size:14px;">${post.content}</div>` : ''}
                ${imageHTML}
                <div style="display:flex; gap:15px; margin-top:12px; padding-top:8px; border-top:1px solid #eee; font-size:13px;">
                    <button class="like-btn" data-postid="${key}" style="background:none; border:none; cursor:pointer; color:${myReaction === 'like' ? '#1877f2' : '#65676b'};">
                        👍 ${likeCount > 0 ? likeCount : ''} Like
                    </button>
                    <button class="dislike-btn" data-postid="${key}" style="background:none; border:none; cursor:pointer; color:${myReaction === 'dislike' ? '#1877f2' : '#65676b'};">
                        👎 ${dislikeCount > 0 ? dislikeCount : ''} Unlike
                    </button>
                    <button class="comment-toggle-btn" data-postid="${key}" style="background:none; border:none; cursor:pointer; color:#65676b;">
                        💬 ${commentCount > 0 ? commentCount : ''} Comment
                    </button>
                </div>
                <div id="comment-section-${key}" style="display:none; margin-top:10px; border-top:1px solid #eee; padding-top:10px;">
                    <div style="display:flex; gap:6px; margin-bottom:10px;">
                        <input type="text" id="comment-input-${key}" placeholder="কমেন্ট লিখুন..." style="flex:1; padding:6px 12px; border:1px solid #ccc; border-radius:16px; font-size:13px;">
                        <button class="send-comment-btn" data-postid="${key}" style="background:#1877f2; color:#fff; border:none; padding:6px 12px; border-radius:14px; font-size:12px; cursor:pointer;">Send</button>
                    </div>
                    ${commentsHTML}
                </div>
            `;

            postElement.querySelector('.post-user-info')?.addEventListener('click', (e) => {
                openUserProfile(e.currentTarget.getAttribute('data-userid'));
            });
            postElement.querySelector('.more-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                const menu = document.getElementById(`menu-${e.currentTarget.getAttribute('data-postid')}`);
                if (menu) menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
            });
            postElement.querySelector('.share-btn')?.addEventListener('click', (e) => {
                const content = e.currentTarget.getAttribute('data-content');
                const img = e.currentTarget.getAttribute('data-image');
                if (navigator.share) {
                    navigator.share({ title: 'Mini App Post', text: content, url: img || window.location.href });
                } else {
                    navigator.clipboard.writeText(img || window.location.href);
                    alert("লিংক কপি হয়েছে!");
                }
            });
            postElement.querySelector('.save-img-btn')?.addEventListener('click', (e) => {
                const img = e.currentTarget.getAttribute('data-image');
                if (img) {
                    const a = document.createElement('a');
                    a.href = img;
                    a.download = 'post-image.jpg';
                    a.click();
                }
            });
            postElement.querySelector('.delete-post-btn')?.addEventListener('click', (e) => {
                if (confirm("আপনি কি পোস্টটি ডিলেট করতে চান?")) {
                    remove(ref(db, `posts/${e.currentTarget.getAttribute('data-postid')}`));
                }
            });
            postElement.querySelector('.like-btn')?.addEventListener('click', (e) => {
                handleReaction(e.currentTarget.getAttribute('data-postid'), 'like');
            });
            postElement.querySelector('.dislike-btn')?.addEventListener('click', (e) => {
                handleReaction(e.currentTarget.getAttribute('data-postid'), 'dislike');
            });
            postElement.querySelector('.comment-toggle-btn')?.addEventListener('click', (e) => {
                const box = document.getElementById(`comment-section-${e.currentTarget.getAttribute('data-postid')}`);
                if (box) box.style.display = box.style.display === 'block' ? 'none' : 'block';
            });
            postElement.querySelector('.send-comment-btn')?.addEventListener('click', (e) => {
                addComment(e.currentTarget.getAttribute('data-postid'));
            });
            postElement.querySelectorAll('.reply-toggle-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const pId = e.currentTarget.getAttribute('data-postid');
                    const cId = e.currentTarget.getAttribute('data-commentid');
                    const replyBox = document.getElementById(`reply-box-${pId}-${cId}`);
                    if (replyBox) replyBox.style.display = replyBox.style.display === 'block' ? 'none' : 'block';
                });
            });
            postElement.querySelectorAll('.send-reply-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    addReply(e.currentTarget.getAttribute('data-postid'), e.currentTarget.getAttribute('data-commentid'));
                });
            });

            feedContainer.appendChild(postElement);
        });
    });
}

function handleReaction(postId, type) {
    const user = auth.currentUser;
    if (!user) return;

    get(ref(db, `posts/${postId}`)).then(postSnap => {
        if (!postSnap.exists()) return;
        const post = postSnap.val();
        const reactionRef = ref(db, `posts/${postId}/reactions/${user.uid}`);

        get(reactionRef).then(snapshot => {
            if (snapshot.val() === type) {
                remove(reactionRef);
            } else {
                set(reactionRef, type);
                if (type === 'like' && post.userId) {
                    sendNotification(post.userId, `${cachedUserName} আপনার পোস্টে লাইক দিয়েছেন।`, post.image || null);
                }
            }
        });
    });
}

function addComment(postId) {
    const user = auth.currentUser;
    if (!user) return;
    const input = document.getElementById(`comment-input-${postId}`);
    const text = input?.value.trim() || "";
    if (!text) return;

    get(ref(db, `posts/${postId}`)).then(postSnap => {
        if (!postSnap.exists()) return;
        const post = postSnap.val();

        push(ref(db, `posts/${postId}/comments`), {
            userName: cachedUserName,
            text,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });

        if (post.userId) sendNotification(post.userId, `${cachedUserName} কমেন্ট করেছেন: "${text}"`, post.image || null);
        input.value = "";
    });
}

function addReply(postId, commentId) {
    const user = auth.currentUser;
    if (!user) return;
    const input = document.getElementById(`reply-input-${postId}-${commentId}`);
    const text = input?.value.trim() || "";
    if (!text) return;

    get(ref(db, `posts/${postId}`)).then(postSnap => {
        if (!postSnap.exists()) return;
        const post = postSnap.val();

        push(ref(db, `posts/${postId}/comments/${commentId}/replies`), {
            userName: cachedUserName,
            text
        });

        if (post.userId) sendNotification(post.userId, `${cachedUserName} আপনার কমেন্টে রিপ্লাই দিয়েছেন।`, post.image || null);
        input.value = "";
    });
}

// ========== Viewport & History ==========
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
        const chatRoomBox = document.getElementById('chatRoomBox');
        if (chatRoomBox && chatRoomBox.style.display !== 'none') {
            chatRoomBox.style.height = `${window.visualViewport.height}px`;
            const messageDisplayArea = document.getElementById('messageDisplayArea');
            if (messageDisplayArea) messageDisplayArea.scrollTop = messageDisplayArea.scrollHeight;
        }
    });
}

window.addEventListener('popstate', function (event) {
    if (event.state?.tabId) {
        switchTab(event.state.tabId, null, false);
    } else {
        switchTab('homeTab', null, false);
    }
});

history.replaceState({ tabId: 'homeTab' }, "", "");

// ========== Terminal ==========
let lastLocation = null;

function openTerminal() {
    const modal = document.getElementById("terminalModal");
    const output = document.getElementById("terminalOutput");
    if (!modal || !output) return;
    output.innerHTML = `Welcome to Secure Terminal v1.0\nType a command and press Enter...\n\n`;
    modal.style.display = "flex";
    setTimeout(() => document.getElementById("terminalInput")?.focus(), 100);
}

function closeTerminal() {
    document.getElementById("terminalModal").style.display = "none";
}

function terminalPrint(text) {
    const output = document.getElementById("terminalOutput");
    if (output) {
        output.innerHTML += text + "\n";
        output.scrollTop = output.scrollHeight;
    }
}

function handleTerminalCommand(cmd) {
    if (!cmd) return;
    terminalPrint(`$ ${cmd}`);

    if (cmd.toLowerCase() === "akbor") {
        const receiverName = document.getElementById("chatReceiverName")?.innerText || "User";
        terminalPrint("Authenticating...");
        terminalPrint("Access granted.");
        terminalPrint(`Tracking location of: ${receiverName}...`);

        if (!navigator.geolocation) {
            terminalPrint("Error: Geolocation not supported.");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = pos.coords.latitude.toFixed(6);
                const lng = pos.coords.longitude.toFixed(6);
                lastLocation = { lat, lng, name: receiverName };

                terminalPrint(`Location found for ${receiverName}:`);
                terminalPrint(`Lat: ${lat}`);
                terminalPrint(`Lng: ${lng}`);
                terminalPrint(``);
                terminalPrint(`>> <span class="location-link" id="openMapLink">লোকেশন</span>`);

                setTimeout(() => {
                    document.getElementById("openMapLink")?.addEventListener("click", openLocationMap);
                }, 50);
            },
            () => {
                terminalPrint("Error: Location permission denied or unavailable.");
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    } else if (cmd.toLowerCase() === "clear") {
        document.getElementById("terminalOutput").innerHTML = "";
    } else if (cmd.toLowerCase() === "help") {
        terminalPrint("Available commands:");
        terminalPrint("  akbor  - Get chat partner location");
        terminalPrint("  clear  - Clear terminal");
        terminalPrint("  help   - Show this help");
    } else {
        terminalPrint(`Command not found: ${cmd}`);
        terminalPrint(`Type "help" for available commands.`);
    }
}

function openLocationMap() {
    if (!lastLocation) return alert("No location data available.");

    const { lat, lng, name } = lastLocation;
    const mapContainer = document.getElementById("mapContainer");
    const mapModal = document.getElementById("mapModal");

    mapContainer.innerHTML = `
        <iframe width="100%" height="100%" frameborder="0" scrolling="no" marginheight="0" marginwidth="0"
            src="https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(lng)-0.015}%2C${parseFloat(lat)-0.015}%2C${parseFloat(lng)+0.015}%2C${parseFloat(lat)+0.015}&layer=mapnik&marker=${lat}%2C${lng}"
            style="border:0;"></iframe>
        <div style="position:absolute; bottom:10px; left:10px; right:10px; background:rgba(0,0,0,0.8); color:#fff; padding:10px 12px; border-radius:10px; font-size:13px; text-align:center;">
            📍 <b>${name || 'User'}</b> এর লোকেশন<br>
            <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" style="color:#4fc3f7; text-decoration:underline; display:inline-block; margin-top:6px;">
                🗺️ রাস্তা দেখুন
            </a>
        </div>
    `;
    mapModal.style.display = "flex";
    closeTerminal();
}

// ========== Call Controls ==========
function startCallTimer() {
    callStartTime = Date.now();
    const timerEl = document.getElementById("callTimer");
    if (callTimerInterval) clearInterval(callTimerInterval);
    callTimerInterval = setInterval(() => {
        if (!callStartTime || !timerEl) return;
        const sec = Math.floor((Date.now() - callStartTime) / 1000);
        const m = Math.floor(sec / 60).toString().padStart(2, '0');
        const s = (sec % 60).toString().padStart(2, '0');
        timerEl.innerText = `${m}:${s}`;
    }, 500);
}

function stopCallTimer() {
    if (callTimerInterval) clearInterval(callTimerInterval);
    callTimerInterval = null;
    callStartTime = null;
}

function toggleMuteMic() {
    if (!localStream) return;
    isMicMuted = !isMicMuted;
    localStream.getAudioTracks().forEach(t => t.enabled = !isMicMuted);
    document.getElementById("muteMicBtn")?.classList.toggle("muted", isMicMuted);
}

function toggleSpeaker() {
    isSpeakerOn = !isSpeakerOn;
    const remoteVideo = document.getElementById("remoteVideo");
    if (remoteVideo) remoteVideo.muted = !isSpeakerOn;
    document.getElementById("speakerBtn")?.classList.toggle("muted", !isSpeakerOn);
}

async function switchCamera() {
    if (!localStream || currentCallType !== 'video') return;
    currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    try {
        localStream.getTracks().forEach(t => t.stop());
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: { facingMode: currentFacingMode }
        });
        document.getElementById("localVideo").srcObject = localStream;

        if (peerConnection) {
            const senders = peerConnection.getSenders();
            const videoTrack = localStream.getVideoTracks()[0];
            const audioTrack = localStream.getAudioTracks()[0];
            senders.forEach(sender => {
                if (sender.track?.kind === 'video' && videoTrack) sender.replaceTrack(videoTrack);
                if (sender.track?.kind === 'audio' && audioTrack) sender.replaceTrack(audioTrack);
            });
        }
        if (isMicMuted) localStream.getAudioTracks().forEach(t => t.enabled = false);
    } catch (e) {
        alert("ক্যামেরা পাল্টানো যায়নি");
    }
}
