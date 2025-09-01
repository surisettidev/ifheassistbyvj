import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { corsMiddleware } from './lib/auth'
import { chat } from './routes/chat'
import { events } from './routes/events'
import { notices } from './routes/notices'
import { register } from './routes/register'
import { admin } from './routes/admin'
import type { CloudflareBindings } from './types'

const app = new Hono<{ Bindings: CloudflareBindings }>()

// Enable CORS for all routes
app.use('*', corsMiddleware())

// Serve static files from public directory
app.use('/static/*', serveStatic({ root: './public' }))

// API Routes
app.route('/api/chat', chat)
app.route('/api/events', events)
app.route('/api/notices', notices)
app.route('/api/register', register)
app.route('/api/admin', admin)

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    message: 'IFHE Campus Assistant Portal API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  })
})

// Main frontend page
app.get('/', (c) => {
  return c.html(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IFHE Campus Assistant Portal</title>
    <meta name="description" content="AI-powered campus assistant for IFHE Hyderabad students - Get answers, register for events, and stay updated with notices">
    
    <!-- Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    
    <!-- FontAwesome Icons -->
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    
    <!-- Custom CSS -->
    <link href="/static/styles.css" rel="stylesheet">
    
    <!-- Tailwind Configuration -->
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        'ifhe-blue': '#2563eb',
                        'ifhe-purple': '#7c3aed',
                        'ifhe-gradient': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    }
                }
            }
        }
    </script>
