// IFHE Campus Assistant Portal - Main JavaScript Application

// Global state management
const AppState = {
    currentSection: 'home',
    isLoading: false,
    adminToken: null,
    chatHistory: [],
    events: [],
    notices: [],
    filteredNotices: []
};

// API Base URL
const API_BASE = '/api';

// Utility Functions
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="flex items-center justify-between">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white hover:text-gray-200">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;
    
    document.getElementById('toast-container').appendChild(toast);
    
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, duration);
}

function showLoading() {
    AppState.isLoading = true;
    document.getElementById('loading-overlay').classList.remove('hidden');
}

function hideLoading() {
    AppState.isLoading = false;
    document.getElementById('loading-overlay').classList.add('hidden');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatRelativeDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

// Navigation Functions
function showSection(sectionId) {
    // Update state
    AppState.currentSection = sectionId;
    
    // Hide all sections
    document.querySelectorAll('.section-page').forEach(section => {
        section.classList.add('hidden');
    });
    
    // Show target section
    document.getElementById(sectionId).classList.remove('hidden');
    
    // Update navigation active states
    document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    document.querySelectorAll(`[href="#${sectionId}"]`).forEach(link => {
        link.classList.add('active');
    });
    
    // Load section-specific data
    switch (sectionId) {
        case 'events':
            loadEvents();
            break;
        case 'notices':
            loadNotices();
            break;
        case 'chat':
            // Focus on chat input
            setTimeout(() => {
                document.getElementById('chat-input').focus();
            }, 100);
            break;
    }
    
    // Close mobile menu
    document.getElementById('mobile-menu').classList.add('hidden');
}

// Mobile menu toggle
function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    menu.classList.toggle('hidden');
}

// Chat Functions
async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const emailInput = document.getElementById('user-email');
    const nameInput = document.getElementById('user-name');
    const sendButton = document.getElementById('chat-send');
    
    const message = input.value.trim();
    if (!message) return;
    
    const userEmail = emailInput.value.trim();
    const userName = nameInput.value.trim();
    
    // Validate email if provided
    if (userEmail && !validateEmail(userEmail)) {
        showToast('Please enter a valid email address', 'error');
        return;
    }
    
    // Add user message to chat
    addChatMessage(message, 'user');
    
    // Clear input and disable send button
    input.value = '';
    sendButton.classList.add('loading-button');
    sendButton.disabled = true;
    
    try {
        const response = await axios.post(`${API_BASE}/chat`, {
            question: message,
            user_email: userEmail || undefined,
            user_name: userName || undefined
        });
        
        if (response.data.html) {
            addChatMessage(response.data.html, 'bot', true);
            
            // Store chat history
            AppState.chatHistory.push({
                question: message,
                answer: response.data.html,
                model: response.data.model_used,
                timestamp: new Date().toISOString()
            });
        } else {
            addChatMessage('Sorry, I encountered an error processing your question. Please try again.', 'bot');
        }
    } catch (error) {
        console.error('Chat error:', error);
        let errorMessage = 'I apologize, but I\'m having trouble connecting right now. Please try again in a moment.';
        
        if (error.response && error.response.data && error.response.data.error) {
            errorMessage = error.response.data.error;
        }
        
        addChatMessage(errorMessage, 'bot');
    } finally {
        sendButton.classList.remove('loading-button');
        sendButton.disabled = false;
        input.focus();
    }
}

