// API Configuration
const API_BASE_URL = 'http://13.206.205.53:5000'; // Changed to 127.0.0.1 for better compatibility
let chatHistory = [];

// Safe localStorage getter
function safeGetStorage(key, defaultValue = null) {
    try {
        return localStorage.getItem(key) || defaultValue;
    } catch (e) {
        console.warn(`Storage access blocked for ${key}:`, e.message);
        return defaultValue;
    }
}

// Safe localStorage setter
function safeSetStorage(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (e) {
        console.warn(`Storage write blocked for ${key}:`, e.message);
        return false;
    }
}

let currentSessionId = safeGetStorage('chatSessionId') || generateSessionId();

// Generate unique session ID
function generateSessionId() {
    const id = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    safeSetStorage('chatSessionId', id);
    return id;
}

// Safe markdown parser function with proper error handling
function parseMarkdown(text) {
    if (!text) return '';
    
    // Use marked if available
    if (typeof marked !== 'undefined' && marked.parse) {
        try {
            return marked.parse(text);
        } catch (e) {
            console.warn('Markdown parse error:', e);
        }
    }
    
    // Fallback HTML escape and basic formatting
    return escapeHtml(text)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>')
        .replace(/### (.+)/g, '<h3>$1</h3>')
        .replace(/## (.+)/g, '<h2>$1</h2>')
        .replace(/# (.+)/g, '<h1>$1</h1>');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    setupEventListeners();
    loadChatHistory();
    checkBackendHealth();
});

// Check backend health
async function checkBackendHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        if (response.ok) {
            console.log('✅ Backend connected');
            showToast('Backend connected!', 'success');
        } else {
            console.warn('⚠️ Backend issue');
            showToast('⚠️ Backend connection issue', 'error');
        }
    } catch (error) {
        console.error('❌ Backend not reachable');
        showToast('❌ Cannot connect to backend. Make sure server is running on port 5000', 'error');
    }
}

// Setup Event Listeners
function setupEventListeners() {
    const sendBtn = document.getElementById('sendBtn');
    const userInput = document.getElementById('userInput');
    const newChatBtn = document.getElementById('newChatBtn');
    const themeToggle = document.getElementById('themeToggle');
    const sidebarToggle = document.getElementById('sidebarToggle');
    
    if (sendBtn) sendBtn.addEventListener('click', () => sendMessage());
    if (userInput) {
        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        // Auto-resize textarea
        userInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 150) + 'px';
        });
    }
    if (newChatBtn) newChatBtn.addEventListener('click', newChat);
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);
    
    // Example chips
    document.querySelectorAll('.example-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const input = document.getElementById('userInput');
            if (input) input.value = chip.textContent;
            sendMessage();
        });
    });
}

