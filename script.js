atic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update, set, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDub8zDIVWzhHFN7qx4nuYdwCb1a0s3mR0",
  authDomain: "mini-f7bac.firebaseapp.com",
  projectId: "mini-f7bac",
  storageBucket: "mini-f7bac.firebasestorage.app",
  messagingSenderId: "547201758346",
  appId: "1:547201758346:web:18ea0bbc8921b0d1b2e973",
  measurementId: "G-9KYTTRT5GZ"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

let selectedImageData = null;
let profilePicData = null;
let coverPicData = null;
let cachedUserName = "User";
let unreadNotifCount = 0;
let viewingUserId = null;

window.toggleAuth = function(type) {
    if(type === 'signup') {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('signupForm').style.display = 'block';
    } else {
        document.getElementById('signupForm').style.display = 'none';
        document.getElementById('loginForm').style.display = 'block';
    }
};

window.handleSignup = function() {
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;

    if(!name || !email || !password) {
        alert("দয়া করে সব ঘর সঠিক তথ্য দিয়ে পূরণ করুন!");
        return;
    }

    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            cachedUserName = name;
            set(ref(db, 'userProfile/' + user.uid), {
                name: name,
                email: email
            });
            alert("একাউন্ট তৈরি সফল হয়েছে!");
        })
        .catch((error) => alert("সাইনআপ সমস্যা: " + error.message));
};

window.handleLogin = function() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    signInWithEmailAndPassword(auth, email, password)
        .catch((error) => alert("লগইন ভুল হয়েছে: " + error.message));
};

window.handleLogout = function() {
    signOut(auth);
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('authContainer').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        loadUserData(user.uid);
    } else {
        document.getElementById('authContainer').style.display = 'block';
        document.getElementById('mainApp').style.display = 'none';
    }
});

function loadUserData(uid) {
    onValue(ref(db, 'userProfile/' + uid), (snapshot) => {
        const data = snapshot.val();
        if(data) {
            if(data.name) {
                document.getElementById('profName').value = data.name;
                cachedUserName = data.name;
            }
            if(data.location) document.getElementById('profLocation').value = data.location;
            if(data.hometown) document.getElementById('profHometown').value = data.hometown;
            if(data.college) document.getElementById('profCollege').value = data.college;
            if(data.music) document.getElementById('profMusic').value = data.music;
            if(data.hobbies) document.getElementById('profHobbies').value = data.hobbies;
            
            if(data.photo) {
                profilePicData = data.photo;
                updateProfileUI(data.photo);
            }
            if(data.coverPhoto) {
                coverPicData = data.coverPhoto;
                const coverDisplay = document.getElementById("coverImageDisplay");
                if(coverDisplay) coverDisplay.src = data.coverPhoto;
            }
        }
    });
}

window.switchTab = function(tabId, element) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    if(element) element.classList.add('active');

    if(tabId === 'profileTab' && auth.currentUser) {
        if(!viewingUserId || viewingUserId === auth.currentUser.uid) {
            loadUserData(auth.currentUser.uid);
            showEditButtons(true);
            loadProfileStats(auth.currentUser.uid);
            const actionBox = document.getElementById('profileActionBox');
            if(actionBox) actionBox.style.display = 'none';
        }
    }

    if (tabId === 'notifTab') {
        unreadNotifCount = 0;
        const badge = document.getElementById("notifBadge");
        if (badge) {
            badge.innerText = "0";
            badge.style.display = "none";
        }
    }
};

