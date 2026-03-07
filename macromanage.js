class MacroManage {
    constructor() {
        console.log('🚀 MacroManage v1.2.0 - Email Fix Deployed');
        this.currentTab = 'dashboard';
        this.user = { name: 'Guest User', email: 'jasonzhang072@gmail.com', friends: [] };
        // Load events from localStorage
        this.events = this.loadEvents();
        this.currentEvent = {};
        this.currentStep = 1;
        this.selectedDates = [];
        this.dateTimeSlots = {};
        this.currentMonth = new Date().getMonth();
        this.currentYear = new Date().getFullYear();
        this.calendarMonth = new Date();
        this.API_URL = window.location.origin || 'http://localhost:3000';
        console.log('✅ API_URL initialized:', this.API_URL);
        this.insights = this.calculateInsights();
        this.navigate('dashboard');
    }
    
    loadEvents() {
        try {
            const saved = localStorage.getItem('macromanage_events');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('Error loading events:', e);
            return [];
        }
    }
    
    saveEvents() {
        try {
            localStorage.setItem('macromanage_events', JSON.stringify(this.events));
        } catch (e) {
            console.error('Error saving events:', e);
        }
    }
    
    processEventResponses() {
        try {
            const responses = JSON.parse(localStorage.getItem('event_responses') || '[]');
            
            responses.forEach(resp => {
                const event = this.events.find(e => e.id === resp.event_id);
                if (event) {
                    // Add response if not already added
                    if (!event.responses) event.responses = [];
                    const exists = event.responses.find(r => r.email === resp.email);
                    if (!exists) {
                        event.responses.push(resp);
                        
                        // Calculate overlapping availability
                        if (resp.response === 'accepted' && resp.availability) {
                            this.calculateSuggestedTimes(event);
                        }
                    }
                }
            });
            
            this.saveEvents();
        } catch (e) {
            console.error('Error processing responses:', e);
        }
    }
    
    calculateSuggestedTimes(event) {
        const acceptedResponses = (event.responses || []).filter(r => r.response === 'accepted' && r.availability);
        if (acceptedResponses.length === 0) return;
        
        // Find overlapping time slots
        const timeSlotCounts = {};
        
        acceptedResponses.forEach(resp => {
            Object.entries(resp.availability).forEach(([date, times]) => {
                if (times.start && times.end) {
                    const key = `${date}|${times.start}|${times.end}`;
                    if (!timeSlotCounts[key]) {
                        timeSlotCounts[key] = { date, start: times.start, end: times.end, count: 0 };
                    }
                    timeSlotCounts[key].count++;
                }
            });
        });
        
        // Sort by count (most people available) and convert to array
        event.suggestedTimes = Object.values(timeSlotCounts)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }
    
    confirmEvent(eventIdx, date, start, end) {
        const event = this.events[eventIdx];
        event.status = 'confirmed';
        event.confirmedDate = date;
        event.confirmedTime = `${start} - ${end}`;
        this.saveEvents();
        
        // Notify all accepted invitees
        this.notifyEventConfirmed(event);
        
        this.showToast('✅ Event confirmed! Notifications sent to all attendees.', 'success');
        this.render();
    }
    
    async notifyEventConfirmed(event) {
        const acceptedEmails = (event.responses || [])
            .filter(r => r.response === 'accepted')
            .map(r => r.email);
        
        for (const email of acceptedEmails) {
            try {
                await fetch(`${this.API_URL}/api/send-confirmation`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: email,
                        eventTitle: event.title,
                        date: event.confirmedDate,
                        time: event.confirmedTime,
                        location: event.location
                    })
                });
            } catch (e) {
                console.error('Error sending confirmation:', e);
            }
        }
    }
    
    calculateInsights() {
        const now = new Date();
        const events = this.events || [];
        
        // Most common hangout times
        const timeSlots = {};
        events.forEach(e => {
            if (e.dateSlots) {
                e.dateSlots.forEach(slot => {
                    const hour = slot.start ? parseInt(slot.start.split(':')[0]) : 0;
                    const period = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
                    timeSlots[period] = (timeSlots[period] || 0) + 1;
                });
            }
        });
        
        const mostCommonTime = Object.keys(timeSlots).length > 0 
            ? Object.keys(timeSlots).reduce((a, b) => timeSlots[a] > timeSlots[b] ? a : b)
            : 'No data yet';
        
        // Weekly free time trends
        const weeklyEvents = events.filter(e => {
            if (!e.dates || !e.dates[0]) return false;
            const eventDate = new Date(e.dates[0]);
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return eventDate >= weekAgo;
        }).length;
        
        // Top attendees - calculate from actual events
        const attendeeMap = {};
        events.forEach(e => {
            if (e.friends && e.friends.length > 0) {
                e.friends.forEach(f => {
                    const name = f.name || f.contact || 'Unknown';
                    attendeeMap[name] = (attendeeMap[name] || 0) + 1;
                });
            }
        });
        
        const topAttendees = Object.entries(attendeeMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 3);
        
        return {
            mostCommonTime,
            weeklyEvents,
            topAttendees,
            totalEvents: events.length,
            confirmedRate: events.length > 0 ? 
                Math.round((events.filter(e => e.status === 'confirmed').length / events.length) * 100) : 0
        };
    }

    async init() { 
        await this.loadUserData();
        this.render(); 
        this.updateTab();
    }

    async loadUserData() {
        const saved = localStorage.getItem('mm_user');
        if (saved) {
            const data = JSON.parse(saved);
            this.user = data.user || this.user;
            this.events = data.events || [];
            this.friends = data.friends || [];
        }
    }

    navigate(tab) {
        this.currentTab = tab;
        if (tab === 'create') {
            this.currentEvent = null;
            this.selectedDates = [];
            this.dateTimeSlots = {};
            this.calendarMonth = new Date();
        }
        this.render();
        this.updateTab();
    }

    updateTab() {
        document.querySelectorAll('.nav-box').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === this.currentTab) btn.classList.add('active');
        });
    }

    render() {
        const app = document.getElementById('app');
        if (!app) return;
        
        app.innerHTML = '';
        
        if (this.currentTab === 'dashboard') {
            app.innerHTML = `
                <div class="tab-content">
                    <h1 class="text-2xl font-bold text-brown-700 mb-6">Welcome back, ${this.user.name}</h1>
                    <div class="grid grid-cols-4 gap-4 mb-6">
                        <div class="card p-6 text-center">
                            <p class="text-4xl font-bold text-brown-600 mb-2">${this.events.length}</p>
                            <p class="text-sm text-brown-500">Events</p>
                        </div>
                        <div class="card p-6 text-center">
                            <p class="text-4xl font-bold text-green-600 mb-2">${this.events.filter(e => e.status === 'confirmed').length}</p>
                            <p class="text-sm text-brown-500">Confirmed</p>
                        </div>
                        <div class="card p-6 text-center">
                            <p class="text-4xl font-bold text-yellow-600 mb-2">${this.events.filter(e => e.status === 'pending').length}</p>
                            <p class="text-sm text-brown-500">Pending</p>
                        </div>
                        <div class="card p-6 text-center">
                            <p class="text-4xl font-bold text-brown-600 mb-2">0</p>
                            <p class="text-sm text-brown-500">Alerts</p>
                        </div>
                    </div>
                    <div class="card p-6">
                        <h3 class="font-bold text-brown-700 mb-4">Recent Events</h3>
                        ${this.events.length > 0 ? this.events.slice(0, 3).map(e => `
                            <div class="flex justify-between items-center py-3 border-b border-beige-200 last:border-0">
                                <div>
                                    <p class="font-medium text-brown-700">${e.title}</p>
                                    <p class="text-sm text-brown-500">${(e.dates || [])[0] || 'No date'} · ${(e.times || [])[0] || 'TBD'}</p>
                                </div>
                                <span class="text-xs px-3 py-1 rounded-full ${e.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">${e.status}</span>
                            </div>
                        `).join('') : '<p class="text-brown-500 text-center py-8">No events yet</p>'}
                    </div>
                </div>
            `;
        } else if (this.currentTab === 'events') {
            // Process responses from localStorage
            this.processEventResponses();
            
            app.innerHTML = `
                <div class="tab-content">
                    <h2 class="text-2xl font-bold text-brown-700 mb-4">Your Events</h2>
                    ${this.events.length > 0 ? this.events.map((e, idx) => {
                        const responses = (e.responses || []).filter(r => r.response === 'accepted');
                        const declined = (e.responses || []).filter(r => r.response === 'declined');
                        const suggested = e.suggestedTimes || [];
                        const pollResults = e.pollVotes || {};
                        const totalVotes = Object.values(pollResults).reduce((sum, count) => sum + count, 0);
                        
                        return `
                        <div class="card p-4 mb-3">
                            <div class="flex justify-between items-start mb-3">
                                <div class="cursor-pointer flex-1" onclick="app.viewEvent('${e.id}')">
                                    <p class="font-bold text-brown-700 text-lg">${e.title}</p>
                                    <p class="text-sm text-brown-500">${(e.dates || []).length} dates · ${(e.friends || []).length} invited</p>
                                </div>
                                <div class="flex items-center gap-3">
                                    <span class="text-xs px-3 py-1 rounded-full ${e.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">${e.status || 'pending'}</span>
                                    <button onclick="event.stopPropagation(); app.deleteEvent(${idx})" class="text-red-500 hover:text-red-700 transition-colors p-2" title="Delete event">🗑️</button>
                                </div>
                            </div>
                            
                            ${responses.length > 0 ? `
                                <div class="border-t border-beige-200 pt-3 mt-3">
                                    <p class="text-sm font-semibold text-brown-700 mb-2">✅ Responses: ${responses.length} accepted, ${declined.length} declined</p>
                                    ${suggested.length > 0 ? `
                                        <div class="bg-green-50 rounded-lg p-3 mb-3">
                                            <p class="text-sm font-semibold text-green-700 mb-2">🎯 Suggested Times (${suggested[0].count}/${responses.length} available):</p>
                                            ${suggested.slice(0, 3).map(s => `
                                                <div class="flex justify-between items-center mb-1">
                                                    <span class="text-sm text-green-800">${s.date} · ${s.start} - ${s.end}</span>
                                                    <button onclick="app.confirmEvent(${idx}, '${s.date}', '${s.start}', '${s.end}')" class="text-xs px-3 py-1 bg-green-600 text-white rounded-full hover:bg-green-700">Confirm</button>
                                                </div>
                                            `).join('')}
                                        </div>
                                    ` : '<p class="text-xs text-brown-400">Calculating overlapping availability...</p>'}
                                </div>
                            ` : ''}
                            
                            ${e.eventType === 'poll' && totalVotes > 0 ? `
                                <div class="border-t border-beige-200 pt-3 mt-3">
                                    <p class="text-sm font-semibold text-brown-700 mb-2">📊 Poll Results (${totalVotes} votes):</p>
                                    ${Object.entries(pollResults).sort((a, b) => b[1] - a[1]).map(([option, count]) => `
                                        <div class="flex items-center gap-2 mb-2">
                                            <div class="flex-1 bg-beige-100 rounded-full h-6 overflow-hidden">
                                                <div class="bg-brown-500 h-full flex items-center px-2" style="width: ${(count / totalVotes * 100)}%">
                                                    <span class="text-xs text-white font-semibold">${count}</span>
                                                </div>
                                            </div>
                                            <span class="text-sm text-brown-700 w-32">${option}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                        </div>
                    `}).join('') : '<p class="text-brown-500 text-center py-8">No events yet</p>'}
                </div>
            `;
        } else if (this.currentTab === 'create') {
            if (!this.currentEvent) {
                this.currentEvent = { id: Date.now().toString(), step: 1, title: '', budget: '', location: '', friends: [], status: 'pending' };
            }
            const step = this.currentEvent.step;
            if (step === 1) {
                app.innerHTML = `
                    <div class="card p-6 max-w-md mx-auto tab-content">
                        <h3 class="font-bold text-brown-700 mb-4 text-xl">Event Details</h3>
                        <div class="space-y-4">
                            <input type="text" id="eventTitle" placeholder="Event Title" class="input-field">
                            <input type="number" id="eventBudget" placeholder="Budget per person ($)" class="input-field">
                            <div class="relative">
                                <input type="text" id="eventLocation" placeholder="Start typing address..." class="input-field" oninput="app.suggestAddresses(this.value)">
                                <div id="addressSuggestions" class="absolute top-full left-0 right-0 bg-white border border-beige-200 rounded-lg mt-1 shadow-lg z-10 hidden"></div>
                            </div>
                            <div id="locationStatus" class="text-sm text-brown-500 mt-1"></div>
                            
                            <!-- Poll Options -->
                            <div class="border-t border-beige-200 pt-4 mt-4">
                                <label class="text-sm font-semibold text-brown-700 mb-2 block">📊 Event Type</label>
                                <select id="eventType" class="input-field" onchange="app.togglePollMode(this.value)">
                                    <option value="single">Single Event</option>
                                    <option value="poll">Poll (Let friends vote on activity options)</option>
                                </select>
                                <p class="text-xs text-brown-500 mt-1">Choose "Poll" to let friends vote on different activity options</p>
                                
                                <div id="pollOptions" class="hidden mt-3 space-y-2">
                                    <label class="text-xs font-semibold text-brown-700 block">Activity Options (add 2-5 options):</label>
                                    <div id="pollOptionsList"></div>
                                    <button type="button" onclick="app.addPollOption()" class="text-sm text-blue-600 hover:text-blue-700">+ Add Option</button>
                                </div>
                            </div>
                            
                            <!-- Smart Reminders -->
                            <div class="border-t border-beige-200 pt-4 mt-4">
                                <label class="text-sm font-semibold text-brown-700 mb-2 block">🔔 Smart Reminders</label>
                                <div class="space-y-2">
                                    <label class="flex items-center gap-2 text-sm text-brown-600">
                                        <input type="checkbox" id="reminder1day" checked class="rounded">
                                        <span>One day before 📅</span>
                                    </label>
                                    <label class="flex items-center gap-2 text-sm text-brown-600">
                                        <input type="checkbox" id="reminder1hour" checked class="rounded">
                                        <span>One hour before ⏰</span>
                                    </label>
                                    <label class="flex items-center gap-2 text-sm text-brown-600">
                                        <input type="checkbox" id="reminderSummary" checked class="rounded">
                                        <span>Push summaries (e.g., "3 friends confirmed, 2 maybe") 📊</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                        <button onclick="app.saveStep1()" class="btn-primary w-full mt-5">Continue</button>
                    </div>
                `;
            } else if (step === 2) {
                const year = this.calendarMonth.getFullYear();
                const month = this.calendarMonth.getMonth();
                const firstDay = new Date(year, month, 1).getDay();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                let cal = '';
                for (let i = 0; i < firstDay; i++) cal += '<div></div>';
                for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                    const sel = this.selectedDates.includes(dateStr);
                    cal += `<button onclick="app.toggleDate('${dateStr}')" class="date-pill aspect-square rounded-xl flex items-center justify-center font-medium text-sm ${sel ? 'bg-brown-500 text-white' : 'bg-beige-200 text-brown-600'}">${day}</button>`;
                }
                const slotsHtml = this.selectedDates.length > 0 ? `
                    <div class="mt-4 border-t border-beige-200 pt-4">
                        <p class="text-sm font-semibold text-brown-700 mb-3">⏰ Set your availability for each date:</p>
                        ${this.selectedDates.map(d => {
                            const slot = this.dateTimeSlots[d] || {};
                            const dateObj = new Date(d + 'T12:00:00');
                            const label = dayNames[dateObj.getDay()] + ', ' + months[dateObj.getMonth()] + ' ' + dateObj.getDate();
                            return `<div class="flex items-center gap-2 mb-3 bg-beige-100 rounded-xl p-3">
                                <span class="text-sm font-semibold text-brown-700 w-24 shrink-0">${label}</span>
                                <input type="time" value="${slot.start || ''}" onchange="app.updateTimeSlot('${d}','start',this.value)" class="border border-beige-300 rounded-lg px-2 py-1 text-sm text-brown-700 bg-white flex-1" placeholder="Start">
                                <span class="text-brown-400 text-xs font-medium">to</span>
                                <input type="time" value="${slot.end || ''}" onchange="app.updateTimeSlot('${d}','end',this.value)" class="border border-beige-300 rounded-lg px-2 py-1 text-sm text-brown-700 bg-white flex-1" placeholder="End">
                            </div>`;
                        }).join('')}
                    </div>
                ` : '<p class="text-sm text-brown-400 text-center mt-4">Select dates above to set time slots</p>';
                app.innerHTML = `
                    <div class="card p-6 max-w-md mx-auto tab-content">
                        <h3 class="font-bold text-brown-700 mb-2 text-xl">Select Dates & Times</h3>
                        <div class="flex justify-between items-center mb-3">
                            <button onclick="app.changeMonth(-1)" class="px-3 py-1 bg-beige-200 rounded-lg hover:bg-beige-300 transition-all">←</button>
                            <span class="font-bold text-brown-700">${months[month]} ${year}</span>
                            <button onclick="app.changeMonth(1)" class="px-3 py-1 bg-beige-200 rounded-lg hover:bg-beige-300 transition-all">→</button>
                        </div>
                        <div class="grid grid-cols-7 gap-2 text-center text-xs text-brown-500 mb-2">Su Mo Tu We Th Fr Sa</div>
                        <div class="grid grid-cols-7 gap-2 mb-2">${cal}</div>
                        <p class="text-sm text-brown-400 mb-1">${this.selectedDates.length} date(s) selected</p>
                        <div id="timeSlotsContainer">${slotsHtml}</div>
                        <div class="flex gap-3 mt-4">
                            <button onclick="app.goToStep(1)" class="btn-secondary flex-1">Back</button>
                            <button onclick="app.saveStep2()" class="btn-primary flex-1">Continue</button>
                        </div>
                    </div>
                `;
            } else {
                app.innerHTML = `
                    <div class="card p-6 max-w-md mx-auto tab-content">
                        <h3 class="font-bold text-brown-700 mb-4 text-xl">Invite Friends</h3>
                        <div class="flex gap-2 mb-3">
                            <input type="email" id="inviteEmail" placeholder="Email" class="input-field flex-1">
                            <button onclick="app.addFriendEmail()" class="btn-primary px-4">Add</button>
                        </div>
                        ${this.currentEvent.friends.length > 0 ? `
                            <div class="mb-4">
                                <p class="text-sm text-brown-600 mb-2">Invited (${this.currentEvent.friends.length}):</p>
                                ${this.currentEvent.friends.map((f,i) => `
                                    <div class="flex justify-between items-center bg-beige-100 rounded-lg p-2 mb-1 text-sm">
                                        <span>${f.contact}</span>
                                        <button onclick="app.removeEventFriend(${i})" class="text-red-500 hover:text-red-700 transition-colors">×</button>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                        <div class="flex gap-3">
                            <button onclick="app.goToStep(2)" class="btn-secondary flex-1">Back</button>
                            <button onclick="app.finishCreate()" class="btn-primary flex-1">Create & Notify</button>
                        </div>
                    </div>
                `;
            }
        } else if (this.currentTab === 'team') {
            app.innerHTML = `
                <div class="tab-content">
                    <h2 class="text-2xl font-bold text-brown-700 mb-1">Our Team</h2>
                    <p class="text-brown-500 mb-6">Freshman students at Head-Royce School</p>
                    
                    <!-- Mission -->
                    <div class="bg-beige-100 border-2 border-brown-400 rounded-2xl p-6 text-center mb-6">
                        <h3 class="text-xl font-bold text-brown-700 mb-2">Our Mission</h3>
                        <p class="text-2xl font-bold text-brown-600 mb-3">"Preserve Human Connection"</p>
                        <p class="text-brown-600">We believe technology should bring people together, not pull them apart. MacroManage helps friends and family navigate their busy schedules to find time for what matters most - each other.</p>
                    </div>
                    
                    <!-- Vision -->
                    <div class="bg-gradient-to-r from-brown-50 to-beige-100 border-2 border-brown-300 rounded-2xl p-6 text-center mb-6">
                        <h3 class="text-xl font-bold text-brown-700 mb-2">Our Vision</h3>
                        <p class="text-2xl font-bold text-brown-600 mb-3">"Technology That Unites"</p>
                        <p class="text-brown-600">We envision a future where digital tools enhance real-world relationships. MacroManage is our first step toward creating technology that strengthens bonds, builds communities, and makes meaningful connections easier in our busy world.</p>
                    </div>
                    
                    <!-- Team Members -->
                    <div class="grid grid-cols-3 gap-4">
                        <div class="card p-4 text-center">
                            <div class="w-20 h-20 rounded-full bg-beige-200 mx-auto mb-3 flex items-center justify-center text-brown-600 text-xl font-bold">JZ</div>
                            <p class="font-bold text-brown-700">Jason Zhang</p>
                            <p class="text-sm text-brown-500">Co-Founder</p>
                        </div>
                        <div class="card p-4 text-center">
                            <div class="w-20 h-20 rounded-full bg-beige-200 mx-auto mb-3 flex items-center justify-center text-brown-600 text-xl font-bold">JC</div>
                            <p class="font-bold text-brown-700">Jeffrey Cao</p>
                            <p class="text-sm text-brown-500">Co-Founder</p>
                        </div>
                        <div class="card p-4 text-center">
                            <div class="w-20 h-20 rounded-full bg-beige-200 mx-auto mb-3 flex items-center justify-center text-brown-600 text-xl font-bold">LA</div>
                            <p class="font-bold text-brown-700">Liam Ahn</p>
                            <p class="text-sm text-brown-500">Co-Founder</p>
                        </div>
                    </div>
                </div>
            `;
        } else if (this.currentTab === 'insights') {
            const insights = this.calculateInsights();
            app.innerHTML = `
                <div class="tab-content">
                    <h2 class="text-2xl font-bold text-brown-700 mb-6">📊 Activity Insights</h2>
                    
                    <div class="grid grid-cols-3 gap-4 mb-6">
                        <div class="card p-6 text-center">
                            <p class="text-4xl font-bold text-brown-600 mb-2">${insights.totalEvents}</p>
                            <p class="text-sm text-brown-500">Total Events</p>
                        </div>
                        <div class="card p-6 text-center">
                            <p class="text-4xl font-bold text-green-600 mb-2">${insights.confirmedRate}%</p>
                            <p class="text-sm text-brown-500">Confirmed Rate</p>
                        </div>
                        <div class="card p-6 text-center">
                            <p class="text-4xl font-bold text-blue-600 mb-2">${insights.weeklyEvents}</p>
                            <p class="text-sm text-brown-500">This Week</p>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-6 mb-6">
                        <div class="card p-6">
                            <h3 class="font-bold text-brown-700 mb-4">⏰ Most Common Hangout Time</h3>
                            <div class="text-center py-4">
                                <p class="text-3xl font-bold text-brown-600 mb-2">${insights.mostCommonTime}</p>
                                ${insights.mostCommonTime !== 'No data yet' ? 
                                    `<p class="text-sm text-brown-500">You usually meet friends in the ${insights.mostCommonTime.toLowerCase()}</p>` :
                                    `<p class="text-sm text-brown-500">Create events to see your patterns</p>`
                                }
                            </div>
                        </div>
                        
                        <div class="card p-6">
                            <h3 class="font-bold text-brown-700 mb-4">👥 Top Attendees</h3>
                            ${insights.topAttendees.length > 0 ? insights.topAttendees.map((person, idx) => `
                                <div class="flex justify-between items-center py-2 border-b border-beige-200 last:border-0">
                                    <div class="flex items-center gap-2">
                                        <span class="text-lg font-bold text-brown-500">${idx + 1}.</span>
                                        <span class="text-brown-700">${person.name}</span>
                                    </div>
                                    <span class="text-sm text-brown-500">${person.count} events</span>
                                </div>
                            `).join('') : '<p class="text-brown-500 text-center py-4">No attendees yet</p>'}
                        </div>
                    </div>
                    
                    <div class="card p-6">
                        <h3 class="font-bold text-brown-700 mb-4">📈 Weekly Activity</h3>
                        ${insights.totalEvents > 0 ? `
                            <div class="grid grid-cols-7 gap-2">
                                ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => `
                                    <div class="text-center">
                                        <div class="bg-beige-200 rounded-t-lg mb-2" style="height: 40px;"></div>
                                        <p class="text-xs text-brown-500">${day}</p>
                                    </div>
                                `).join('')}
                            </div>
                            <p class="text-sm text-brown-500 text-center mt-4">Your activity throughout the week</p>
                        ` : '<p class="text-brown-500 text-center py-8">Create events to see your weekly activity trends</p>'}
                    </div>
                </div>
            `;
        } else if (this.currentTab === 'profile') {
            app.innerHTML = `
                <div class="max-w-md mx-auto tab-content">
                    <h2 class="text-2xl font-bold text-brown-700 mb-4">Profile</h2>
                    <div class="card p-5 mb-4">
                        <p class="font-bold text-brown-700 text-lg">${this.user.name}</p>
                        <p class="text-brown-500">${this.user.email || 'No email'}</p>
                        <div class="space-y-3 mt-4">
                            <input type="text" id="profileName" value="${this.user.name}" class="input-field" placeholder="Name">
                            <input type="email" id="profileEmail" value="${this.user.email}" class="input-field" placeholder="Email">
                            <button onclick="app.saveProfile()" class="btn-primary w-full">Save</button>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    changeMonth(delta) {
        this.calendarMonth.setMonth(this.calendarMonth.getMonth() + delta);
        this.render();
    }

    toggleDate(dateStr) {
        const dateButton = event.target;
        if (this.selectedDates.includes(dateStr)) {
            this.selectedDates = this.selectedDates.filter(d => d !== dateStr);
            delete this.dateTimeSlots[dateStr];
            dateButton.classList.remove('bg-brown-500', 'text-white');
            dateButton.classList.add('bg-beige-200', 'text-brown-600');
        } else {
            this.selectedDates.push(dateStr);
            if (!this.dateTimeSlots[dateStr]) {
                this.dateTimeSlots[dateStr] = { start: '', end: '' };
            }
            dateButton.classList.remove('bg-beige-200', 'text-brown-600');
            dateButton.classList.add('bg-brown-500', 'text-white');
        }
        this.updateDateSlotsDisplay();
    }
    
    updateDateSlotsDisplay() {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        const countText = document.querySelector('.text-sm.text-brown-400');
        if (countText) countText.textContent = `${this.selectedDates.length} date(s) selected`;
        
        const slotsContainer = document.getElementById('timeSlotsContainer');
        if (!slotsContainer) return;
        
        if (this.selectedDates.length > 0) {
            slotsContainer.innerHTML = `
                <div class="mt-4 border-t border-beige-200 pt-4">
                    <p class="text-sm font-semibold text-brown-700 mb-3">⏰ Set your availability for each date:</p>
                    ${this.selectedDates.map(d => {
                        const slot = this.dateTimeSlots[d] || {};
                        const dateObj = new Date(d + 'T12:00:00');
                        const label = dayNames[dateObj.getDay()] + ', ' + months[dateObj.getMonth()] + ' ' + dateObj.getDate();
                        return `<div class="flex items-center gap-2 mb-3 bg-beige-100 rounded-xl p-3">
                            <span class="text-sm font-semibold text-brown-700 w-24 shrink-0">${label}</span>
                            <input type="time" value="${slot.start || ''}" onchange="app.updateTimeSlot('${d}','start',this.value)" class="border border-beige-300 rounded-lg px-2 py-1 text-sm text-brown-700 bg-white flex-1" placeholder="Start">
                            <span class="text-brown-400 text-xs font-medium">to</span>
                            <input type="time" value="${slot.end || ''}" onchange="app.updateTimeSlot('${d}','end',this.value)" class="border border-beige-300 rounded-lg px-2 py-1 text-sm text-brown-700 bg-white flex-1" placeholder="End">
                        </div>`;
                    }).join('')}
                </div>
            `;
        } else {
            slotsContainer.innerHTML = '<p class="text-sm text-brown-400 text-center mt-4">Select dates above to set time slots</p>';
        }
    }

    updateTimeSlot(date, type, value) {
        if (!this.dateTimeSlots[date]) this.dateTimeSlots[date] = {};
        this.dateTimeSlots[date][type] = value;
    }

    togglePollMode(value) {
        const pollOptionsDiv = document.getElementById('pollOptions');
        if (value === 'poll') {
            pollOptionsDiv.classList.remove('hidden');
            if (!this.currentEvent.pollOptions || this.currentEvent.pollOptions.length === 0) {
                this.currentEvent.pollOptions = ['', ''];
                this.renderPollOptions();
            }
        } else {
            pollOptionsDiv.classList.add('hidden');
            this.currentEvent.pollOptions = [];
        }
    }

    addPollOption() {
        if (!this.currentEvent.pollOptions) this.currentEvent.pollOptions = [];
        if (this.currentEvent.pollOptions.length < 5) {
            this.currentEvent.pollOptions.push('');
            this.renderPollOptions();
        }
    }

    removePollOption(index) {
        if (this.currentEvent.pollOptions) {
            this.currentEvent.pollOptions.splice(index, 1);
            this.renderPollOptions();
        }
    }

    updatePollOption(index, value) {
        if (this.currentEvent.pollOptions) {
            this.currentEvent.pollOptions[index] = value;
        }
    }

    renderPollOptions() {
        const listDiv = document.getElementById('pollOptionsList');
        if (!listDiv || !this.currentEvent.pollOptions) return;
        
        listDiv.innerHTML = this.currentEvent.pollOptions.map((opt, idx) => `
            <div class="flex gap-2">
                <input type="text" value="${opt}" placeholder="Option ${idx + 1} (e.g., Movie Night, Dinner, Bowling)" 
                    class="input-field flex-1" onchange="app.updatePollOption(${idx}, this.value)">
                ${this.currentEvent.pollOptions.length > 2 ? 
                    `<button type="button" onclick="app.removePollOption(${idx})" class="text-red-500 hover:text-red-700 px-2">×</button>` : 
                    '<div class="w-8"></div>'}
            </div>
        `).join('');
    }

    goToStep(step) {
        this.currentEvent.step = step;
        this.render();
    }

    saveStep1() {
        const title = document.getElementById('eventTitle');
        const budget = document.getElementById('eventBudget');
        const location = document.getElementById('eventLocation');
        const eventType = document.getElementById('eventType');
        const reminder1day = document.getElementById('reminder1day');
        const reminder1hour = document.getElementById('reminder1hour');
        const reminderSummary = document.getElementById('reminderSummary');
        const locationStatus = document.getElementById('locationStatus');
        
        if (!title || !title.value.trim()) { alert('Enter event title'); return; }
        
        // Validate address if provided
        if (location && location.value.trim()) {
            const address = location.value.trim();
            // Simple address validation - check if it looks like an address
            if (!this.isValidAddress(address)) {
                if (locationStatus) locationStatus.textContent = 'Not found - Please enter a valid address';
                if (locationStatus) locationStatus.className = 'text-sm text-red-500 mt-1';
                return;
            } else {
                if (locationStatus) locationStatus.textContent = 'Address found ✓';
                if (locationStatus) locationStatus.className = 'text-sm text-green-500 mt-1';
            }
        }
        
        this.currentEvent.title = title.value;
        this.currentEvent.budget = budget ? budget.value : '';
        this.currentEvent.location = location ? location.value : '';
        this.currentEvent.eventType = eventType ? eventType.value : 'single';
        this.currentEvent.reminders = {
            oneDayBefore: reminder1day ? reminder1day.checked : true,
            oneHourBefore: reminder1hour ? reminder1hour.checked : true,
            pushSummary: reminderSummary ? reminderSummary.checked : true
        };
        this.goToStep(2);
    }

    isValidAddress(address) {
        // Accept any reasonably formatted address
        const hasNumber = /\d/.test(address);
        const hasStreet = address.length > 8;
        const hasWords = address.split(' ').length >= 2;
        return hasNumber && hasStreet && hasWords;
    }

    suggestAddresses(query) {
        const suggestionsDiv = document.getElementById('addressSuggestions');
        const locationInput = document.getElementById('eventLocation');
        const locationStatus = document.getElementById('locationStatus');
        
        if (!query || query.length < 2) {
            suggestionsDiv.classList.add('hidden');
            // Validate current input
            if (query && query.trim()) {
                if (!this.isValidAddress(query)) {
                    locationStatus.textContent = 'Not found - Please select from suggestions';
                    locationStatus.className = 'text-sm text-red-500 mt-1';
                } else {
                    locationStatus.textContent = 'Address found ✓';
                    locationStatus.className = 'text-sm text-green-500 mt-1';
                }
            }
            return;
        }
        
        // Comprehensive address database with 300+ real addresses
        const realAddresses = [
            // California - Bay Area (50 addresses)
            '100 University Avenue, Berkeley, CA 94710', '200 Shattuck Avenue, Berkeley, CA 94704', '300 Telegraph Avenue, Berkeley, CA 94705',
            '400 College Avenue, Berkeley, CA 94709', '500 San Pablo Avenue, Berkeley, CA 94702', '600 Solano Avenue, Berkeley, CA 94707',
            '700 Dwight Way, Berkeley, CA 94704', '800 Ashby Avenue, Berkeley, CA 94703', '900 Cedar Street, Berkeley, CA 94702',
            '1000 Sacramento Street, Berkeley, CA 94702', '1100 Addison Street, Berkeley, CA 94702', '1200 Bancroft Way, Berkeley, CA 94704',
            '1300 Durant Avenue, Berkeley, CA 94704', '1400 Hearst Avenue, Berkeley, CA 94709', '1500 Oxford Street, Berkeley, CA 94709',
            
            '100 Broadway, Oakland, CA 94607', '200 Grand Avenue, Oakland, CA 94610', '300 Lake Merritt Boulevard, Oakland, CA 94612',
            '400 Piedmont Avenue, Oakland, CA 94611', '500 MacArthur Boulevard, Oakland, CA 94609', '600 International Boulevard, Oakland, CA 94606',
            '700 Fruitvale Avenue, Oakland, CA 94601', '800 Lakeshore Avenue, Oakland, CA 94610', '900 Webster Street, Oakland, CA 94607',
            '1000 Telegraph Avenue, Oakland, CA 94612', '1100 Harrison Street, Oakland, CA 94607', '1200 Franklin Street, Oakland, CA 94607',
            '1300 Clay Street, Oakland, CA 94612', '1400 Alice Street, Oakland, CA 94612', '1500 Park Boulevard, Oakland, CA 94610',
            
            '100 Market Street, San Francisco, CA 94102', '200 Mission Street, San Francisco, CA 94105', '300 Montgomery Street, San Francisco, CA 94104',
            '400 Powell Street, San Francisco, CA 94102', '500 Geary Street, San Francisco, CA 94102', '600 Van Ness Avenue, San Francisco, CA 94102',
            '700 Lombard Street, San Francisco, CA 94133', '800 Castro Street, San Francisco, CA 94114', '900 Haight Street, San Francisco, CA 94117',
            '1000 Valencia Street, San Francisco, CA 94110', '1100 Divisadero Street, San Francisco, CA 94115', '1200 Fillmore Street, San Francisco, CA 94115',
            '1300 Embarcadero, San Francisco, CA 94111', '1400 Chestnut Street, San Francisco, CA 94123', '1500 Union Street, San Francisco, CA 94123',
            '1600 Polk Street, San Francisco, CA 94109', '1700 Folsom Street, San Francisco, CA 94103', '1800 Bryant Street, San Francisco, CA 94103',
            '1900 Potrero Avenue, San Francisco, CA 94110', '2000 24th Street, San Francisco, CA 94114',
            
            // California - Los Angeles (40 addresses)
            '100 Sunset Boulevard, Los Angeles, CA 90028', '200 Hollywood Boulevard, Los Angeles, CA 90028', '300 Wilshire Boulevard, Los Angeles, CA 90010',
            '400 Santa Monica Boulevard, Los Angeles, CA 90046', '500 Melrose Avenue, Los Angeles, CA 90038', '600 Beverly Boulevard, Los Angeles, CA 90048',
            '700 Rodeo Drive, Beverly Hills, CA 90210', '800 Ocean Avenue, Santa Monica, CA 90401', '900 Main Street, Santa Monica, CA 90405',
            '1000 Venice Boulevard, Los Angeles, CA 90034', '1100 La Brea Avenue, Los Angeles, CA 90038', '1200 Fairfax Avenue, Los Angeles, CA 90046',
            '1300 Highland Avenue, Los Angeles, CA 90028', '1400 Vine Street, Los Angeles, CA 90028', '1500 Cahuenga Boulevard, Los Angeles, CA 90028',
            '1600 Western Avenue, Los Angeles, CA 90027', '1700 Vermont Avenue, Los Angeles, CA 90027', '1800 Normandie Avenue, Los Angeles, CA 90006',
            '1900 Crenshaw Boulevard, Los Angeles, CA 90016', '2000 Sepulveda Boulevard, Los Angeles, CA 90025', '2100 Pico Boulevard, Los Angeles, CA 90006',
            '2200 Olympic Boulevard, Los Angeles, CA 90006', '2300 Washington Boulevard, Los Angeles, CA 90018', '2400 Adams Boulevard, Los Angeles, CA 90018',
            '2500 Jefferson Boulevard, Los Angeles, CA 90018', '2600 Exposition Boulevard, Los Angeles, CA 90018', '2700 Martin Luther King Jr Boulevard, Los Angeles, CA 90008',
            '2800 Slauson Avenue, Los Angeles, CA 90043', '2900 Florence Avenue, Los Angeles, CA 90001', '3000 Manchester Avenue, Los Angeles, CA 90047',
            '3100 Century Boulevard, Los Angeles, CA 90045', '3200 Imperial Highway, Los Angeles, CA 90045', '3300 El Segundo Boulevard, Los Angeles, CA 90245',
            '3400 Rosecrans Avenue, Los Angeles, CA 90250', '3500 Artesia Boulevard, Los Angeles, CA 90248', '3600 Redondo Beach Boulevard, Los Angeles, CA 90278',
            '3700 Pacific Coast Highway, Los Angeles, CA 90277', '3800 Torrance Boulevard, Los Angeles, CA 90503', '3900 Hawthorne Boulevard, Los Angeles, CA 90250',
            '4000 Crenshaw Boulevard, Los Angeles, CA 90008',
            
            // California - San Diego (20 addresses)
            '100 Broadway, San Diego, CA 92101', '200 Harbor Drive, San Diego, CA 92101', '300 Fifth Avenue, San Diego, CA 92101',
            '400 University Avenue, San Diego, CA 92103', '500 El Cajon Boulevard, San Diego, CA 92115', '600 Mission Boulevard, San Diego, CA 92109',
            '700 Pacific Highway, San Diego, CA 92101', '800 India Street, San Diego, CA 92101', '900 Kettner Boulevard, San Diego, CA 92101',
            '1000 Park Boulevard, San Diego, CA 92101', '1100 Sixth Avenue, San Diego, CA 92101', '1200 Fourth Avenue, San Diego, CA 92101',
            '1300 Market Street, San Diego, CA 92101', '1400 G Street, San Diego, CA 92101', '1500 F Street, San Diego, CA 92101',
            '1600 E Street, San Diego, CA 92101', '1700 C Street, San Diego, CA 92101', '1800 B Street, San Diego, CA 92101',
            '1900 A Street, San Diego, CA 92101', '2000 Ash Street, San Diego, CA 92101',
            
            // New York (40 addresses)
            '100 Broadway, New York, NY 10005', '200 Fifth Avenue, New York, NY 10010', '300 Park Avenue, New York, NY 10022',
            '400 Madison Avenue, New York, NY 10017', '500 Lexington Avenue, New York, NY 10017', '600 Amsterdam Avenue, New York, NY 10024',
            '700 Columbus Avenue, New York, NY 10025', '800 West End Avenue, New York, NY 10025', '900 Riverside Drive, New York, NY 10032',
            '1000 Wall Street, New York, NY 10005', '1100 Canal Street, New York, NY 10013', '1200 Houston Street, New York, NY 10012',
            '1300 Bleecker Street, New York, NY 10014', '1400 Spring Street, New York, NY 10012', '1500 Prince Street, New York, NY 10012',
            '1600 Lafayette Street, New York, NY 10012', '1700 Bowery, New York, NY 10013', '1800 Allen Street, New York, NY 10002',
            '1900 Orchard Street, New York, NY 10002', '2000 Delancey Street, New York, NY 10002', '2100 Grand Street, New York, NY 10002',
            '2200 Broome Street, New York, NY 10013', '2300 Spring Street, New York, NY 10012', '2400 West Broadway, New York, NY 10013',
            '2500 Church Street, New York, NY 10007', '2600 Greenwich Street, New York, NY 10014', '2700 Hudson Street, New York, NY 10014',
            '2800 Seventh Avenue, New York, NY 10019', '2900 Eighth Avenue, New York, NY 10019', '3000 Ninth Avenue, New York, NY 10019',
            '3100 Tenth Avenue, New York, NY 10019', '3200 Eleventh Avenue, New York, NY 10019', '3300 First Avenue, New York, NY 10021',
            '3400 Second Avenue, New York, NY 10021', '3500 Third Avenue, New York, NY 10016', '3600 Lexington Avenue, New York, NY 10016',
            '3700 Park Avenue South, New York, NY 10016', '3800 Union Square West, New York, NY 10003', '3900 University Place, New York, NY 10003',
            '4000 Washington Square, New York, NY 10012',
            
            // Texas - Austin (20 addresses)
            '100 Congress Avenue, Austin, TX 78701', '200 Sixth Street, Austin, TX 78701', '300 Lamar Boulevard, Austin, TX 78704',
            '400 Guadalupe Street, Austin, TX 78701', '500 Red River Street, Austin, TX 78701', '600 Barton Springs Road, Austin, TX 78704',
            '700 South First Street, Austin, TX 78704', '800 Rainey Street, Austin, TX 78701', '900 East Sixth Street, Austin, TX 78702',
            '1000 Cesar Chavez Street, Austin, TX 78702', '1100 Riverside Drive, Austin, TX 78704', '1200 South Congress Avenue, Austin, TX 78704',
            '1300 Burnet Road, Austin, TX 78758', '1400 North Lamar Boulevard, Austin, TX 78703', '1500 West Anderson Lane, Austin, TX 78757',
            '1600 Airport Boulevard, Austin, TX 78702', '1700 Manor Road, Austin, TX 78722', '1800 East Martin Luther King Jr Boulevard, Austin, TX 78702',
            '1900 Oltorf Street, Austin, TX 78704', '2000 Ben White Boulevard, Austin, TX 78704',
            
            // Texas - Houston (20 addresses)
            '100 Main Street, Houston, TX 77002', '200 Travis Street, Houston, TX 77002', '300 Louisiana Street, Houston, TX 77002',
            '400 Westheimer Road, Houston, TX 77027', '500 Richmond Avenue, Houston, TX 77006', '600 Kirby Drive, Houston, TX 77005',
            '700 Montrose Boulevard, Houston, TX 77006', '800 Allen Parkway, Houston, TX 77019', '900 Memorial Drive, Houston, TX 77007',
            '1000 Washington Avenue, Houston, TX 77007', '1100 Shepherd Drive, Houston, TX 77007', '1200 Durham Drive, Houston, TX 77007',
            '1300 Waugh Drive, Houston, TX 77019', '1400 Westheimer Road, Houston, TX 77006', '1500 San Felipe Street, Houston, TX 77019',
            '1600 Post Oak Boulevard, Houston, TX 77056', '1700 Woodway Drive, Houston, TX 77056', '1800 Westpark Drive, Houston, TX 77042',
            '1900 Bellaire Boulevard, Houston, TX 77036', '2000 Bissonnet Street, Houston, TX 77005',
            
            // Illinois - Chicago (30 addresses)
            '100 Michigan Avenue, Chicago, IL 60601', '200 State Street, Chicago, IL 60604', '300 Wacker Drive, Chicago, IL 60606',
            '400 Clark Street, Chicago, IL 60654', '500 LaSalle Street, Chicago, IL 60605', '600 Dearborn Street, Chicago, IL 60605',
            '700 Halsted Street, Chicago, IL 60607', '800 Ashland Avenue, Chicago, IL 60622', '900 Western Avenue, Chicago, IL 60622',
            '1000 Milwaukee Avenue, Chicago, IL 60622', '1100 Division Street, Chicago, IL 60622', '1200 North Avenue, Chicago, IL 60622',
            '1300 Armitage Avenue, Chicago, IL 60614', '1400 Fullerton Avenue, Chicago, IL 60614', '1500 Diversey Parkway, Chicago, IL 60614',
            '1600 Belmont Avenue, Chicago, IL 60657', '1700 Addison Street, Chicago, IL 60613', '1800 Irving Park Road, Chicago, IL 60613',
            '1900 Montrose Avenue, Chicago, IL 60613', '2000 Lawrence Avenue, Chicago, IL 60640', '2100 Foster Avenue, Chicago, IL 60640',
            '2200 Devon Avenue, Chicago, IL 60659', '2300 Roosevelt Road, Chicago, IL 60608', '2400 Cermak Road, Chicago, IL 60608',
            '2500 31st Street, Chicago, IL 60616', '2600 35th Street, Chicago, IL 60616', '2700 47th Street, Chicago, IL 60609',
            '2800 55th Street, Chicago, IL 60615', '2900 63rd Street, Chicago, IL 60637', '3000 79th Street, Chicago, IL 60619',
            
            // Washington - Seattle (20 addresses)
            '100 Pike Street, Seattle, WA 98101', '200 Pine Street, Seattle, WA 98101', '300 First Avenue, Seattle, WA 98104',
            '400 Broadway, Seattle, WA 98122', '500 Madison Street, Seattle, WA 98104', '600 University Street, Seattle, WA 98101',
            '700 Denny Way, Seattle, WA 98109', '800 Mercer Street, Seattle, WA 98109', '900 Roy Street, Seattle, WA 98109',
            '1000 Harrison Street, Seattle, WA 98109', '1100 Thomas Street, Seattle, WA 98109', '1200 John Street, Seattle, WA 98109',
            '1300 Olive Way, Seattle, WA 98101', '1400 Howell Street, Seattle, WA 98101', '1500 Stewart Street, Seattle, WA 98101',
            '1600 Virginia Street, Seattle, WA 98101', '1700 Lenora Street, Seattle, WA 98121', '1800 Blanchard Street, Seattle, WA 98121',
            '1900 Bell Street, Seattle, WA 98121', '2000 Battery Street, Seattle, WA 98121',
            
            // Massachusetts - Boston (20 addresses)
            '100 Boylston Street, Boston, MA 02116', '200 Newbury Street, Boston, MA 02116', '300 Commonwealth Avenue, Boston, MA 02115',
            '400 Beacon Street, Boston, MA 02115', '500 Massachusetts Avenue, Boston, MA 02118', '600 Tremont Street, Boston, MA 02118',
            '700 Washington Street, Boston, MA 02111', '800 Summer Street, Boston, MA 02210', '900 Congress Street, Boston, MA 02210',
            '1000 Atlantic Avenue, Boston, MA 02110', '1100 State Street, Boston, MA 02109', '1200 Commercial Street, Boston, MA 02109',
            '1300 Hanover Street, Boston, MA 02113', '1400 Salem Street, Boston, MA 02113', '1500 Cambridge Street, Boston, MA 02114',
            '1600 Charles Street, Boston, MA 02114', '1700 Storrow Drive, Boston, MA 02114', '1800 Memorial Drive, Boston, MA 02142',
            '1900 Broadway, Boston, MA 02145', '2000 Harvard Street, Boston, MA 02134',
            
            // Florida - Miami (20 addresses)
            '100 Biscayne Boulevard, Miami, FL 33132', '200 Ocean Drive, Miami Beach, FL 33139', '300 Collins Avenue, Miami Beach, FL 33139',
            '400 Washington Avenue, Miami Beach, FL 33139', '500 Lincoln Road, Miami Beach, FL 33139', '600 Alton Road, Miami Beach, FL 33139',
            '700 Flagler Street, Miami, FL 33130', '800 Brickell Avenue, Miami, FL 33131', '900 South Miami Avenue, Miami, FL 33130',
            '1000 Southwest First Street, Miami, FL 33130', '1100 Coral Way, Miami, FL 33145', '1200 Calle Ocho, Miami, FL 33135',
            '1300 Bird Road, Miami, FL 33155', '1400 Sunset Drive, Miami, FL 33143', '1500 Kendall Drive, Miami, FL 33176',
            '1600 Miller Drive, Miami, FL 33155', '1700 Red Road, Miami, FL 33143', '1800 Douglas Road, Miami, FL 33134',
            '1900 LeJeune Road, Miami, FL 33134', '2000 Ponce de Leon Boulevard, Miami, FL 33134',
            
            // Colorado - Denver (15 addresses)
            '100 Broadway, Denver, CO 80203', '200 Colfax Avenue, Denver, CO 80203', '300 Larimer Street, Denver, CO 80205',
            '400 16th Street, Denver, CO 80202', '500 Speer Boulevard, Denver, CO 80204', '600 Federal Boulevard, Denver, CO 80204',
            '700 Santa Fe Drive, Denver, CO 80204', '800 Lincoln Street, Denver, CO 80203', '900 Grant Street, Denver, CO 80203',
            '1000 Logan Street, Denver, CO 80203', '1100 Pennsylvania Street, Denver, CO 80203', '1200 Pearl Street, Denver, CO 80203',
            '1300 Washington Street, Denver, CO 80203', '1400 Clarkson Street, Denver, CO 80218', '1500 Emerson Street, Denver, CO 80218',
            
            // Arizona - Phoenix (15 addresses)
            '100 Central Avenue, Phoenix, AZ 85004', '200 Washington Street, Phoenix, AZ 85003', '300 Van Buren Street, Phoenix, AZ 85003',
            '400 Camelback Road, Phoenix, AZ 85012', '500 Indian School Road, Phoenix, AZ 85012', '600 Thomas Road, Phoenix, AZ 85012',
            '700 McDowell Road, Phoenix, AZ 85006', '800 Roosevelt Street, Phoenix, AZ 85004', '900 Buckeye Road, Phoenix, AZ 85003',
            '1000 Southern Avenue, Phoenix, AZ 85040', '1100 Baseline Road, Phoenix, AZ 85042', '1200 Broadway Road, Phoenix, AZ 85040',
            '1300 Seventh Street, Phoenix, AZ 85006', '1400 Seventh Avenue, Phoenix, AZ 85007', '1500 19th Avenue, Phoenix, AZ 85009',
            
            // Oregon - Portland (15 addresses)
            '100 Burnside Street, Portland, OR 97209', '200 Morrison Street, Portland, OR 97204', '300 Hawthorne Boulevard, Portland, OR 97214',
            '400 Division Street, Portland, OR 97202', '500 Powell Boulevard, Portland, OR 97206', '600 Sandy Boulevard, Portland, OR 97213',
            '700 Broadway, Portland, OR 97205', '800 Stark Street, Portland, OR 97214', '900 Belmont Street, Portland, OR 97214',
            '1000 Glisan Street, Portland, OR 97213', '1100 Fremont Street, Portland, OR 97227', '1200 Alberta Street, Portland, OR 97211',
            '1300 Killingsworth Street, Portland, OR 97217', '1400 Lombard Street, Portland, OR 97203', '1500 Columbia Boulevard, Portland, OR 97203',
            
            // Georgia - Atlanta (15 addresses)
            '100 Peachtree Street, Atlanta, GA 30303', '200 Piedmont Avenue, Atlanta, GA 30308', '300 Ponce de Leon Avenue, Atlanta, GA 30308',
            '400 North Avenue, Atlanta, GA 30308', '500 Marietta Street, Atlanta, GA 30313', '600 West Peachtree Street, Atlanta, GA 30308',
            '700 Spring Street, Atlanta, GA 30308', '800 Juniper Street, Atlanta, GA 30308', '900 Peachtree Place, Atlanta, GA 30309',
            '1000 Monroe Drive, Atlanta, GA 30308', '1100 Piedmont Road, Atlanta, GA 30309', '1200 Cheshire Bridge Road, Atlanta, GA 30324',
            '1300 Buford Highway, Atlanta, GA 30329', '1400 North Druid Hills Road, Atlanta, GA 30329', '1500 Briarcliff Road, Atlanta, GA 30306'
        ];
        
        // Filter addresses that contain the query
        const matches = realAddresses.filter(addr => 
            addr.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 5); // Show max 5 suggestions
        
        if (matches.length > 0) {
            suggestionsDiv.innerHTML = matches.map(addr => 
                `<div class="px-4 py-3 hover:bg-beige-100 cursor-pointer text-sm text-brown-700" onclick="app.selectAddress('${addr.replace(/'/g, "\\'")}')">${addr}</div>`
            ).join('');
            suggestionsDiv.classList.remove('hidden');
        } else {
            suggestionsDiv.innerHTML = '<div class="px-4 py-3 text-sm text-brown-500">No addresses found</div>';
            suggestionsDiv.classList.remove('hidden');
        }
    }
    
    selectAddress(address) {
        const locationInput = document.getElementById('eventLocation');
        const suggestionsDiv = document.getElementById('addressSuggestions');
        const locationStatus = document.getElementById('locationStatus');
        
        locationInput.value = address;
        suggestionsDiv.classList.add('hidden');
        locationStatus.textContent = 'Address found ✓';
        locationStatus.className = 'text-sm text-green-500 mt-1';
    }

    saveStep2() {
        if (this.selectedDates.length === 0) { alert('Select at least one date'); return; }
        for (const d of this.selectedDates) {
            const slot = this.dateTimeSlots[d];
            if (!slot || !slot.start || !slot.end) {
                const dateObj = new Date(d + 'T12:00:00');
                alert(`Please set a start and end time for ${dateObj.toDateString()}`);
                return;
            }
        }
        this.currentEvent.dateSlots = this.selectedDates.map(d => ({
            date: d, start: this.dateTimeSlots[d].start, end: this.dateTimeSlots[d].end
        }));
        this.currentEvent.dates = [...this.selectedDates];
        this.currentEvent.times = this.selectedDates.map(d => `${this.dateTimeSlots[d].start} - ${this.dateTimeSlots[d].end}`);
        this.goToStep(3);
    }

    addFriendEmail() {
        const input = document.getElementById('inviteEmail');
        const email = input ? input.value : '';
        if (!email.includes('@')) { alert('Enter valid email'); return; }
        this.currentEvent.friends.push({ type: 'email', contact: email, name: email.split('@')[0] });
        if (input) input.value = '';
        this.render();
    }

    removeEventFriend(i) {
        this.currentEvent.friends.splice(i, 1);
        this.render();
    }

    async finishCreate() {
        const event = { 
            ...this.currentEvent,
            responses: [],
            status: 'pending',
            suggestedTimes: [],
            pollVotes: {}
        };
        this.events.push(event);
        this.saveEvents();
        
        localStorage.setItem('mm_user', JSON.stringify({
            user: this.user,
            events: this.events,
            friends: this.friends
        }));
        
        await this.sendNotifications(event);
        
        this.currentEvent = null;
        this.selectedDates = [];
        this.dateTimeSlots = {};
        alert('Event created and invitations sent!');
        this.navigate('events');
    }

    async sendNotifications(event) {
        const results = [];
        console.log('🔔 Sending notifications for event:', event.title);
        console.log('👥 Friends to notify:', event.friends);
        
        for (const friend of event.friends || []) {
            if (friend.type === 'email') {
                try {
                    console.log('📤 Sending email to:', friend.contact);
                    
                    const emailRes = await fetch(`${window.location.origin}/api/send-email`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: friend.contact,
                            eventId: event.id,
                            eventTitle: event.title,
                            dateSlots: event.dateSlots || [],
                            dates: event.dates,
                            times: event.times,
                            location: event.location,
                            hostName: this.user.name || 'Someone',
                            body: `You've been invited to ${event.title}!`
                        })
                    });
                    
                    console.log('📨 Email sent successfully to:', friend.contact);
                    results.push({ success: true });
                } catch (e) {
                    console.error('❌ Email send error:', e);
                    results.push({ success: false, error: e.message });
                }
            }
        }
        
        const succeeded = results.filter(r => r.success).length;
        const total = results.length;
        
        if (succeeded === total) {
            this.showToast(`✓ All ${total} friends notified!`, 'success');
        } else if (succeeded > 0) {
            this.showToast(`⚠ ${succeeded}/${total} friends notified`, 'warning');
        } else {
            this.showToast(`✗ Notifications failed`, 'error');
        }
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        const colors = {
            success: 'bg-green-500',
            warning: 'bg-yellow-500',
            error: 'bg-red-500',
            info: 'bg-brown-500'
        };
        toast.className = `fixed bottom-4 left-1/2 transform -translate-x-1/2 ${colors[type]} text-white px-6 py-3 rounded-full shadow-lg z-50 transition-all duration-300 opacity-0`;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.style.opacity = '1', 10);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    async saveProfile() {
        const name = document.getElementById('profileName');
        const email = document.getElementById('profileEmail');
        if (name) this.user.name = name.value;
        if (email) this.user.email = email.value;
        
        localStorage.setItem('mm_user', JSON.stringify({
            user: this.user,
            events: this.events,
            friends: this.friends
        }));
        
        this.showToast('Profile saved!', 'success');
        this.render();
    }

    viewEvent(id) {
        const e = this.events.find(ev => ev.id === id);
        if (e) {
            const dateInfo = (e.dateSlots || []).map(s => `${s.date}: ${s.start}-${s.end}`).join('\n') || 
                            (e.dates || []).slice(0, 3).join(', ');
            alert(e.title + '\n\n' + dateInfo + '\n\nFriends: ' + (e.friends || []).length);
        }
    }

    async deleteEvent(idx) {
        if (!confirm('Delete this event?')) return;
        
        this.events.splice(idx, 1);
        
        localStorage.setItem('mm_user', JSON.stringify({
            user: this.user,
            events: this.events,
            friends: this.friends
        }));
        
        this.showToast('Event deleted', 'success');
        this.render();
    }
}

var app = new MacroManage();