</head>
<body class="bg-gray-50 min-h-screen">
    <!-- Navigation -->
    <nav class="bg-white shadow-lg fixed top-0 w-full z-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-16">
                <div class="flex items-center">
                    <div class="flex-shrink-0">
                        <h1 class="text-xl font-bold text-ifhe-blue">
                            <i class="fas fa-graduation-cap mr-2"></i>
                            IFHE Assistant
                        </h1>
                    </div>
                    <div class="hidden md:ml-6 md:flex md:space-x-8">
                        <a href="#home" class="nav-link text-gray-900 inline-flex items-center px-1 pt-1 text-sm font-medium">
                            <i class="fas fa-home mr-2"></i>Home
                        </a>
                        <a href="#chat" class="nav-link text-gray-500 hover:text-gray-900 inline-flex items-center px-1 pt-1 text-sm font-medium">
                            <i class="fas fa-comments mr-2"></i>Chat
                        </a>
                        <a href="#events" class="nav-link text-gray-500 hover:text-gray-900 inline-flex items-center px-1 pt-1 text-sm font-medium">
                            <i class="fas fa-calendar mr-2"></i>Events
                        </a>
                        <a href="#notices" class="nav-link text-gray-500 hover:text-gray-900 inline-flex items-center px-1 pt-1 text-sm font-medium">
                            <i class="fas fa-bullhorn mr-2"></i>Notices
                        </a>
                        <a href="#admin" class="nav-link text-gray-500 hover:text-gray-900 inline-flex items-center px-1 pt-1 text-sm font-medium">
                            <i class="fas fa-cog mr-2"></i>Admin
                        </a>
                    </div>
                </div>
                <div class="flex items-center">
                    <button id="mobile-menu-button" class="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100">
                        <i class="fas fa-bars"></i>
                    </button>
                </div>
            </div>
        </div>
        
        <!-- Mobile menu -->
        <div id="mobile-menu" class="hidden md:hidden">
            <div class="pt-2 pb-3 space-y-1 sm:px-3">
                <a href="#home" class="mobile-nav-link text-gray-900 block px-3 py-2 text-base font-medium">
                    <i class="fas fa-home mr-2"></i>Home
                </a>
                <a href="#chat" class="mobile-nav-link text-gray-500 hover:text-gray-900 block px-3 py-2 text-base font-medium">
                    <i class="fas fa-comments mr-2"></i>Chat
                </a>
                <a href="#events" class="mobile-nav-link text-gray-500 hover:text-gray-900 block px-3 py-2 text-base font-medium">
                    <i class="fas fa-calendar mr-2"></i>Events
                </a>
                <a href="#notices" class="mobile-nav-link text-gray-500 hover:text-gray-900 block px-3 py-2 text-base font-medium">
                    <i class="fas fa-bullhorn mr-2"></i>Notices
                </a>
                <a href="#admin" class="mobile-nav-link text-gray-500 hover:text-gray-900 block px-3 py-2 text-base font-medium">
                    <i class="fas fa-cog mr-2"></i>Admin
                </a>
            </div>
        </div>
    </nav>

    <!-- Main Content -->
    <main class="pt-16">
        <!-- Home Section -->
        <section id="home" class="section-page">
            <div class="bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800 text-white">
                <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
                    <div class="text-center">
                        <h1 class="text-4xl md:text-6xl font-bold mb-6">
                            Welcome to IFHE
                            <span class="block text-yellow-300">Campus Assistant</span>
                        </h1>
                        <p class="text-xl md:text-2xl mb-8 opacity-90">
                            Your AI-powered companion for everything IFHE Hyderabad
                        </p>
                        <div class="flex flex-col sm:flex-row gap-4 justify-center">
                            <button onclick="showSection('chat')" class="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition duration-300">
                                <i class="fas fa-comments mr-2"></i>Start Chat
                            </button>
                            <button onclick="showSection('events')" class="border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition duration-300">
                                <i class="fas fa-calendar mr-2"></i>View Events
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Features Section -->
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
                <div class="text-center mb-12">
                    <h2 class="text-3xl font-bold text-gray-900 mb-4">What Can I Help You With?</h2>
                    <p class="text-lg text-gray-600">Discover all the ways our AI assistant can help you at IFHE</p>
                </div>
                
                <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                    <div class="text-center p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition duration-300">
                        <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="fas fa-brain text-2xl text-blue-600"></i>
                        </div>
                        <h3 class="text-xl font-semibold mb-2">AI Chat Assistant</h3>
                        <p class="text-gray-600">Get instant answers about IFHE programs, admissions, facilities, and more</p>
                    </div>
                    
                    <div class="text-center p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition duration-300">
                        <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="fas fa-calendar-alt text-2xl text-green-600"></i>
                        </div>
                        <h3 class="text-xl font-semibold mb-2">Event Registration</h3>
                        <p class="text-gray-600">Register for campus events, workshops, and activities with ease</p>
                    </div>
                    
                    <div class="text-center p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition duration-300">
                        <div class="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="fas fa-bullhorn text-2xl text-yellow-600"></i>
                        </div>
                        <h3 class="text-xl font-semibold mb-2">Campus Notices</h3>
                        <p class="text-gray-600">Stay updated with the latest announcements and important notices</p>
                    </div>
                    
                    <div class="text-center p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition duration-300">
                        <div class="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <i class="fas fa-envelope text-2xl text-purple-600"></i>
                        </div>
                        <h3 class="text-xl font-semibold mb-2">Email Notifications</h3>
                        <p class="text-gray-600">Receive confirmations and updates directly in your inbox</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- Chat Section -->
        <section id="chat" class="section-page hidden">
            <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div class="bg-white rounded-lg shadow-lg overflow-hidden">
                    <div class="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
                        <h2 class="text-2xl font-bold text-white">
                            <i class="fas fa-robot mr-3"></i>IFHE AI Assistant
                        </h2>
                        <p class="text-blue-100">Ask me anything about IFHE Hyderabad!</p>
                    </div>
                    
                    <div id="chat-messages" class="h-96 overflow-y-auto p-6 space-y-4">
                        <!-- Welcome message -->
                        <div class="flex items-start space-x-3">
                            <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                                <i class="fas fa-robot text-white text-sm"></i>
                            </div>
                            <div class="flex-1 bg-gray-100 rounded-lg p-3">
                                <p>👋 Hello! I'm your IFHE Campus Assistant. I can help you with:</p>
                                <ul class="mt-2 space-y-1 text-sm">
                                    <li>• Admissions and program information</li>
                                    <li>• Campus facilities and services</li>
                                    <li>• Academic requirements and courses</li>
                                    <li>• Student life and activities</li>
                                    <li>• Contact information and directions</li>
                                </ul>
                                <p class="mt-2">What would you like to know about IFHE?</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="border-t p-6">
                        <div class="flex space-x-4">
                            <input type="email" id="user-email" placeholder="Your email (optional)" 
                                   class="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm">
                            <input type="text" id="user-name" placeholder="Your name (optional)" 
                                   class="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm">
                        </div>
                        <div class="flex mt-4 space-x-4">
                            <input type="text" id="chat-input" placeholder="Type your question about IFHE..." 
                                   class="flex-1 border border-gray-300 rounded-lg px-4 py-3" maxlength="500">
                            <button id="chat-send" class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition duration-300">
                                <i class="fas fa-paper-plane"></i>
                            </button>
                        </div>
                        <p class="text-xs text-gray-500 mt-2">Press Enter to send • Max 500 characters</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- Events Section -->
        <section id="events" class="section-page hidden">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div class="mb-8">
                    <h2 class="text-3xl font-bold text-gray-900 mb-4">
                        <i class="fas fa-calendar-alt mr-3 text-blue-600"></i>Upcoming Events
                    </h2>
                    <p class="text-lg text-gray-600">Discover and register for exciting events at IFHE Hyderabad</p>
                </div>
                
                <div id="events-container" class="grid gap-6">
                    <div class="text-center py-12">
                        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p class="text-gray-500">Loading events...</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- Notices Section -->
        <section id="notices" class="section-page hidden">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div class="mb-8">
                    <h2 class="text-3xl font-bold text-gray-900 mb-4">
                        <i class="fas fa-bullhorn mr-3 text-green-600"></i>Campus Notices
                    </h2>
                    <p class="text-lg text-gray-600">Stay updated with the latest announcements and important notices</p>
                </div>
                
                <div class="flex flex-wrap gap-2 mb-6">
                    <button onclick="filterNotices('all')" class="filter-btn active px-4 py-2 rounded-full text-sm font-medium bg-blue-600 text-white">
                        All
                    </button>
                    <button onclick="filterNotices('Academic')" class="filter-btn px-4 py-2 rounded-full text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300">
                        Academic
                    </button>
                    <button onclick="filterNotices('Events')" class="filter-btn px-4 py-2 rounded-full text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300">
                        Events
                    </button>
                    <button onclick="filterNotices('General')" class="filter-btn px-4 py-2 rounded-full text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300">
                        General
                    </button>
                </div>
                
                <div id="notices-container" class="space-y-6">
                    <div class="text-center py-12">
                        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                        <p class="text-gray-500">Loading notices...</p>
                    </div>
                </div>
            </div>
        </section>

        <!-- Admin Section -->
        <section id="admin" class="section-page hidden">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div class="mb-8">
                    <h2 class="text-3xl font-bold text-gray-900 mb-4">
                        <i class="fas fa-cog mr-3 text-purple-600"></i>Admin Panel
                    </h2>
                    <p class="text-lg text-gray-600">Manage events, notices, and monitor chat logs</p>
                </div>
                
                <div id="admin-login" class="max-w-md mx-auto bg-white rounded-lg shadow-lg p-8">
                    <h3 class="text-xl font-semibold mb-4 text-center">Admin Login</h3>
                    <div class="space-y-4">
                        <input type="password" id="admin-api-key" placeholder="Enter Admin API Key" 
                               class="w-full border border-gray-300 rounded-lg px-4 py-3">
                        <button onclick="adminLogin()" class="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700 transition duration-300">
                            <i class="fas fa-sign-in-alt mr-2"></i>Login
                        </button>
                    </div>
                </div>
                
                <div id="admin-dashboard" class="hidden">
                    <!-- Admin dashboard content will be loaded here -->
                </div>
            </div>
        </section>
    </main>

    <!-- Toast Notifications -->
    <div id="toast-container" class="fixed top-20 right-4 z-50 space-y-2"></div>

    <!-- Loading Overlay -->
    <div id="loading-overlay" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
        <div class="bg-white rounded-lg p-8 text-center">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p class="text-gray-600">Processing your request...</p>
        </div>
    </div>

    <!-- JavaScript Libraries -->
    <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    
    <!-- Main Application JavaScript -->
    <script src="/static/app.js"></script>
</body>
</html>
  `)
})

export default app
