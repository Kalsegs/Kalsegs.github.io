// Monitoring Dashboard Logic
const state = {
    vpsUrl: localStorage.getItem('vps_url') || '',
    apiKey: localStorage.getItem('api_key') || '',
    refreshInterval: 1000,
    timer: null,
    isFirstLoad: true
};

// DOM Elements
const elements = {
    totalGuilds: document.getElementById('total-guilds'),
    totalPlayers: document.getElementById('total-players'),
    totalUsers: document.getElementById('total-users'),
    totalMemory: document.getElementById('total-memory'),
    shardCount: document.getElementById('shard-count'),
    shardContainer: document.getElementById('shard-container'),
    processUptime: document.getElementById('process-uptime'),
    lastSync: document.getElementById('last-sync'),
    statusDot: document.getElementById('global-status-dot'),
    
    // Config Modal
    configModal: document.getElementById('config-modal'),
    openConfig: document.getElementById('open-config'),
    closeConfig: document.getElementById('close-config'),
    saveConfig: document.getElementById('save-config'),
    vpsUrlInput: document.getElementById('vps-url'),
    apiKeyInput: document.getElementById('api-key'),

    // Action Buttons
    btnRestart: document.getElementById('btn-restart'),
    btnLogs: document.getElementById('btn-logs'),

    // Logs Modal
    logsModal: document.getElementById('logs-modal'),
    logsContent: document.getElementById('logs-content'),
    closeLogs: document.getElementById('close-logs'),
    refreshLogs: document.getElementById('refresh-logs')
};

// Initialize
function init() {
    elements.vpsUrlInput.value = state.vpsUrl;
    elements.apiKeyInput.value = state.apiKey;

    if (!state.vpsUrl || !state.apiKey) {
        showConfig();
    } else {
        startPolling();
    }

    setupEventListeners();
}

function setupEventListeners() {
    elements.openConfig.addEventListener('click', showConfig);
    elements.closeConfig.addEventListener('click', hideConfig);
    elements.saveConfig.addEventListener('click', saveConfig);

    // Bot Actions
    elements.btnRestart.addEventListener('click', restartBot);
    elements.btnLogs.addEventListener('click', showLogs);
    elements.closeLogs.addEventListener('click', hideLogs);
    elements.refreshLogs.addEventListener('click', fetchLogs);
}

async function restartBot() {
    if (!confirm('Are you sure you want to restart the bot? It will be offline for a few seconds.')) return;

    try {
        const response = await fetch(`${state.vpsUrl}/api/action/restart?key=${state.apiKey}`, {
            method: 'POST'
        });
        const data = await response.json();
        alert(data.message || 'Restart command sent successfully');
    } catch (error) {
        alert('Failed to send restart command');
    }
}

function showLogs() {
    elements.logsModal.classList.add('active');
    fetchLogs();
}

function hideLogs() {
    elements.logsModal.classList.remove('active');
}

async function fetchLogs() {
    elements.logsContent.innerHTML = '<pre>Loading logs...</pre>';
    try {
        const response = await fetch(`${state.vpsUrl}/api/action/logs?key=${state.apiKey}`);
        const data = await response.json();
        
        if (data.logs) {
            elements.logsContent.innerHTML = `<pre>${data.logs}</pre>`;
            // Scroll to bottom
            elements.logsContent.scrollTop = elements.logsContent.scrollHeight;
        } else {
            elements.logsContent.innerHTML = '<pre>No logs found.</pre>';
        }
    } catch (error) {
        elements.logsContent.innerHTML = '<pre>Failed to fetch logs.</pre>';
    }
}

function showConfig() {
    elements.configModal.classList.add('active');
}

function hideConfig() {
    elements.configModal.classList.remove('active');
}

function saveConfig() {
    let url = elements.vpsUrlInput.value.trim().replace(/\/$/, '');
    const key = elements.apiKeyInput.value.trim();

    if (!url || !key) {
        alert('Please fill in both fields');
        return;
    }

    // Auto-wrap raw IPv6 in brackets if port is detected
    // Example: http://2407:6ac0:3:9d:abcd::1d6:3000 -> http://[2407:6ac0:3:9d:abcd::1d6]:3000
    if (url.includes('://') && url.split(':').length > 4 && !url.includes('[')) {
        const parts = url.split('://');
        const protocol = parts[0];
        const rest = parts[1];
        
        // Find the last colon which marks the port
        const lastColonIndex = rest.lastIndexOf(':');
        if (lastColonIndex !== -1) {
            const host = rest.substring(0, lastColonIndex);
            const port = rest.substring(lastColonIndex + 1);
            url = `${protocol}://[${host}]:${port}`;
        }
    }

    state.vpsUrl = url;
    state.apiKey = key;
    localStorage.setItem('vps_url', url);
    localStorage.setItem('api_key', key);

    hideConfig();
    startPolling();
}

async function fetchStats() {
    try {
        const response = await fetch(`${state.vpsUrl}/api/stats?key=${state.apiKey}`);
        
        if (!response.ok) throw new Error('Unauthorized or Server Error');
        
        const data = await response.json();
        updateUI(data);
        setStatus(true);
    } catch (error) {
        console.error('Fetch Error:', error);
        setStatus(false);
    }
}

function updateUI(data) {
    const { totals, shards } = data;

    // Total Stats
    animateValue(elements.totalGuilds, totals.guilds);
    animateValue(elements.totalPlayers, totals.players);
    animateValue(elements.totalUsers, totals.users);
    elements.totalMemory.textContent = `${Math.round(totals.memory)} MB`;
    
    elements.shardCount.textContent = `${totals.shardCount} Shard${totals.shardCount > 1 ? 's' : ''}`;
    elements.processUptime.textContent = formatUptime(totals.processUptime);
    elements.lastSync.textContent = new Date().toLocaleTimeString();

    // Shard Grid
    renderShards(shards);
}

function renderShards(shards) {
    elements.shardContainer.innerHTML = '';
    
    shards.forEach(shard => {
        const card = document.createElement('div');
        card.className = 'shard-card glass';
        
        const statusClass = shard.ready ? 'online' : 'offline';
        const statusText = shard.ready ? 'Ready' : 'Connecting';

        card.innerHTML = `
            <div class="shard-header">
                <div class="shard-id">#${shard.id}</div>
                <div class="shard-badge ${statusClass}">${statusText}</div>
            </div>
            <div class="shard-metrics">
                <div class="shard-metric-item">
                    <span>Guilds</span>
                    <span class="shard-metric-value">${shard.guilds}</span>
                </div>
                <div class="shard-metric-item">
                    <span>Players</span>
                    <span class="shard-metric-value">${shard.players}</span>
                </div>
                <div class="shard-metric-item">
                    <span>Ping</span>
                    <span class="shard-metric-value">${shard.ping}ms</span>
                </div>
                <div class="shard-metric-item">
                    <span>RAM</span>
                    <span class="shard-metric-value">${Math.round(shard.memory)}MB</span>
                </div>
            </div>
        `;
        elements.shardContainer.appendChild(card);
    });
}

function setStatus(online) {
    if (online) {
        elements.statusDot.classList.add('online');
    } else {
        elements.statusDot.classList.remove('online');
    }
}

function animateValue(obj, value) {
    const current = parseInt(obj.textContent) || 0;
    if (current === value) return;
    
    obj.textContent = value;
}

function formatUptime(seconds) {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    
    return parts.join(' ');
}

function startPolling() {
    if (state.timer) clearInterval(state.timer);
    
    fetchStats();
    state.timer = setInterval(fetchStats, state.refreshInterval);
}

// Start app
init();
