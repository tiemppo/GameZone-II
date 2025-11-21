// Storage wrapper - fallback to localStorage if window.storage is not available
if (!window.storage) {
    window.storage = {
        async get(key, shared) {
            try {
                const value = localStorage.getItem(key);
                if (value === null) {
                    return null;
                }
                return { value: value };
            } catch (error) {
                console.error('Storage get error:', error);
                return null;
            }
        },
        async set(key, value, shared) {
            try {
                localStorage.setItem(key, value);
                return true;
            } catch (error) {
                console.error('Storage set error:', error);
                throw error;
            }
        },
        async delete(key, shared) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (error) {
                console.error('Storage delete error:', error);
                throw error;
            }
        },
        async list(prefix, shared) {
            try {
                const keys = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith(prefix)) {
                        keys.push(key);
                    }
                }
                return { keys: keys };
            } catch (error) {
                console.error('Storage list error:', error);
                return { keys: [] };
            }
        }
    };
}

// Theme management
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
updateThemeIcon();

let currentChatRoom = 'general';
let isUserMode = false;
let isShutdown = false;

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon();
}

function updateThemeIcon() {
    const theme = document.documentElement.getAttribute('data-theme');
    const moonIcon = document.getElementById('moonIcon');
    const sunIcon = document.getElementById('sunIcon');
    
    if (theme === 'dark') {
        moonIcon.style.display = 'none';
        sunIcon.style.display = 'block';
    } else {
        moonIcon.style.display = 'block';
        sunIcon.style.display = 'none';
    }
}

function showModal(id) {
    document.getElementById(id).classList.add('active');
}

function hideModal(id) {
    document.getElementById(id).classList.remove('active');
    
    // Clear all form inputs and messages when closing modals
    if (id === 'registerModal') {
        document.getElementById('registerUsername').value = '';
        document.getElementById('registerEmail').value = '';
        document.getElementById('registerPassword').value = '';
        document.getElementById('registerError').innerHTML = '';
        document.getElementById('registerSuccess').innerHTML = '';
    }
    
    if (id === 'loginModal') {
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
        document.getElementById('loginError').innerHTML = '';
    }
    
    if (id === 'verifyModal') {
        document.getElementById('verifyError').innerHTML = '';
    }
    
    if (id === 'forgotPasswordModal') {
        document.getElementById('resetEmail').value = '';
        document.getElementById('resetError').innerHTML = '';
        document.getElementById('resetSuccess').innerHTML = '';
    }
}

// Custom Alert and Confirm functions
function customAlert(message, title = 'Alert') {
    return new Promise((resolve) => {
        const dialog = document.getElementById('customDialog');
        const dialogTitle = document.getElementById('dialogTitle');
        const dialogMessage = document.getElementById('dialogMessage');
        const dialogButtons = document.getElementById('dialogButtons');
        
        dialogTitle.textContent = title;
        dialogMessage.textContent = message;
        dialogButtons.innerHTML = '<button class="btn btn-primary">OK</button>';
        
        dialog.classList.add('active');
        
        const okButton = dialogButtons.querySelector('button');
        okButton.onclick = () => {
            hideCustomDialog();
            resolve();
        };
    });
}

function customConfirm(message, title = 'Confirm') {
    return new Promise((resolve) => {
        const dialog = document.getElementById('customDialog');
        const dialogTitle = document.getElementById('dialogTitle');
        const dialogMessage = document.getElementById('dialogMessage');
        const dialogButtons = document.getElementById('dialogButtons');
        
        dialogTitle.textContent = title;
        dialogMessage.textContent = message;
        dialogButtons.innerHTML = `
            <button class="btn btn-secondary">Cancel</button>
            <button class="btn btn-primary">OK</button>
        `;
        
        dialog.classList.add('active');
        
        const buttons = dialogButtons.querySelectorAll('button');
        buttons[0].onclick = () => {
            hideCustomDialog();
            resolve(false);
        };
        buttons[1].onclick = () => {
            hideCustomDialog();
            resolve(true);
        };
    });
}

function hideCustomDialog() {
    document.getElementById('customDialog').classList.remove('active');
}

// Override native alert and confirm
window.alert = customAlert;
window.confirm = customConfirm;

// Wrapper function for game alerts
async function showGameAlert(gameName) {
    trackGameClick(gameName);
    await alert('Game launching soon!');
}

function getUserLevel() {
    return currentUser?.level || 1;
}

function getUserXP() {
    return currentUser?.xp || 0;
}