function addChatMessage(content, sender, isHtml = false) {
    const messagesContainer = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message flex items-start space-x-3';
    
    if (sender === 'user') {
        messageDiv.innerHTML = `
            <div class="flex-1 flex justify-end">
                <div class="user-message">
                    ${escapeHtml(content)}
                </div>
            </div>
            <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <i class="fas fa-user text-white text-sm"></i>
            </div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <i class="fas fa-robot text-white text-sm"></i>
            </div>
            <div class="flex-1">
                <div class="bot-message">
                    ${isHtml ? content : escapeHtml(content)}
                </div>
            </div>
        `;
    }
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Events Functions
async function loadEvents() {
    const container = document.getElementById('events-container');
    container.innerHTML = `
        <div class="text-center py-12">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p class="text-gray-500">Loading events...</p>
        </div>
    `;
    
    try {
        const response = await axios.get(`${API_BASE}/events`);
        AppState.events = response.data.events || [];
        renderEvents(AppState.events);
    } catch (error) {
        console.error('Load events error:', error);
        container.innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
                <p class="text-gray-500">Failed to load events. Please try again later.</p>
                <button onclick="loadEvents()" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <i class="fas fa-retry mr-2"></i>Retry
                </button>
            </div>
        `;
    }
}

function renderEvents(events) {
    const container = document.getElementById('events-container');
    
    if (events.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-calendar-times text-4xl text-gray-400 mb-4"></i>
                <p class="text-gray-500">No upcoming events at the moment.</p>
                <p class="text-gray-400 text-sm">Check back later for exciting new events!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = events.map(event => `
        <div class="event-card bg-white rounded-lg shadow-md overflow-hidden">
            <div class="p-6">
                <div class="flex flex-col md:flex-row md:items-start md:justify-between">
                    <div class="flex-1">
                        <div class="flex items-center mb-2">
                            <div class="event-date text-white px-3 py-1 rounded-full text-sm font-semibold mr-3">
                                ${formatDate(event.date_iso).split(',')[0]}
                            </div>
                            <span class="text-sm text-gray-500">
                                ${formatDate(event.date_iso).split(',')[1]}
                            </span>
                        </div>
                        <h3 class="text-xl font-bold text-gray-900 mb-2">${escapeHtml(event.title)}</h3>
                        <p class="text-gray-600 mb-4">${escapeHtml(event.description)}</p>
                        <div class="flex items-center text-gray-500 text-sm space-x-4">
                            <div class="flex items-center">
                                <i class="fas fa-map-marker-alt mr-2"></i>
                                ${escapeHtml(event.location)}
                            </div>
                            <div class="flex items-center">
                                <i class="fas fa-clock mr-2"></i>
                                ${formatDate(event.date_iso).split(' ').slice(-2).join(' ')}
                            </div>
                        </div>
                    </div>
                    <div class="mt-4 md:mt-0 md:ml-6">
                        <button onclick="showRegistrationForm('${event.id}')" 
                                class="w-full md:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition duration-300">
                            <i class="fas fa-user-plus mr-2"></i>Register Now
                        </button>
                    </div>
                </div>
            </div>
            <div id="registration-form-${event.id}" class="registration-form">
                <!-- Registration form will be inserted here -->
            </div>
        </div>
    `).join('');
}

function showRegistrationForm(eventId) {
    const formContainer = document.getElementById(`registration-form-${eventId}`);
    const event = AppState.events.find(e => e.id === eventId);
    
    if (!event) return;
    
    // Toggle form visibility
    if (formContainer.classList.contains('open')) {
        formContainer.classList.remove('open');
        return;
    }
    
    // Close other forms
    document.querySelectorAll('.registration-form.open').forEach(form => {
        form.classList.remove('open');
    });
    
    formContainer.innerHTML = `
        <div class="border-t border-gray-200 bg-gray-50 p-6">
            <h4 class="text-lg font-semibold mb-4">Register for ${escapeHtml(event.title)}</h4>
            <form onsubmit="submitRegistration(event, '${eventId}')" class="space-y-4">
                <div class="grid md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                        <input type="text" name="name" required 
                               class="form-input w-full px-3 py-2 rounded-lg" 
                               placeholder="Enter your full name">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                        <input type="email" name="email" required 
                               class="form-input w-full px-3 py-2 rounded-lg" 
                               placeholder="your.email@example.com">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                        <input type="tel" name="phone" 
                               class="form-input w-full px-3 py-2 rounded-lg" 
                               placeholder="+91 98765 43210">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Department</label>
                        <select name="department" class="form-input w-full px-3 py-2 rounded-lg">
                            <option value="">Select Department</option>
                            <option value="MBA">MBA</option>
                            <option value="BBA">BBA</option>
                            <option value="B.Com">B.Com</option>
                            <option value="M.Com">M.Com</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Year of Study</label>
                        <select name="year" class="form-input w-full px-3 py-2 rounded-lg">
                            <option value="">Select Year</option>
                            <option value="1st Year">1st Year</option>
                            <option value="2nd Year">2nd Year</option>
                            <option value="3rd Year">3rd Year</option>
                            <option value="Final Year">Final Year</option>
                            <option value="Alumni">Alumni</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Additional Information</label>
                        <textarea name="additional_info" rows="3" 
                                  class="form-input w-full px-3 py-2 rounded-lg" 
                                  placeholder="Any dietary requirements, questions, etc."></textarea>
                    </div>
                </div>
                <div class="flex space-x-4">
                    <button type="submit" class="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition duration-300">
                        <i class="fas fa-paper-plane mr-2"></i>Submit Registration
                    </button>
                    <button type="button" onclick="hideRegistrationForm('${eventId}')" 
                            class="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 transition duration-300">
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    `;
    
    formContainer.classList.add('open');
}

function hideRegistrationForm(eventId) {
    const formContainer = document.getElementById(`registration-form-${eventId}`);
    formContainer.classList.remove('open');
}

async function submitRegistration(event, eventId) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const submitButton = event.target.querySelector('button[type="submit"]');
    
    // Validate required fields
    if (!formData.get('name') || !formData.get('email')) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    // Show loading state
    submitButton.classList.add('loading-button');
    submitButton.disabled = true;
    
    try {
        const registrationData = {
            event_id: eventId,
            name: formData.get('name'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            department: formData.get('department'),
            year: formData.get('year'),
            additional_info: formData.get('additional_info')
        };
        
        const response = await axios.post(`${API_BASE}/register`, registrationData);
        
        if (response.data.success) {
            showToast('Registration successful! Check your email for confirmation.', 'success', 5000);
            hideRegistrationForm(eventId);
        } else {
            throw new Error(response.data.error || 'Registration failed');
        }
    } catch (error) {
        console.error('Registration error:', error);
        let errorMessage = 'Registration failed. Please try again.';
        
        if (error.response && error.response.data) {
            errorMessage = error.response.data.error || error.response.data.message || errorMessage;
        }
        
        showToast(errorMessage, 'error', 5000);
    } finally {
        submitButton.classList.remove('loading-button');
        submitButton.disabled = false;
    }
}

// Notices Functions
async function loadNotices() {
    const container = document.getElementById('notices-container');
    container.innerHTML = `
        <div class="text-center py-12">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p class="text-gray-500">Loading notices...</p>
        </div>
    `;
    
    try {
        const response = await axios.get(`${API_BASE}/notices`);
        AppState.notices = response.data.notices || [];
        AppState.filteredNotices = AppState.notices;
        renderNotices(AppState.filteredNotices);
    } catch (error) {
        console.error('Load notices error:', error);
        container.innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-exclamation-triangle text-4xl text-red-500 mb-4"></i>
                <p class="text-gray-500">Failed to load notices. Please try again later.</p>
                <button onclick="loadNotices()" class="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                    <i class="fas fa-retry mr-2"></i>Retry
                </button>
            </div>
        `;
    }
}

function renderNotices(notices) {
    const container = document.getElementById('notices-container');
    
    if (notices.length === 0) {
        container.innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-bullhorn text-4xl text-gray-400 mb-4"></i>
                <p class="text-gray-500">No notices available at the moment.</p>
                <p class="text-gray-400 text-sm">Check back later for updates!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = notices.map(notice => `
        <div class="notice-card bg-white rounded-lg shadow-md p-6">
            <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4">
                <div class="flex items-center space-x-3 mb-2 sm:mb-0">
                    <span class="notice-category category-${notice.category.toLowerCase()}">
                        ${escapeHtml(notice.category)}
                    </span>
                    <span class="text-sm text-gray-500">
                        ${formatRelativeDate(notice.posted_at_iso)}
                    </span>
                </div>
            </div>
            <h3 class="text-xl font-semibold text-gray-900 mb-3">${escapeHtml(notice.title)}</h3>
            <div class="prose prose-sm max-w-none text-gray-600">
                ${notice.body_html}
            </div>
        </div>
    `).join('');
}

function filterNotices(category) {
    // Update filter button states
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        btn.classList.add('bg-gray-200', 'text-gray-700');
        btn.classList.remove('bg-blue-600', 'text-white');
    });
    
    event.target.classList.add('active');
    event.target.classList.remove('bg-gray-200', 'text-gray-700');
    event.target.classList.add('bg-blue-600', 'text-white');
    
    // Filter notices
    if (category === 'all') {
        AppState.filteredNotices = AppState.notices;
    } else {
        AppState.filteredNotices = AppState.notices.filter(notice => 
            notice.category.toLowerCase() === category.toLowerCase()
        );
    }
    
    renderNotices(AppState.filteredNotices);
}

