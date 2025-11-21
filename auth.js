// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBXUyvoU_-YtW6dopODPeSTXylp3vsB18E",
    authDomain: "gamezone-ii.firebaseapp.com",
    projectId: "gamezone-ii",
    storageBucket: "gamezone-ii.firebasestorage.app",
    messagingSenderId: "545515531396",
    appId: "1:545515531396:web:a4d7016c8475092ddee6d1",
    measurementId: "G-VS4Q4RNMQS"
};

// Initialize Firebase
let auth = null;
let isFirebaseConfigured = false;

if (firebaseConfig.apiKey !== "YOUR_API_KEY_HERE") {
    try {
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        isFirebaseConfigured = true;
        console.log('Firebase initialized successfully');
    } catch (error) {
        console.error('Firebase initialization error:', error);
    }
}

// Global variables
let currentUser = null;
let ADMIN_EMAIL = null;

// Initialize admin email on load
(async () => {
    ADMIN_EMAIL = await getAdminEmail();
})();

// Secure admin check - stored server-side in shared storage
async function getAdminEmail() {
    try {
        const adminData = await window.storage.get('admin_email', true);
        if (adminData) {
            return adminData.value;
        }
        // First time setup - set admin email
        await window.storage.set('admin_email', 'tiemppo.gamezone2@gmail.com', true);
        return 'tiemppo.gamezone2@gmail.com';
    } catch (error) {
        return 'tiemppo.gamezone2@gmail.com';
    }
}

async function getClientIP() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('fingerprint', 2, 2);
    const fingerprint = canvas.toDataURL();
    
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
        const char = fingerprint.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return 'fp_' + Math.abs(hash).toString(36);
}