function getUserXPNeeded() {
    return currentUser?.xpNeeded || 100;
}

async function trackVisit() {
    try {
        const now = Date.now();
        
        const statsData = await window.storage.get('visit_stats', true);
        let stats = { visits: [], lastVisit: null };
        
        if (statsData) {
            stats = JSON.parse(statsData.value);
        }
        
        stats.visits.push(now);
        stats.lastVisit = now;
        
        // Clean up old visits (older than 30 days)
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
        stats.visits = stats.visits.filter(v => v > thirtyDaysAgo);
        
        await window.storage.set('visit_stats', JSON.stringify(stats), true);
    } catch (error) {
        console.error('Failed to track visit:', error);
    }
}

async function trackGameClick(gameName) {
    try {
        const gameStatsData = await window.storage.get('game_stats', true);
        let gameStats = {};
        
        if (gameStatsData) {
            gameStats = JSON.parse(gameStatsData.value);
        }
        
        if (!gameStats[gameName]) {
            gameStats[gameName] = 0;
        }
        
        gameStats[gameName]++;
        
        await window.storage.set('game_stats', JSON.stringify(gameStats), true);
        
        // Track recent games
        if (currentUser) {
            const userEmail = localStorage.getItem('currentUser');
            const recentGamesData = await window.storage.get(`recent_games:${userEmail}`, true);
            let recentGames = [];
            
            if (recentGamesData) {
                recentGames = JSON.parse(recentGamesData.value);
            }
            
            recentGames.unshift({
                name: gameName,
                timestamp: Date.now()
            });
            
            recentGames = recentGames.slice(0, 6);
            
            await window.storage.set(`recent_games:${userEmail}`, JSON.stringify(recentGames), true);
            
            if (document.getElementById('homeSection').classList.contains('active')) {
                await loadRecentGames();
            }
        }
        
        if (document.getElementById('statisticsSection').classList.contains('active')) {
            await loadStatistics();
        }
    } catch (error) {
        console.error('Failed to track game click:', error);
    }
}