// Send Message to Backend
async function sendMessage() {
    const userInput = document.getElementById('userInput');
    const prompt = userInput.value.trim();
    
    if (!prompt) {
        showToast('Please enter a car description', 'error');
        return;
    }
    
    // Add user message to chat
    addMessage('user', prompt);
    userInput.value = '';
    userInput.style.height = 'auto';
    
    // Show loading overlay
    showLoading();
    
    try {
        // Call backend API - using /api/chat endpoint (not /api/design)
        const response = await fetch(`${API_BASE_URL}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                message: prompt,
                session_id: currentSessionId 
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            
            // Check for 503 Service Unavailable
            if (response.status === 503) {
                const errorMsg = 'AI service is experiencing high demand. Please try again in a moment.';
                showToast('⏳ Service busy - retrying in 5 seconds...', 'warning');
                addMessage('assistant', `⏳ **Service Temporarily Busy**\n\n${errorMsg}\n\nThe system will auto-retry. You can also click "Generate" again after a moment.`);
                
                // Auto-retry after 5 seconds
                setTimeout(() => {
                    userInput.value = prompt;
                    sendMessage();
                }, 5000);
                return;
            }
            
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            // Add assistant response with images
            addAssistantMessage(result.message, result.images, result.mode);
            
            // Save to history (without large image data)
            saveToHistory(prompt, result.message, result.mode);
            
            showToast(`✅ ${result.mode || 'Design'} generated successfully!`, 'success');
        } else {
            // Check if error message indicates service unavailability
            if (result.error && (result.error.includes('503') || result.error.includes('UNAVAILABLE') || result.error.includes('high demand'))) {
                showToast('⏳ Service busy - retrying in 5 seconds...', 'warning');
                addMessage('assistant', `⏳ **Service Temporarily Busy**\n\nThe AI service is currently experiencing high demand. The system will automatically retry shortly.\n\nYou can also try again manually if it continues.`);
                
                // Auto-retry after 5 seconds
                setTimeout(() => {
                    userInput.value = prompt;
                    sendMessage();
                }, 5000);
                return;
            }
            throw new Error(result.error || 'Generation failed');
        }
        
    } catch (error) {
        console.error('Error:', error);
        showToast(`Failed: ${error.message}`, 'error');
        addMessage('assistant', `❌ **Error:** ${error.message}\n\n**Troubleshooting:**\n- Make sure backend is running on port 5000\n- Check if API key is valid\n- Verify network connection`);
    } finally {
        hideLoading();
    }
}

// Add regular message
function addMessage(role, content) {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    messageDiv.style.animation = 'slideIn 0.3s ease';
    
    const avatar = role === 'user' ? '👤' : '🤖';
    
    let messageHTML = `
        <div class="avatar">${avatar}</div>
        <div class="message-content">
            <div class="${role === 'assistant' ? 'assistant-response' : 'user-message'}">
                ${parseMarkdown(content)}
            </div>
        </div>
    `;
    
    messageDiv.innerHTML = messageHTML;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Add assistant message with images
function addAssistantMessage(content, images, mode) {
    const messagesContainer = document.getElementById('messagesContainer');
    if (!messagesContainer) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    messageDiv.style.animation = 'slideIn 0.3s ease';
    
    let imagesHTML = '';
    
    // Display images if they exist
    if (images && Object.keys(images).length > 0) {
        imagesHTML = '<div class="multi-view-gallery"><h3>📸 Car Design Gallery</h3><div class="views-grid">';
        
        const viewNames = {
            'front': 'Front View',
            'side': 'Side View', 
            'rear': 'Rear View',
            'interior': 'Interior View',
            'top': 'Top View',
            'bottom': 'Bottom View',
            'left': 'Left View',
            'right': 'Right View'
        };
        
        for (const [view, imageData] of Object.entries(images)) {
            if (imageData && imageData !== 'null' && imageData !== 'undefined') {
                imagesHTML += `
                    <div class="view-card">
                        <img src="${imageData}" alt="${view} view" 
                             onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'512\\' height=\\'512\\'%3E%3Crect width=\\'512\\' height=\\'512\\' fill=\\'%23444\\'/%3E%3Ctext x=\\'50%25\\' y=\\'50%25\\' text-anchor=\\'middle\\' fill=\\'white\\'%3E${view} view%3C/text%3E%3C/svg%3E'"
                             style="width:100%; height:200px; object-fit:cover; border-radius:8px;">
                        <div class="view-label">${viewNames[view] || view.toUpperCase()}</div>
                        <div class="view-actions">
                            <button class="download-btn" onclick="downloadImage('${imageData}', '${view}_view')">💾 Download</button>
                        </div>
                    </div>
                `;
            }
        }
        
        imagesHTML += '</div></div>';
    }
    
    // Mode badge
    const modeBadges = {
        'generation': '<span class="mode-badge generation">🎨 Generation Mode</span>',
        'discussion': '<span class="mode-badge discussion">💬 Discussion Mode</span>',
        'improvement': '<span class="mode-badge improvement">🔧 Improvement Mode</span>',
        'analysis': '<span class="mode-badge analysis">📊 Analysis Mode</span>'
    };
    
    const modeBadge = modeBadges[mode] || modeBadges['generation'];
    
    const messageHTML = `
        <div class="avatar">🤖</div>
        <div class="message-content">
            ${modeBadge}
            <div class="assistant-response">
                ${parseMarkdown(content)}
            </div>
            ${imagesHTML}
            <div class="action-buttons">
                <button class="action-btn" onclick="copyResponse()">📋 Copy Response</button>
                <button class="action-btn" onclick="exportChat()">💾 Export</button>
            </div>
        </div>
    `;
    
    messageDiv.innerHTML = messageHTML;
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Save to Chat History
function saveToHistory(prompt, response, mode) {
    const historyItem = {
        id: Date.now(),
        prompt: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : ''),
        fullPrompt: prompt,
        response: response,
        mode: mode,
        timestamp: new Date().toLocaleString()
    };
    
    chatHistory.unshift(historyItem);
    if (chatHistory.length > 15) chatHistory.pop();
    
    try {
        safeSetStorage('carDesignHistory', JSON.stringify(chatHistory));
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            chatHistory = chatHistory.slice(0, 8);
            safeSetStorage('carDesignHistory', JSON.stringify(chatHistory));
            showToast('Storage limit reached. Keeping only recent designs.', 'info');
        }
    }
    
    updateHistoryUI();
}

// Load Chat History
function loadChatHistory() {
    const saved = safeGetStorage('carDesignHistory');
    if (saved) {
        try {
            chatHistory = JSON.parse(saved);
            updateHistoryUI();
        } catch (e) {
            console.error('Failed to parse history:', e);
            chatHistory = [];
        }
    }
}

// Update History UI
function updateHistoryUI() {
    const historyList = document.getElementById('historyList');
    if (!historyList) return;
    
    if (chatHistory.length === 0) {
        historyList.innerHTML = '<div class="history-placeholder">No designs yet. Start creating!</div>';
        return;
    }
    
    historyList.innerHTML = chatHistory.map(item => `
        <div class="history-item" onclick="loadHistoryDesign(${item.id})">
            <div class="prompt">${escapeHtml(item.prompt)}</div>
            <div class="mode-tag">${item.mode || 'design'}</div>
            <div class="date">${item.timestamp}</div>
        </div>
    `).join('');
}

// Load History Design
function loadHistoryDesign(id) {
    const design = chatHistory.find(item => item.id === id);
    if (design) {
        // Clear current chat
        const container = document.getElementById('messagesContainer');
        if (container) container.innerHTML = '';
        
        // Add user message
        addMessage('user', design.fullPrompt);
        
        // Add assistant response
        addMessage('assistant', design.response);
        
        // Close sidebar on mobile
        if (window.innerWidth <= 768) {
            toggleSidebar();
        }
        
        showToast('Loaded previous design', 'success');
    }
}

// New Chat
function newChat() {
    // Generate new session ID
    currentSessionId = generateSessionId();
    
    const messagesContainer = document.getElementById('messagesContainer');
    if (messagesContainer) {
        messagesContainer.innerHTML = `
            <div class="message assistant">
                <div class="avatar">🤖</div>
                <div class="message-content">
                    <h3>🚗 Welcome to Futuristic Car Designer!</h3>
                    <p>I'm your AI automotive engineer with dual-mode intelligence:</p>
                    <ul>
                        <li>🎨 <strong>Generation Mode</strong> - Create complete car designs with 4 images</li>
                        <li>💬 <strong>Discussion Mode</strong> - Analyze, improve, and refine features</li>
                        <li>🧠 <strong>Smart Context</strong> - Remembers your car across conversations</li>
                    </ul>
                    <p><strong>✨ Try these examples:</strong></p>
                    <div class="example-chips">
                        <button class="example-chip">Design a futuristic electric hypercar with 2000hp</button>
                        <button class="example-chip">Create a luxury SUV for families with 500km range</button>
                        <button class="example-chip">Build a lightweight track-focused sports car under 1000kg</button>
                    </div>
                </div>
            </div>
        `;
        
        // Reattach example chip events
        document.querySelectorAll('.example-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const input = document.getElementById('userInput');
                if (input) input.value = chip.textContent;
                sendMessage();
            });
        });
    }
    
    showToast('New conversation started!', 'success');
}

// Loading UI
function showLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'flex';
    
    const steps = ['step1', 'step2', 'step3', 'step4'];
    steps.forEach((step, index) => {
        setTimeout(() => {
            const stepElement = document.getElementById(step);
            if (stepElement) {
                document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
                stepElement.classList.add('active');
            }
        }, index * 1800);
    });
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';
}

function completeLoading() {
    const steps = ['step1', 'step2', 'step3', 'step4'];
    steps.forEach(step => {
        const el = document.getElementById(step);
        if (el) el.classList.remove('active');
    });
}

// Theme Functions
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    safeSetStorage('theme', newTheme);
    
    const toggleBtn = document.getElementById('themeToggle');
    if (toggleBtn) toggleBtn.textContent = newTheme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode';
}

function loadTheme() {
    const savedTheme = safeGetStorage('theme', 'dark');
    document.documentElement.setAttribute('data-theme', savedTheme);
    const toggleBtn = document.getElementById('themeToggle');
    if (toggleBtn) toggleBtn.textContent = savedTheme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode';
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('active');
}

// Toast Notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.style.display = 'block';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

// Download Functions
function downloadImage(imageUrl, filename) {
    if (!imageUrl || imageUrl === 'null') {
        showToast('No image to download', 'error');
        return;
    }
    
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `${filename}_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('✅ Image downloaded!', 'success');
}

function copyResponse() {
    const responseDiv = document.querySelector('.assistant-response:last-child');
    if (responseDiv) {
        const text = responseDiv.innerText;
        navigator.clipboard.writeText(text);
        showToast('📋 Response copied!', 'success');
    }
}

function exportChat() {
    const messages = document.querySelectorAll('.message');
    let chatText = '';
    messages.forEach(msg => {
        const role = msg.classList.contains('user') ? 'User' : 'AI';
        const content = msg.querySelector('.message-content')?.innerText || '';
        chatText += `${role}: ${content}\n\n`;
    });
    
    const blob = new Blob([chatText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_export_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('💾 Chat exported!', 'success');
}

// Close sidebar when clicking outside (mobile)
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        const toggleBtn = document.getElementById('sidebarToggle');
        
        if (sidebar && sidebar.classList.contains('active') && 
            !sidebar.contains(e.target) && 
            e.target !== toggleBtn) {
            sidebar.classList.remove('active');
        }
    }
});

// Make functions global for onclick handlers
window.downloadImage = downloadImage;
window.copyResponse = copyResponse;
window.exportChat = exportChat;
window.loadHistoryDesign = loadHistoryDesign;
window.copyDescription = copyResponse;
window.exportDesign = exportChat;