async function register(e) {
    e.preventDefault();
    const username = document.getElementById('registerUsername').value.trim();
    const email = document.getElementById('registerEmail').value.toLowerCase().trim();
    const password = document.getElementById('registerPassword').value;

    // Clear previous messages
    document.getElementById('registerError').innerHTML = '';
    document.getElementById('registerSuccess').innerHTML = '';

    // Validate all fields are filled
    if (!username || !email || !password) {
        const errorDiv = document.getElementById('registerError');
        errorDiv.innerHTML = '<div class="error">Please fill out all fields!</div>';
        requestAnimationFrame(() => {
            errorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        return;
    }

    // Validate username (only letters, numbers, underscore, hyphen)
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!usernameRegex.test(username)) {
        const errorDiv = document.getElementById('registerError');
        errorDiv.innerHTML = '<div class="error">Username can only contain letters, numbers, underscores (_), and hyphens (-).</div>';
        requestAnimationFrame(() => {
            errorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        return;
    }

    // Validate email format (7 digits @lwsd.org OR tiemppo.gamezone2@gmail.com)
    const adminEmail = 'tiemppo.gamezone2@gmail.com';
    const lwsdEmailRegex = /^\d{7}@lwsd\.org$/;
    
    if (email !== adminEmail && !lwsdEmailRegex.test(email)) {
        const errorDiv = document.getElementById('registerError');
        errorDiv.innerHTML = '<div class="error">Email must be in format: 1234567@lwsd.org (7 digits followed by @lwsd.org)</div>';
        requestAnimationFrame(() => {
            errorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        return;
    }

    // Validate password length
    if (password.length < 6) {
        const errorDiv = document.getElementById('registerError');
        errorDiv.innerHTML = '<div class="error">Password must be at least 6 characters long!</div>';
        requestAnimationFrame(() => {
            errorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        return;
    }

    try {
        const clientIP = await getClientIP();
        
        const ipCheck = await window.storage.get(`ip:${clientIP}`, true);
        if (ipCheck) {
            const errorDiv = document.getElementById('registerError');
            errorDiv.innerHTML = '<div class="error">You have already created an account with this device. Please do not make multiple accounts.</div>';
            requestAnimationFrame(() => {
                errorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
            return;
        }

        const existingUser = await window.storage.get(`user:${email}`, true);
        if (existingUser) {
            const errorDiv = document.getElementById('registerError');
            errorDiv.innerHTML = '<div class="error">Email already registered!</div>';
            requestAnimationFrame(() => {
                errorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
            return;
        }

        // Create Firebase user if configured
        if (isFirebaseConfigured) {
            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                
                // Send verification email
                await userCredential.user.sendEmailVerification();
                
                const adminEmailAddress = await getAdminEmail();
                
                const userData = {
                    username,
                    email,
                    password: btoa(password),
                    isAdmin: email === adminEmailAddress,
                    createdAt: new Date().toISOString(),
                    verified: false,
                    firebaseUid: userCredential.user.uid,
                    ip: clientIP
                };

                await window.storage.set(`user:${email}`, JSON.stringify(userData), true);
                await window.storage.set(`ip:${clientIP}`, email, true);

                document.getElementById('registerSuccess').innerHTML = '<div class="success">Account created successfully! Verification email sent to ' + email + '. Please check your inbox and spam folder.</div>';
                
                localStorage.setItem('pendingVerification', email);
                
                setTimeout(() => {
                    hideModal('registerModal');
                    showModal('verifyModal');
                    document.getElementById('registerSuccess').innerHTML = '';
                }, 4000);
            } catch (firebaseError) {
                console.error('Firebase registration error:', firebaseError);
                const errorDiv = document.getElementById('registerError');
                if (firebaseError.code === 'auth/email-already-in-use') {
                    errorDiv.innerHTML = '<div class="error">Email already registered in Firebase!</div>';
                } else {
                    errorDiv.innerHTML = '<div class="error">Firebase error: ' + firebaseError.message + '</div>';
                }
                requestAnimationFrame(() => {
                    errorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                });
            }
        } else {
            // Fallback mode without Firebase
            const adminEmailAddress = await getAdminEmail();
            
            const userData = {
                username,
                email,
                password: btoa(password),
                isAdmin: email === adminEmailAddress,
                createdAt: new Date().toISOString(),
                verified: true, // Auto-verify in demo mode
                ip: clientIP
            };

            await window.storage.set(`user:${email}`, JSON.stringify(userData), true);
            await window.storage.set(`ip:${clientIP}`, email, true);

            document.getElementById('registerSuccess').innerHTML = '<div class="success">Account created successfully! (Demo Mode - Firebase not configured, email verification disabled)</div>';
            
            setTimeout(() => {
                hideModal('registerModal');
                document.getElementById('registerSuccess').innerHTML = '';
                showModal('loginModal');
            }, 3000);
        }
    } catch (error) {
        console.error('Registration error:', error);
        const errorDiv = document.getElementById('registerError');
        errorDiv.innerHTML = '<div class="error">Registration failed. Please try again. Error: ' + error.message + '</div>';
        requestAnimationFrame(() => {
            errorDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    }
}

async function verifyEmail(e) {
    e.preventDefault();
    const email = localStorage.getItem('pendingVerification');

    if (!email) {
        document.getElementById('verifyError').innerHTML = '<div class="error">No pending verification found.</div>';
        return;
    }

    if (!isFirebaseConfigured) {
        document.getElementById('verifyError').innerHTML = '<div class="error">Firebase not configured. Email verification unavailable.</div>';
        return;
    }

    try {
        // Reload the current Firebase user to check verification status
        await auth.currentUser.reload();
        
        if (auth.currentUser.emailVerified) {
            const userData = await window.storage.get(`user:${email}`, true);
            if (!userData) {
                document.getElementById('verifyError').innerHTML = '<div class="error">User not found.</div>';
                return;
            }

            const user = JSON.parse(userData.value);
            user.verified = true;
            await window.storage.set(`user:${email}`, JSON.stringify(user), true);
            
            localStorage.removeItem('pendingVerification');
            currentUser = user;
            localStorage.setItem('currentUser', email);
            
            hideModal('verifyModal');
            updateUI();
            await alert('Email verified successfully! Welcome to GameZone II!');
        } else {
            document.getElementById('verifyError').innerHTML = '<div class="error">Email not verified yet. Please check your inbox and click the verification link, then click "Check Verification Status".</div>';
        }
    } catch (error) {
        console.error('Verification error:', error);
        document.getElementById('verifyError').innerHTML = '<div class="error">Verification failed: ' + error.message + '</div>';
    }
}

async function resendVerification() {
    const email = localStorage.getItem('pendingVerification');
    if (!email) {
        await alert('No pending verification found.');
        return;
    }

    if (!isFirebaseConfigured) {
        await alert('Firebase not configured. Email verification unavailable.');
        return;
    }

    try {
        if (auth.currentUser) {
            await auth.currentUser.sendEmailVerification();
            await alert('Verification email resent! Check your inbox and spam folder.');
        } else {
            await alert('Please log in first to resend verification email.');
        }
    } catch (error) {
        console.error('Resend verification error:', error);
        await alert('Failed to resend verification email: ' + error.message);
    }
}

async function login(e) {
    e.preventDefault();
    const loginInput = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    // Clear previous errors
    document.getElementById('loginError').innerHTML = '';

    // Validate fields
    if (!loginInput || !password) {
        document.getElementById('loginError').innerHTML = '<div class="error">Please fill out all fields!</div>';
        return;
    }

    try {
        let userData = null;
        let userEmail = null;

        // Try to find user by email first
        const emailInput = loginInput.toLowerCase();
        userData = await window.storage.get(`user:${emailInput}`, true);
        
        if (userData) {
            userEmail = emailInput;
        } else {
            // If not found by email, search by username
            const allUsers = await window.storage.list('user:', true);
            if (allUsers && allUsers.keys) {
                for (const key of allUsers.keys) {
                    const user = await window.storage.get(key, true);
                    if (user) {
                        const userObj = JSON.parse(user.value);
                        if (userObj.username.toLowerCase() === loginInput.toLowerCase()) {
                            userData = user;
                            userEmail = userObj.email;
                            break;
                        }
                    }
                }
            }
        }
        
        if (!userData) {
            document.getElementById('loginError').innerHTML = '<div class="error">Invalid credentials!</div>';
            return;
        }

        const user = JSON.parse(userData.value);

        if (btoa(password) !== user.password) {
            document.getElementById('loginError').innerHTML = '<div class="error">Invalid credentials!</div>';
            return;
        }

        // Sign in with Firebase if configured
        if (isFirebaseConfigured) {
            try {
                await auth.signInWithEmailAndPassword(userEmail, password);
                
                // Check if email is verified
                if (!auth.currentUser.emailVerified && !user.verified) {
                    localStorage.setItem('pendingVerification', userEmail);
                    hideModal('loginModal');
                    showModal('verifyModal');
                    await alert('Please verify your email before logging in. Check your inbox for the verification link.');
                    return;
                }
                
                // Update verification status
                if (auth.currentUser.emailVerified && !user.verified) {
                    user.verified = true;
                    await window.storage.set(`user:${userEmail}`, JSON.stringify(user), true);
                }
            } catch (firebaseError) {
                console.error('Firebase login error:', firebaseError);
                document.getElementById('loginError').innerHTML = '<div class="error">Firebase login failed: ' + firebaseError.message + '</div>';
                return;
            }
        }

        currentUser = user;
        localStorage.setItem('currentUser', userEmail);
        
        // Track visit
        await trackVisit();
        
        updateUI();
        hideModal('loginModal');
        document.getElementById('loginError').innerHTML = '';
    } catch (error) {
        console.error('Login error:', error);
        document.getElementById('loginError').innerHTML = '<div class="error">Login failed. Please try again.</div>';
    }
}

async function logout() {
    const confirmed = await confirm('Are you sure you want to logout?');
    if (confirmed) {
        // Sign out from Firebase if configured
        if (isFirebaseConfigured && auth.currentUser) {
            try {
                await auth.signOut();
            } catch (error) {
                console.error('Firebase logout error:', error);
            }
        }
        
        currentUser = null;
        localStorage.removeItem('currentUser');
        updateUI();
    }
}

function showForgotPassword() {
    hideModal('loginModal');
    showModal('forgotPasswordModal');
}

async function sendPasswordReset(e) {
    e.preventDefault();
    const email = document.getElementById('resetEmail').value.toLowerCase().trim();
    
    document.getElementById('resetError').innerHTML = '';
    document.getElementById('resetSuccess').innerHTML = '';

    if (!email) {
        document.getElementById('resetError').innerHTML = '<div class="error">Please enter your email address!</div>';
        return;
    }

    if (!isFirebaseConfigured) {
        document.getElementById('resetError').innerHTML = '<div class="error">Firebase not configured. Password reset unavailable. Please contact admin.</div>';
        return;
    }

    try {
        // Check if user exists in our system
        const userData = await window.storage.get(`user:${email}`, true);
        if (!userData) {
            document.getElementById('resetError').innerHTML = '<div class="error">No account found with this email!</div>';
            return;
        }

        // Send password reset email via Firebase
        await auth.sendPasswordResetEmail(email);
        
        document.getElementById('resetSuccess').innerHTML = '<div class="success">Password reset email sent! Check your inbox and spam folder.</div>';
        
        setTimeout(() => {
            hideModal('forgotPasswordModal');
            showModal('loginModal');
            document.getElementById('resetSuccess').innerHTML = '';
            document.getElementById('resetEmail').value = '';
        }, 4000);
    } catch (error) {
        console.error('Password reset error:', error);
        document.getElementById('resetError').innerHTML = '<div class="error">Failed to send reset email: ' + error.message + '</div>';
    }
}

async function checkAutoLogin() {
    // Check shutdown first
    await checkShutdown();
    
    const email = localStorage.getItem('currentUser');
    if (email) {
        try {
            const userData = await window.storage.get(`user:${email}`, true);
            if (userData) {
                currentUser = JSON.parse(userData.value);
                
                // Check Firebase auth state if configured
                if (isFirebaseConfigured) {
                    auth.onAuthStateChanged(async (firebaseUser) => {
                        if (firebaseUser && firebaseUser.email === email) {
                            // Update verification status
                            if (firebaseUser.emailVerified && !currentUser.verified) {
                                currentUser.verified = true;
                                await window.storage.set(`user:${email}`, JSON.stringify(currentUser), true);
                            }
                        }
                    });
                }
                
                await trackVisit();
                updateUI();
            }
        } catch (error) {
            console.error('Auto-login failed:', error);
        }
    } else {
        updateUI();
    }
}

async function loadAllUsers() {
    if (!currentUser || !currentUser.isAdmin) {
        await alert('Admin access required!');
        return;
    }

    try {
        const result = await window.storage.list('user:', true);
        if (!result || !result.keys || result.keys.length === 0) {
            document.getElementById('usersList').innerHTML = '<div class="game-card">No users found.</div>';
            return;
        }

        let usersHTML = '<h3 style="margin-top: 20px; color: var(--accent-primary);">All Registered Users</h3>';
        
        for (const key of result.keys) {
            const userData = await window.storage.get(key, true);
            if (userData) {
                const user = JSON.parse(userData.value);
                const adminEmail = await getAdminEmail();
                usersHTML += `
                    <div class="game-card" style="margin-top: 10px;">
                        <h3>${user.username} ${user.isAdmin ? '<span class="admin-badge">ADMIN</span>' : ''}</h3>
                        <p><strong>Email:</strong> ${user.email}</p>
                        <p><strong>Status:</strong> ${user.verified ? '<span style="color: #44ff44;">✓ Verified</span>' : '<span style="color: #ff4444;">✗ Unverified</span>'}</p>
                        <p><strong>Joined:</strong> ${new Date(user.createdAt).toLocaleString()}</p>
                        ${user.email !== adminEmail ? `<button class="btn btn-secondary" onclick="kickUser('${user.email}')">Kick User</button>` : ''}
                    </div>
                `;
            }
        }
        
        document.getElementById('usersList').innerHTML = usersHTML;
    } catch (error) {
        console.error('Failed to load users:', error);
        document.getElementById('usersList').innerHTML = '<div class="error">Failed to load users.</div>';
    }
}

async function kickUser(email) {
    if (!currentUser || !currentUser.isAdmin) return;
    
    const adminEmail = await getAdminEmail();
    if (email === adminEmail) {
        await alert('Cannot kick the admin!');
        return;
    }
    
    const confirmed = await confirm(`Are you sure you want to kick ${email}?`);
    if (confirmed) {
        try {
            const userData = await window.storage.get(`user:${email}`, true);
            if (userData) {
                const user = JSON.parse(userData.value);
                
                // Delete from Firebase if configured
                if (isFirebaseConfigured && user.firebaseUid) {
                    // Note: Deleting users from Firebase requires Admin SDK on backend
                    // This is a client-side limitation
                    console.log('Firebase user deletion requires backend Admin SDK');
                }
                
                await window.storage.delete(`user:${email}`, true);
                await window.storage.delete(`ip:${user.ip}`, true);
                await alert(`User ${email} has been kicked from local storage. Firebase account may still exist.`);
                loadAllUsers();
            }
        } catch (error) {
            await alert('Failed to kick user: ' + error.message);
        }
    }
}