async function loadRecentGames() {
    try {
        if (!currentUser) return;
        
        const userEmail = localStorage.getItem('currentUser');
        const recentGamesData = await window.storage.get(`recent_games:${userEmail}`, true);
        let recentGames = [];
        
        if (recentGamesData) {
            recentGames = JSON.parse(recentGamesData.value);
        }
        
        const recentGamesList = document.getElementById('recentGamesList');
        
        if (recentGames.length === 0) {
            recentGamesList.innerHTML = `
                <div class="game-card" style="text-align: center; padding: 40px; grid-column: 1 / -1;">
                    <p style="color: var(--text-secondary);">No games played yet. Start playing to see your recent games here!</p>
                </div>
            `;
        } else {
            const gameIcons = {
                'Aim Trainer': '🎯',
                'Memory Match': '🧩',
                'Type Racer': '⌨️',
                'Math Blast': '🧮',
                'Space Shooter': '🚀',
                'Endless Runner': '🏃'
            };
            
            recentGamesList.innerHTML = recentGames.map(game => {
                const icon = gameIcons[game.name] || '🎮';
                const timeAgo = getTimeAgo(game.timestamp);
                return `
                    <div class="game-card">
                        <div class="game-icon">${icon}</div>
                        <h3>${game.name}</h3>
                        <p style="color: var(--text-secondary); font-size: 14px;">Played ${timeAgo}</p>
                    </div>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('Failed to load recent games:', error);
    }
}

function getTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'just now';
}

async function loadStatistics() {
    try {
        const statsData = await window.storage.get('visit_stats', true);
        let visits = [];
        
        if (statsData) {
            const stats = JSON.parse(statsData.value);
            visits = stats.visits || [];
        }
        
        const now = Date.now();
        const todayStart = new Date().setHours(0, 0, 0, 0);
        const weekAgo = now - (7 * 24 * 60 * 60 * 1000);
        
        const visitsToday = visits.filter(v => v >= todayStart).length;
        const visitsWeek = visits.filter(v => v >= weekAgo).length;
        const visitsAllTime = visits.length;
        
        document.getElementById('visitsToday').textContent = visitsToday;
        document.getElementById('visitsWeek').textContent = visitsWeek;
        document.getElementById('visitsAllTime').textContent = visitsAllTime;
        
        const gameStatsData = await window.storage.get('game_stats', true);
        let gameStats = {};
        
        if (gameStatsData) {
            gameStats = JSON.parse(gameStatsData.value);
        }
        
        let mostPopular = 'No games played yet';
        let maxClicks = 0;
        
        for (const [gameName, clicks] of Object.entries(gameStats)) {
            if (clicks > maxClicks) {
                maxClicks = clicks;
                mostPopular = gameName;
            }
        }
        
        document.getElementById('mostPopularGame').textContent = mostPopular + (maxClicks > 0 ? ` (${maxClicks} clicks)` : '');
        
        const statisticsAdminControls = document.getElementById('statisticsAdminControls');
        const showControls = currentUser && currentUser.isAdmin && !isUserMode;
        if (statisticsAdminControls) {
            statisticsAdminControls.style.display = showControls ? 'flex' : 'none';
        }
    } catch (error) {
        console.error('Failed to load statistics:', error);
    }
}

async function resetStatistics() {
    const confirmed = await confirm('Are you sure you want to reset all statistics? This cannot be undone.');
    if (!confirmed) return;
    
    try {
        await window.storage.set('visit_stats', JSON.stringify({ visits: [], lastVisit: null }), true);
        await window.storage.set('game_stats', JSON.stringify({}), true);
        
        const allUsers = await window.storage.list('user:', true);
        if (allUsers && allUsers.keys) {
            for (const key of allUsers.keys) {
                const userData = await window.storage.get(key, true);
                if (userData) {
                    const user = JSON.parse(userData.value);
                    await window.storage.set(`recent_games:${user.email}`, JSON.stringify([]), true);
                }
            }
        }
        
        await alert('Statistics have been reset successfully.');
        
        if (document.getElementById('statisticsSection').classList.contains('active')) {
            await loadStatistics();
        }
        if (document.getElementById('homeSection').classList.contains('active')) {
            await loadRecentGames();
        }
    } catch (error) {
        console.error('Failed to reset statistics:', error);
        await alert('Failed to reset statistics.');
    }
}

async function loadAnnouncements() {
    try {
        const announcementsData = await window.storage.get('announcements', true);
        let announcements = [];
        
        if (announcementsData) {
            announcements = JSON.parse(announcementsData.value);
        } else {
            announcements = [{
                id: 'default',
                title: 'Welcome to GameZone II!',
                content: 'Welcome to the new and improved GameZone II! We\'re excited to have you here. Check out the games, climb the leaderboard, and join the community chat. More features coming soon!',
                author: 'Admin',
                timestamp: Date.now()
            }];
        }
        
        const announcementsList = document.getElementById('announcementsList');
        const showControls = currentUser && currentUser.isAdmin && !isUserMode;
        
        announcementsList.innerHTML = announcements.map(announcement => {
            const timeAgo = getTimeAgo(announcement.timestamp);
            return `
                <div class="game-card" data-announcement-id="${announcement.id}" style="margin-bottom: 20px;">
                    <h3>${announcement.title}</h3>
                    <p><strong>Posted by ${announcement.author}</strong> • ${timeAgo}</p>
                    <p>${announcement.content}</p>
                    ${showControls ? `
                        <div class="announcement-admin-controls" style="display: flex; margin-top: 15px; gap: 10px;">
                            <button class="btn btn-secondary" onclick="editAnnouncement('${announcement.id}')" style="font-size: 12px; padding: 5px 10px;">Edit</button>
                            <button class="btn btn-secondary" onclick="deleteAnnouncement('${announcement.id}')" style="font-size: 12px; padding: 5px 10px;">Delete</button>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
        
        const adminControls = document.getElementById('announcementsAdminControls');
        if (adminControls) {
            adminControls.style.display = showControls ? 'flex' : 'none';
        }
    } catch (error) {
        console.error('Failed to load announcements:', error);
    }
}

function showCreateAnnouncementModal() {
    document.getElementById('announcementModalTitle').textContent = 'Create Announcement';
    document.getElementById('announcementId').value = '';
    document.getElementById('announcementTitle').value = '';
    document.getElementById('announcementContent').value = '';
    showModal('announcementModal');
}

async function editAnnouncement(id) {
    try {
        const announcementsData = await window.storage.get('announcements', true);
        let announcements = [];
        
        if (announcementsData) {
            announcements = JSON.parse(announcementsData.value);
        }
        
        const announcement = announcements.find(a => a.id === id);
        if (!announcement) {
            await alert('Announcement not found.');
            return;
        }
        
        document.getElementById('announcementModalTitle').textContent = 'Edit Announcement';
        document.getElementById('announcementId').value = id;
        document.getElementById('announcementTitle').value = announcement.title;
        document.getElementById('announcementContent').value = announcement.content;
        showModal('announcementModal');
    } catch (error) {
        console.error('Failed to edit announcement:', error);
    }
}

async function saveAnnouncement(e) {
    e.preventDefault();
    try {
        const id = document.getElementById('announcementId').value;
        const title = document.getElementById('announcementTitle').value.trim();
        const content = document.getElementById('announcementContent').value.trim();
        
        if (!title || !content) {
            await alert('Please fill in all fields.');
            return;
        }
        
        const announcementsData = await window.storage.get('announcements', true);
        let announcements = [];
        
        if (announcementsData) {
            announcements = JSON.parse(announcementsData.value);
        }
        
        if (id) {
            const index = announcements.findIndex(a => a.id === id);
            if (index !== -1) {
                announcements[index].title = title;
                announcements[index].content = content;
                announcements[index].timestamp = Date.now();
            }
        } else {
            const newId = 'announcement_' + Date.now();
            announcements.unshift({
                id: newId,
                title,
                content,
                author: currentUser.username,
                timestamp: Date.now()
            });
        }
        
        await window.storage.set('announcements', JSON.stringify(announcements), true);
        hideModal('announcementModal');
        await loadAnnouncements();
    } catch (error) {
        console.error('Failed to save announcement:', error);
        await alert('Failed to save announcement.');
    }
}

async function deleteAnnouncement(id) {
    if (id === 'default') {
        await alert('Cannot delete the default announcement.');
        return;
    }
    
    const confirmed = await confirm('Are you sure you want to delete this announcement?');
    if (!confirmed) return;
    
    try {
        const announcementsData = await window.storage.get('announcements', true);
        let announcements = [];
        
        if (announcementsData) {
            announcements = JSON.parse(announcementsData.value);
        }
        
        announcements = announcements.filter(a => a.id !== id);
        await window.storage.set('announcements', JSON.stringify(announcements), true);
        await loadAnnouncements();
    } catch (error) {
        console.error('Failed to delete announcement:', error);
        await alert('Failed to delete announcement.');
    }
}

async function toggleUserMode() {
    isUserMode = !isUserMode;
    const btn = document.getElementById('userModeBtn');
    if (isUserMode) {
        btn.textContent = 'Admin Mode';
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-primary');
    } else {
        btn.textContent = 'User Mode';
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
    }
    updateUI();
}

async function toggleShutdown() {
    if (isUserMode) {
        await alert('Shutdown is unavailable in User Mode. Switch to Admin Mode first.');
        return;
    }

    isShutdown = !isShutdown;
    const btn = document.getElementById('shutdownBtn');
    
    if (isShutdown) {
        btn.textContent = 'Enable Site';
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-primary');
        await window.storage.set('site_shutdown', 'true', true);
        await loadTopGamesForMaintenance();
    } else {
        btn.textContent = 'Temp Shutdown';
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
        await window.storage.set('site_shutdown', 'false', true);
    }
    
    checkShutdown();
}

async function checkShutdown() {
    try {
        const shutdownData = await window.storage.get('site_shutdown', true);
        const isShutdownActive = shutdownData && shutdownData.value === 'true';
        isShutdown = isShutdownActive;
        
        const shutdownBtn = document.getElementById('shutdownBtn');
        if (shutdownBtn) {
            if (isShutdown) {
                shutdownBtn.textContent = 'Enable Site';
                shutdownBtn.classList.remove('btn-secondary');
                shutdownBtn.classList.add('btn-primary');
            } else {
                shutdownBtn.textContent = 'Temp Shutdown';
                shutdownBtn.classList.remove('btn-primary');
                shutdownBtn.classList.add('btn-secondary');
            }
        }
        
        if (currentUser && currentUser.isAdmin && !isUserMode) {
            document.getElementById('maintenancePage').style.display = 'none';
            return;
        }
        
        if (isShutdownActive) {
            document.querySelectorAll('.section').forEach(s => {
                if (s.id !== 'maintenancePage') {
                    s.style.display = 'none';
                }
            });
            document.getElementById('maintenancePage').style.display = 'block';
            document.getElementById('maintenancePage').classList.add('active');
            if (document.getElementById('navTabs')) {
                document.getElementById('navTabs').innerHTML = '';
            }
            await loadTopGamesForMaintenance();
        } else {
            document.getElementById('maintenancePage').style.display = 'none';
            document.getElementById('maintenancePage').classList.remove('active');
        }
    } catch (error) {
        console.error('Failed to check shutdown:', error);
    }
}

async function loadTopGamesForMaintenance() {
    try {
        const gameStatsData = await window.storage.get('game_stats', true);
        let gameStats = {};
        
        if (gameStatsData) {
            gameStats = JSON.parse(gameStatsData.value);
        }
        
        const sortedGames = Object.entries(gameStats)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([name]) => name);
        
        const gameIcons = {
            'Aim Trainer': '🎯',
            'Memory Match': '🧩',
            'Type Racer': '⌨️',
            'Math Blast': '🧮',
            'Space Shooter': '🚀',
            'Endless Runner': '🏃'
        };
        
        const topGamesDiv = document.getElementById('topGamesMaintenance');
        
        if (sortedGames.length === 0) {
            topGamesDiv.innerHTML = `
                <div class="game-card" style="grid-column: 1 / -1;">
                    <p style="color: var(--text-secondary);">No games have been played yet.</p>
                </div>
            `;
        } else {
            topGamesDiv.innerHTML = sortedGames.map(gameName => {
                const icon = gameIcons[gameName] || '🎮';
                return `
                    <div class="game-card">
                        <div class="game-icon">${icon}</div>
                        <h3>${gameName}</h3>
                        <button class="btn btn-primary" onclick="window.location.href='#games'">Play Now</button>
                    </div>
                `;
            }).join('');
        }
    } catch (error) {
        console.error('Failed to load top games:', error);
    }
}

function updateUI() {
    const userInfo = document.getElementById('userInfo');
    const navTabs = document.getElementById('navTabs');

    if (currentUser) {
        const level = getUserLevel();
        const xp = getUserXP();
        const xpNeeded = getUserXPNeeded();

        userInfo.innerHTML = `
            <div class="user-badge">
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <span style="font-weight: 700;">${currentUser.username}</span>
                    <div style="display: flex; gap: 10px; align-items: center; font-size: 12px; color: var(--text-secondary);">
                        <span>Level ${level}</span>
                        <span>•</span>
                        <span>XP: ${xp}/${xpNeeded}</span>
                    </div>
                </div>
                ${currentUser.isAdmin && !isUserMode ? '<span class="admin-badge">ADMIN</span>' : ''}
            </div>
            <button class="btn btn-secondary" onclick="logout()">Logout</button>
        `;

        let tabs = `
            <div class="nav-tab active" onclick="switchTab('home')">Home</div>
            <div class="nav-tab" onclick="switchTab('games')">Games</div>
            <div class="nav-tab" onclick="switchTab('leaderboard')">Leaderboard</div>
            <div class="nav-tab" onclick="switchTab('schoolPortal')">School Portal</div>
            <div class="nav-tab" onclick="switchTab('chat')">Chat</div>
            <div class="nav-tab" onclick="switchTab('statistics')">Statistics</div>
        `;

        if (currentUser.isAdmin) {
            tabs += `<div class="nav-tab" onclick="switchTab('admin')">Admin</div>`;
        }

        navTabs.innerHTML = tabs;
        switchTab('home');
    } else {
        userInfo.innerHTML = `
            <button class="btn btn-primary" onclick="showModal('loginModal')">Login</button>
            <button class="btn btn-secondary" onclick="showModal('registerModal')">Register</button>
        `;
        navTabs.innerHTML = '';
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    }
}

function switchTab(tab) {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    if (event && event.target) {
        event.target.classList.add('active');
    }

    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(tab + 'Section').classList.add('active');
    
    if (tab === 'home') {
        loadRecentGames();
        loadAnnouncements();
    }
    
    if (tab === 'statistics') {
        loadStatistics();
    }
}

function switchChatRoom(room) {
    currentChatRoom = room;
    document.querySelectorAll('.chat-room-item').forEach(item => item.classList.remove('active'));
    event.target.classList.add('active');
    
    document.getElementById('messagesList').innerHTML = `
        <div class="message">
            <div class="message-author">System</div>
            <div>Welcome to #${room}!</div>
        </div>
    `;
}

async function sendMessage() {
    if (!currentUser) {
        await alert('Please login to chat!');
        return;
    }

    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (!message) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.innerHTML = `
        <div class="message-author">${currentUser.username}</div>
        <div>${message}</div>
    `;
    
    document.getElementById('messagesList').appendChild(messageDiv);
    input.value = '';
    
    document.getElementById('messagesList').scrollTop = document.getElementById('messagesList').scrollHeight;
}

// Initialize on load
checkAutoLogin();