function updateProfileUI(imgUrl) {
    if(!imgUrl) return;
    const imgHTML = `<img src="${imgUrl}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
    
    const headerContainer = document.getElementById("headerPicContainer");
    const feedContainer = document.getElementById("feedPicContainer");
    const avatarDisplay = document.getElementById("profileAvatarDisplay");

    if(headerContainer) headerContainer.innerHTML = imgHTML;
    if(feedContainer) feedContainer.innerHTML = imgHTML;
    if(avatarDisplay) avatarDisplay.innerHTML = imgHTML;
}

function createAutoPost(caption, imageSrc) {
    const user = auth.currentUser;
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    push(ref(db, 'posts'), {
        userId: user ? user.uid : "",
        userName: cachedUserName,
        userPic: profilePicData || "",
        content: caption,
        image: imageSrc,
        time: timeNow,
        likes: 0
    });
}

window.uploadProfilePic = function(event) {
    const user = auth.currentUser;
    const file = event.target.files[0];
    if (file && user) {
        const reader = new FileReader();
        reader.onload = function(e) {
            profilePicData = e.target.result;
            updateProfileUI(profilePicData);
            update(ref(db, 'userProfile/' + user.uid), { photo: profilePicData });
            createAutoPost("প্রোফাইল ফটো আপডেট করা হয়েছে।", profilePicData);
        };
        reader.readAsDataURL(file);
    }
};

window.uploadCoverPic = function(event) {
    const user = auth.currentUser;
    const file = event.target.files[0];
    if (file && user) {
        const reader = new FileReader();
        reader.onload = function(e) {
            coverPicData = e.target.result;
            const coverDisplay = document.getElementById("coverImageDisplay");
            if(coverDisplay) coverDisplay.src = coverPicData;
            update(ref(db, 'userProfile/' + user.uid), { coverPhoto: coverPicData });
            createAutoPost("কভার ফটো আপডেট করা হয়েছে।", coverPicData);
        };
        reader.readAsDataURL(file);
    }
};

window.saveProfileDetails = function() {
    const user = auth.currentUser;
    const name = document.getElementById('profName').value.trim();
    if(!name || !user) return;

    cachedUserName = name;

    update(ref(db, 'userProfile/' + user.uid), {
        name: name,
        location: document.getElementById('profLocation').value.trim(),
        hometown: document.getElementById('profHometown').value.trim(),
        college: document.getElementById('profCollege').value.trim(),
        music: document.getElementById('profMusic').value.trim(),
        hobbies: document.getElementById('profHobbies').value.trim()
    }).then(() => alert("প্রোফাইল তথ্য সেভ হয়েছে!"));
};

window.showPreview = function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            selectedImageData = e.target.result;
            document.getElementById("imagePreview").src = selectedImageData;
            document.getElementById("previewArea").style.display = "block";
        };
        reader.readAsDataURL(file);
    }
};

window.addPost = function() {
    const user = auth.currentUser;
    const postInput = document.getElementById("postInput");
    const text = postInput.value.trim();

    if (text === "" && !selectedImageData) return;

    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    push(ref(db, 'posts'), {
        userId: user ? user.uid : "",
        userName: cachedUserName,
        userPic: profilePicData || "",
        content: text,
        image: selectedImageData || "",
        time: timeNow,
        likes: 0
    });

    push(ref(db, 'notifications'), {
        text: `📝 ${cachedUserName} নতুন একটি পোস্ট করেছে!`,
        time: timeNow
    });

    postInput.value = "";
    selectedImageData = null;
    document.getElementById("imageInput").value = "";
    document.getElementById("previewArea").style.display = "none";
};

window.toggleLike = function(postId, currentLikes) {
    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    update(ref(db, 'posts/' + postId), { likes: (currentLikes || 0) + 1 });

    push(ref(db, 'notifications'), {
        text: `👍 ${cachedUserName} আপনার/একটি পোস্টে লাইক দিয়েছে!`,
        time: timeNow
    });
};

window.deletePost = function(postId) {
    if(confirm("আপনি কি পোস্টটি ডিলিট করতে চান?")) {
        remove(ref(db, 'posts/' + postId));
    }
};

window.addComment = function(postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    const text = input.value.trim();
    if (text === "") return;

    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    push(ref(db, `posts/${postId}/comments`), { 
        userName: cachedUserName,
        text: text 
    });

    push(ref(db, 'notifications'), {
        text: `💬 ${cachedUserName} কমেন্ট করেছেন: "${text}"`,
        time: timeNow
    });

    input.value = "";
};

// ================= প্রোফাইল ভিউ, ফলোয়ার ও ছবি সংখ্যা হ্যান্ডলার =================

window.openUserProfile = function(userId) {
    if (!userId) return;
    viewingUserId = userId;

    const currentUser = auth.currentUser;
    const isSelf = currentUser && currentUser.uid === userId;

    get(ref(db, 'userProfile/' + userId)).then((snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            
            document.getElementById('profName').value = data.name || '';
            document.getElementById('profLocation').value = data.location || '';
            document.getElementById('profHometown').value = data.hometown || '';
            document.getElementById('profCollege').value = data.college || '';
            document.getElementById('profMusic').value = data.music || '';
            document.getElementById('profHobbies').value = data.hobbies || '';

            const avatarDisplay = document.getElementById("profileAvatarDisplay");
            if (avatarDisplay) {
                if (data.photo) {
                    avatarDisplay.innerHTML = `<img src="${data.photo}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                } else {
                    avatarDisplay.innerHTML = `<svg class="default-avatar-svg" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
                }
            }

            const coverDisplay = document.getElementById("coverImageDisplay");
            if (coverDisplay) {
                coverDisplay.src = data.coverPhoto || "";
            }

            showEditButtons(isSelf);
            const actionBox = document.getElementById('profileActionBox');
            if(actionBox) actionBox.style.display = isSelf ? 'none' : 'block';

            loadProfileStats(userId);
            if (!isSelf && currentUser) {
                checkFollowStatus(currentUser.uid, userId);
            }

            const profileTabBtn = document.querySelectorAll('.tab-btn')[1];
            switchTab('profileTab', profileTabBtn);
        }
    });
};

function showEditButtons(isSelf) {
    const coverUploadLabel = document.querySelector('.cover-upload-label');
    const profileCameraBadge = document.querySelector('.profile-camera-badge');
    const saveBtn = document.querySelector('#profileTab .btn');

    if(coverUploadLabel) coverUploadLabel.style.display = isSelf ? 'inline-block' : 'none';
    if(profileCameraBadge) profileCameraBadge.style.display = isSelf ? 'flex' : 'none';
    if(saveBtn) saveBtn.style.display = isSelf ? 'block' : 'none';
}

function loadProfileStats(targetUid) {
    onValue(ref(db, `followers/${targetUid}`), (snapshot) => {
        const count = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
        document.getElementById('followersCount').innerText = count;
    });

    onValue(ref(db, `following/${targetUid}`), (snapshot) => {
        const count = snapshot.exists() ? Object.keys(snapshot.val()).length : 0;
        document.getElementById('followingCount').innerText = count;
    });

    onValue(ref(db, 'posts'), (snapshot) => {
        let photoCount = 0;
        if (snapshot.exists()) {
            const posts = snapshot.val();
            Object.values(posts).forEach(p => {
                if (p.userId === targetUid && p.image && p.image !== "") {
                    photoCount++;
                }
            });
        }
        document.getElementById('photosCount').innerText = photoCount;
    });
}

function checkFollowStatus(currentUid, targetUid) {
    get(ref(db, `followers/${targetUid}/${currentUid}`)).then(snapshot => {
        const followBtn = document.getElementById('followBtn');
        if (snapshot.exists()) {
            followBtn.innerText = "✓ ফলো করছেন";
            followBtn.classList.add('following-active');
        } else {
            followBtn.innerText = "+ ফলো করুন";
            followBtn.classList.remove('following-active');
        }
    });
}

window.toggleFollow = function() {
    const currentUser = auth.currentUser;
    if (!currentUser || !viewingUserId) return;

    const myUid = currentUser.uid;
    const targetUid = viewingUserId;

    const followerRef = ref(db, `followers/${targetUid}/${myUid}`);
    const followingRef = ref(db, `following/${myUid}/${targetUid}`);

    get(followerRef).then(snapshot => {
        if (snapshot.exists()) {
            remove(followerRef);
            remove(followingRef);
        } else {
            set(followerRef, true);
            set(followingRef, true);

            push(ref(db, 'notifications'), {
                text: `👤 ${cachedUserName} আপনাকে ফলো করা শুরু করেছেন!`,
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
        }
        checkFollowStatus(myUid, targetUid);
    });
};

window.addFriendRequest = function() {
    const input = document.getElementById('friendNameInput');
    const friendName = input.value.trim();
    if(!friendName) return;

    push(ref(db, 'friends'), {
        name: friendName,
        status: "পেন্ডিং"
    });

    input.value = "";
    alert("রিকোয়েস্ট পাঠানো হয়েছে!");
};

onValue(ref(db, 'friends'), (snapshot) => {
    const container = document.getElementById("friendsContainer");
    if(!container) return;
    container.innerHTML = "";
    const data = snapshot.val();
    if(!data) return;

    Object.values(data).forEach(f => {
        container.innerHTML += `
            <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
                <div><b>${f.name}</b></div>
                <span style="font-size:12px; color:#1877f2;">${f.status}</span>
            </div>
        `;
    });
});

window.sendDirectMessage = function() {
    const input = document.getElementById('chatMsgInput');
    const text = input.value.trim();
    if (!text) return;

    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    push(ref(db, 'chats'), {
        sender: cachedUserName,
        text: text,
        time: timeNow
    });

    input.value = '';
};

onValue(ref(db, 'chats'), (snapshot) => {
    const chatBox = document.getElementById("chatMessagesBox");
    if(!chatBox) return;
    chatBox.innerHTML = "";
    const data = snapshot.val();
    if(!data) return;

    Object.values(data).forEach(msg => {
        const isMe = msg.sender === cachedUserName;
        chatBox.innerHTML += `
            <div class="chat-msg ${isMe ? 'my-msg' : ''}">
                <div style="font-size:10px; font-weight:bold; margin-bottom:2px;">${msg.sender || 'Unknown'}</div>
                <div>${msg.text}</div>
                <div style="font-size:9px; opacity:0.8; text-align:right;">${msg.time}</div>
            </div>
        `;
    });
    chatBox.scrollTop = chatBox.scrollHeight;
});

onValue(ref(db, 'posts'), (snapshot) => {
    const feedContainer = document.getElementById("feedContainer");
    if(!feedContainer) return;
    feedContainer.innerHTML = "";
    const data = snapshot.val();
    if (!data) return;

    const currentUser = auth.currentUser;

    Object.keys(data).reverse().forEach(key => {
        const post = data[key];
        const postElement = document.createElement("div");
        postElement.className = "post-card";

        let imageHTML = post.image ? `<img src="${post.image}" class="post-image">` : "";
        let commentsHTML = "";

        if (post.comments) {
            Object.values(post.comments).forEach(c => {
                commentsHTML += `<div class="comment-list"><b>${c.userName || 'User'}:</b> ${c.text}</div>`;
            });
        }

        let userPicHTML = post.userPic 
            ? `<img src="${post.userPic}">`
            : `<svg class="default-avatar-svg" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;

        const isMyPost = currentUser && (post.userId === currentUser.uid);

        postElement.innerHTML = `
            <div class="post-header" onclick="openUserProfile('${post.userId}')">
                <div class="feed-profile-box">${userPicHTML}</div>
                <div>
                    <div class="post-header-info">${post.userName || 'User'}</div>
                    <div class="post-time">${post.time || ''}</div>
                </div>
            </div>
            ${post.content ? `<div class="post-content">${post.content}</div>` : ''}
            ${imageHTML}
            
            <div class="post-actions">
                <button class="action-btn" onclick="toggleLike('${key}', ${post.likes || 0})">
                    👍 Like (${post.likes || 0})
                </button>
                ${isMyPost ? `<button class="action-btn delete-btn" onclick="deletePost('${key}')">🗑️ Delete</button>` : ''}
            </div>

            <div class="comments-section">
                <div class="comment-box">
                    <input type="text" id="comment-input-${key}" class="comment-input" placeholder="কমেন্ট লিখুন...">
                    <button class="comment-btn" onclick="addComment('${key}')">Comment</button>
                </div>
                <div>${commentsHTML}</div>
            </div>
        `;

        feedContainer.appendChild(postElement);
    });
});

let isFirstLoad = true;
onValue(ref(db, 'notifications'), (snapshot) => {
    const notifContainer = document.getElementById("notifContainer");
    if(!notifContainer) return;
    notifContainer.innerHTML = "";
    const data = snapshot.val();
    if (!data) return;

    const list = Object.values(data);
    
    if (!isFirstLoad) {
        unreadNotifCount++;
        const badge = document.getElementById("notifBadge");
        if (badge) {
            badge.innerText = unreadNotifCount;
            badge.style.display = "inline-block";
        }
    }
    isFirstLoad = false;

    list.reverse().forEach(n => {
        notifContainer.innerHTML += `
            <div class="card">
                <p style="font-size: 13px; color: #333;">${n.text}</p>
                <span class="post-time">${n.time}</span>
            </div>
        `;
    });
});