// Admin Functions
async function adminLogin() {
    const apiKeyInput = document.getElementById('admin-api-key');
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
        showToast('Please enter the admin API key', 'error');
        return;
    }
    
    showLoading();
    
    try {
        const response = await axios.post(`${API_BASE}/admin/login`, {
            api_key: apiKey
        });
        
        if (response.data.success) {
            AppState.adminToken = response.data.token;
            showToast('Admin login successful!', 'success');
            loadAdminDashboard();
        } else {
            throw new Error(response.data.error || 'Login failed');
        }
    } catch (error) {
        console.error('Admin login error:', error);
        let errorMessage = 'Invalid API key or login failed';
        
        if (error.response && error.response.data) {
            errorMessage = error.response.data.error || error.response.data.message || errorMessage;
        }
        
        showToast(errorMessage, 'error');
    } finally {
        hideLoading();
    }
}

async function loadAdminDashboard() {
    const loginDiv = document.getElementById('admin-login');
    const dashboardDiv = document.getElementById('admin-dashboard');
    
    loginDiv.classList.add('hidden');
    dashboardDiv.classList.remove('hidden');
    
    try {
        const response = await axios.get(`${API_BASE}/admin/dashboard`, {
            headers: {
                'Authorization': `Bearer ${AppState.adminToken}`
            }
        });
        
        const dashboard = response.data.dashboard;
        
        dashboardDiv.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div class="admin-stat">
                    <div class="text-3xl font-bold text-blue-600 mb-2">${dashboard.overview.total_events}</div>
                    <div class="text-sm text-gray-600">Total Events</div>
                </div>
                <div class="admin-stat">
                    <div class="text-3xl font-bold text-green-600 mb-2">${dashboard.overview.total_notices}</div>
                    <div class="text-sm text-gray-600">Total Notices</div>
                </div>
                <div class="admin-stat">
                    <div class="text-3xl font-bold text-purple-600 mb-2">${dashboard.overview.total_registrations}</div>
                    <div class="text-sm text-gray-600">Total Registrations</div>
                </div>
                <div class="admin-stat">
                    <div class="text-3xl font-bold text-orange-600 mb-2">${dashboard.overview.total_chat_sessions}</div>
                    <div class="text-sm text-gray-600">Chat Sessions</div>
                </div>
            </div>
            
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div class="admin-card">
                    <h3 class="text-lg font-semibold mb-4">Recent Chat Activity</h3>
                    <div class="space-y-3">
                        ${dashboard.recent_activity.latest_chats.map(chat => `
                            <div class="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                                <div class="flex-1">
                                    <p class="text-sm text-gray-800">${escapeHtml(chat.question)}</p>
                                    <p class="text-xs text-gray-500 mt-1">
                                        Model: ${chat.model_used} • ${formatRelativeDate(chat.timestamp)}
                                    </p>
                                </div>
                                <span class="px-2 py-1 text-xs rounded-full ${chat.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                                    ${chat.status}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                    <button onclick="loadChatLogs()" class="mt-4 text-blue-600 hover:text-blue-800 text-sm font-medium">
                        View All Chat Logs →
                    </button>
                </div>
                
                <div class="admin-card">
                    <h3 class="text-lg font-semibold mb-4">AI Model Usage</h3>
                    <div class="space-y-3">
                        ${Object.entries(dashboard.ai_models.usage).map(([model, count]) => `
                            <div class="flex justify-between items-center">
                                <span class="text-sm text-gray-700">${model}</span>
                                <span class="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">${count}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            
            <div class="flex flex-wrap gap-4 mt-8">
                <button onclick="loadChatLogs()" class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <i class="fas fa-comments mr-2"></i>Chat Logs
                </button>
                <button onclick="loadSystemStatus()" class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                    <i class="fas fa-heartbeat mr-2"></i>System Status
                </button>
                <button onclick="adminLogout()" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
                    <i class="fas fa-sign-out-alt mr-2"></i>Logout
                </button>
            </div>
        `;
    } catch (error) {
        console.error('Load dashboard error:', error);
        showToast('Failed to load admin dashboard', 'error');
        adminLogout();
    }
}

async function loadChatLogs() {
    if (!AppState.adminToken) return;
    
    const dashboardDiv = document.getElementById('admin-dashboard');
    dashboardDiv.innerHTML = `
        <div class="mb-4">
            <button onclick="loadAdminDashboard()" class="text-blue-600 hover:text-blue-800">
                <i class="fas fa-arrow-left mr-2"></i>Back to Dashboard
            </button>
        </div>
        <div class="admin-card">
            <h3 class="text-lg font-semibold mb-4">Chat Logs</h3>
            <div class="text-center py-8">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p class="text-gray-500">Loading chat logs...</p>
            </div>
        </div>
    `;
    
    try {
        const response = await axios.get(`${API_BASE}/admin/chat-logs?limit=20`, {
            headers: {
                'Authorization': `Bearer ${AppState.adminToken}`
            }
        });
        
        const logs = response.data.logs;
        
        dashboardDiv.innerHTML = `
            <div class="mb-4">
                <button onclick="loadAdminDashboard()" class="text-blue-600 hover:text-blue-800">
                    <i class="fas fa-arrow-left mr-2"></i>Back to Dashboard
                </button>
            </div>
            <div class="admin-card">
                <h3 class="text-lg font-semibold mb-4">Recent Chat Logs (${logs.length})</h3>
                <div class="admin-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Question</th>
                                <th>Model</th>
                                <th>Status</th>
                                <th>User</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${logs.map(log => `
                                <tr>
                                    <td class="text-sm">${formatRelativeDate(log.timestamp)}</td>
                                    <td class="text-sm">${escapeHtml(log.question.substring(0, 50))}${log.question.length > 50 ? '...' : ''}</td>
                                    <td class="text-sm">${log.model_used}</td>
                                    <td>
                                        <span class="px-2 py-1 text-xs rounded-full ${log.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                                            ${log.status}
                                        </span>
                                    </td>
                                    <td class="text-sm">${log.user_email ? escapeHtml(log.user_email) : 'Anonymous'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Load chat logs error:', error);
        showToast('Failed to load chat logs', 'error');
    }
}

async function loadSystemStatus() {
    if (!AppState.adminToken) return;
    
    showLoading();
    
    try {
        const response = await axios.get(`${API_BASE}/admin/system-status`, {
            headers: {
                'Authorization': `Bearer ${AppState.adminToken}`
            }
        });
        
        const status = response.data;
        const dashboardDiv = document.getElementById('admin-dashboard');
        
        dashboardDiv.innerHTML = `
            <div class="mb-4">
                <button onclick="loadAdminDashboard()" class="text-blue-600 hover:text-blue-800">
                    <i class="fas fa-arrow-left mr-2"></i>Back to Dashboard
                </button>
            </div>
            <div class="admin-card">
                <h3 class="text-lg font-semibold mb-4">System Status</h3>
                <div class="mb-4">
                    <span class="px-3 py-1 rounded-full text-sm font-medium ${status.overall_status === 'healthy' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}">
                        ${status.overall_status.toUpperCase()}
                    </span>
                    <span class="text-sm text-gray-500 ml-2">Last checked: ${formatDate(status.timestamp)}</span>
                </div>
                <div class="space-y-3">
                    ${status.checks.map(check => `
                        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div class="flex items-center">
                                <i class="fas ${check.status === 'healthy' ? 'fa-check-circle text-green-600' : check.status === 'configured' ? 'fa-cog text-blue-600' : 'fa-exclamation-triangle text-red-600'} mr-3"></i>
                                <div>
                                    <p class="font-medium">${check.service}</p>
                                    <p class="text-sm text-gray-600">${check.message}</p>
                                </div>
                            </div>
                            <span class="px-2 py-1 text-xs rounded-full ${check.status === 'healthy' ? 'bg-green-100 text-green-800' : check.status === 'configured' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}">
                                ${check.status}
                            </span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Load system status error:', error);
        showToast('Failed to load system status', 'error');
    } finally {
        hideLoading();
    }
}

function adminLogout() {
    AppState.adminToken = null;
    document.getElementById('admin-login').classList.remove('hidden');
    document.getElementById('admin-dashboard').classList.add('hidden');
    document.getElementById('admin-api-key').value = '';
    showToast('Logged out successfully', 'info');
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Mobile menu toggle
    document.getElementById('mobile-menu-button').addEventListener('click', toggleMobileMenu);
    
    // Navigation links
    document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const sectionId = this.getAttribute('href').substring(1);
            showSection(sectionId);
        });
    });
    
    // Chat functionality
    const chatInput = document.getElementById('chat-input');
    const chatSend = document.getElementById('chat-send');
    
    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChatMessage();
        }
    });
    
    chatSend.addEventListener('click', sendChatMessage);
    
    // Initialize with home section
    showSection('home');
});

// Make functions available globally
window.showSection = showSection;
window.sendChatMessage = sendChatMessage;
window.loadEvents = loadEvents;
window.loadNotices = loadNotices;
window.filterNotices = filterNotices;
window.showRegistrationForm = showRegistrationForm;
window.hideRegistrationForm = hideRegistrationForm;
window.submitRegistration = submitRegistration;
window.adminLogin = adminLogin;
window.loadAdminDashboard = loadAdminDashboard;
window.loadChatLogs = loadChatLogs;
window.loadSystemStatus = loadSystemStatus;
window.adminLogout = adminLogout;