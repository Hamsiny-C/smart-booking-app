/**
 * Smart Appointment System - Frontend Logic
 * Architecture: Vanilla JS SPA
 */

const app = {
    state: {
        currentUser: null,
        view: 'landing',
        slots: [], // Local cache of slots
    },

    init: () => {
        console.log('App Initializing...');
        app.loadState();
        app.router.init();
        app.ui.init();
    },

    saveState: () => {
        localStorage.setItem('healthbook_app_state', JSON.stringify(app.state));
    },

    loadState: () => {
        const saved = localStorage.getItem('healthbook_app_state');
        if (saved) {
            app.state = { ...app.state, ...JSON.parse(saved) };
        }
        // Seed data if no slots exist
        if (!app.state.slots || app.state.slots.length === 0) {
            const today = new Date().toISOString().split('T')[0];
            const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

            app.state.slots = [
                { id: 1, date: today, time: '09:00', type: 'In-Person', status: 'available', bookedBy: null },
                { id: 2, date: today, time: '10:00', type: 'Telehealth', status: 'available', bookedBy: null },
                { id: 3, date: today, time: '11:30', type: 'In-Person', status: 'available', bookedBy: null },
                { id: 4, date: today, time: '14:00', type: 'In-Person', status: 'booked', bookedBy: 'test@demo.com' },
                { id: 5, date: tomorrow, time: '09:00', type: 'Telehealth', status: 'available', bookedBy: null },
                { id: 6, date: tomorrow, time: '15:00', type: 'In-Person', status: 'available', bookedBy: null },
            ];
            app.saveState();
        }
    },

    // --- Router (Simple View Switcher) ---
    router: {
        init: () => {
            window.addEventListener('hashchange', app.router.handleRoute);
            app.router.handleRoute(); // Initial load
        },
        navigate: (route) => {
            window.location.hash = route;
        },
        handleRoute: () => {
            const hash = window.location.hash.slice(1) || 'landing';
            const [base, query] = hash.split('?');
            const params = new URLSearchParams(query);

            console.log(`Navigating to: ${base}`, params.toString());
            app.views.render(base, params);
        }
    },

    // --- UI/DOM Manager ---
    ui: {
        init: () => {
            // Sidebar Toggle
            document.getElementById('mobile-menu-toggle')?.addEventListener('click', () => {
                document.getElementById('sidebar').classList.toggle('open');
            });
        },
        renderSidebar: (role) => {
            const nav = document.getElementById('sidebar-nav');
            if (!nav) return;

            const items = [
                { label: 'Dashboard', route: role === 'admin' ? 'dashboard-admin' : 'dashboard-user', icon: '📊' },
                { label: 'Settings', route: 'settings', icon: '⚙️' },
            ];

            nav.innerHTML = items.map(item => `
                <a onclick="app.router.navigate('${item.route}')" class="sidebar-link ${window.location.hash.includes(item.route) ? 'active' : ''}">
                    <span class="icon">${item.icon}</span> ${item.label}
                </a>
            `).join('');
        },
        showToast: (message, type = 'info') => {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.textContent = message;
            container.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        },
        toggleModal: (show, title = '', contentHtml = '', onConfirm = null) => {
            const modal = document.getElementById('modal-container');
            if (show) {
                document.getElementById('modal-title').textContent = title;
                document.getElementById('modal-body').innerHTML = contentHtml;
                const confirmBtn = document.getElementById('modal-confirm-btn');

                // Clear old listeners by cloning
                const newBtn = confirmBtn.cloneNode(true);
                confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

                if (onConfirm) {
                    newBtn.onclick = () => { onConfirm(); app.ui.toggleModal(false); };
                    newBtn.style.display = 'inline-block';
                } else {
                    newBtn.style.display = 'none';
                }

                modal.classList.remove('hidden');

                // Close button logic
                modal.querySelectorAll('.close-modal').forEach(btn => {
                    btn.onclick = () => app.ui.toggleModal(false);
                });
            } else {
                modal.classList.add('hidden');
            }
        }
    },

    // --- View Controller ---
    views: {
        render: (viewName, params) => {
            const container = document.getElementById('view-container');
            const sidebar = document.getElementById('sidebar');
            const header = document.getElementById('top-header');

            // Check Auth for protected routes
            const protectedRoutes = ['dashboard-user', 'dashboard-admin', 'settings'];
            if (protectedRoutes.includes(viewName) && !app.state.currentUser) {
                app.ui.showToast('Please login to continue', 'danger');
                app.router.navigate('login');
                return;
            }

            // Layout Logic
            if (['landing', 'login', 'register'].includes(viewName)) {
                sidebar.classList.add('hidden');
                header.classList.add('hidden');
            } else {
                sidebar.classList.remove('hidden');
                header.classList.remove('hidden');
                // Ensure sidebar is rendered
                app.ui.renderSidebar(app.state.currentUser?.role || 'user');
                document.querySelector('.header-title').textContent = viewName === 'settings' ? 'Account Settings' : 'Dashboard';
            }

            // HTML Injection
            const template = document.getElementById(`template-${viewName}`);
            if (template) {
                container.innerHTML = template.innerHTML;
                app.views.setupListeners(viewName, params);
            } else {
                // Fallback / Route matching
                if (viewName.startsWith('dashboard')) {
                    const role = app.state.currentUser?.role || 'user';
                    app.router.navigate(`dashboard-${role}`);
                } else {
                    container.innerHTML = `<h2>404 - Page Not Found</h2>`;
                }
            }
        },

        setupListeners: (viewName, params) => {
            if (viewName === 'login') {
                document.getElementById('login-form').onsubmit = (e) => {
                    e.preventDefault();
                    app.auth.login(
                        document.getElementById('email').value,
                        params.get('admin') === 'true'
                    );
                };
            }
            if (viewName === 'dashboard-user') {
                app.slots.fetchAvailable();
                const dateFilter = document.getElementById('slot-date-filter');
                if (dateFilter) {
                    dateFilter.addEventListener('change', () => app.slots.fetchAvailable(dateFilter.value));
                }
            }
            if (viewName === 'dashboard-admin') {
                app.admin.fetchSlots();
            }
            if (viewName === 'settings') {
                app.views.settings.init();
            }
        },

        settings: {
            init: () => {
                const user = app.state.currentUser;
                if (!user) return;

                document.getElementById('settings-name').value = user.name;
                document.getElementById('settings-email').value = user.email;

                document.getElementById('settings-form').onsubmit = (e) => {
                    e.preventDefault();
                    const newName = document.getElementById('settings-name').value;
                    const newPass = document.getElementById('settings-password').value;

                    // Update State
                    app.state.currentUser.name = newName;
                    app.saveState(); // Persist

                    // Update Header UI
                    document.getElementById('user-name-display').textContent = newName;

                    app.ui.showToast('Profile updated successfully', 'success');
                    if (newPass) {
                        console.log('Password updated locally');
                    }
                };
            }
        },

        admin: {
            openCreateSlotModal: () => {
                const formHtml = `
                    <div class="form-group">
                        <label>Date</label>
                        <input type="date" id="new-slot-date" required>
                    </div>
                    <div class="form-group">
                        <label>Time</label>
                        <input type="time" id="new-slot-time" required>
                    </div>
                    <div class="form-group">
                        <label>Type</label>
                        <select id="new-slot-type">
                            <option value="In-Person">In-Person</option>
                            <option value="Telehealth">Telehealth (Video)</option>
                        </select>
                    </div>
                `;
                app.ui.toggleModal(true, 'Create New Slot', formHtml, () => {
                    const date = document.getElementById('new-slot-date').value;
                    const time = document.getElementById('new-slot-time').value;
                    const type = document.getElementById('new-slot-type').value;
                    if (date && time) {
                        app.admin.createSlot({ date, time, type });
                    }
                });
            }
        }
    },

    // --- Auth Logic ---
    auth: {
        login: (email, isAdmin) => {
            // Mock Login
            const user = {
                id: 1,
                email: email,
                role: isAdmin ? 'admin' : 'user',
                name: email.split('@')[0]
            };
            // Simulate API call
            setTimeout(() => {
                app.state.currentUser = user;
                app.saveState(); // Persist
                app.ui.showToast(`Welcome back, ${user.name}!`, 'success');
                app.router.navigate(`dashboard-${user.role}`);
            }, 500);
        },
        logout: () => {
            app.state.currentUser = null;
            app.saveState(); // Persist
            app.ui.showToast('Logged out successfully');
            app.router.navigate('landing');
        },
    },

    // --- Slot Logic (User) ---
    slots: {
        fetchAvailable: (filterDate = null) => {
            const grid = document.getElementById('slots-grid');
            if (!grid) return;

            // Render My Appointments
            const myGrid = document.getElementById('my-appointments-grid');
            const mySlots = app.state.slots.filter(s => s.status === 'booked' && s.bookedBy === app.state.currentUser.email);

            // Update Stat
            document.getElementById('stat-upcoming').textContent = mySlots.length;

            if (mySlots.length > 0) {
                myGrid.innerHTML = mySlots.map(slot => `
                    <div class="slot-card" style="border-left: 4px solid var(--success-color); background: #f0fdf4;">
                        <h4>${slot.time}</h4>
                        <small>${slot.date}</small>
                        <button class="btn-secondary small" style="margin-top: 8px; color: var(--error-color); border-color: var(--error-color);" 
                            onclick="app.slots.cancelBook(${slot.id})">Cancel</button>
                    </div>
                `).join('');
            } else {
                myGrid.innerHTML = '<p style="color: var(--text-muted); opacity: 0.7;">You have no upcoming appointments.</p>';
            }

            // Render Available Slots
            grid.innerHTML = '<div class="loading-skeleton"></div>';

            setTimeout(() => {
                let slots = app.state.slots; // Get from state
                if (filterDate) {
                    slots = slots.filter(s => s.date === filterDate);
                }
                if (slots.length === 0) {
                    grid.innerHTML = '<p>No slots available.</p>';
                    return;
                }

                grid.innerHTML = slots.map(slot => `
                    <div class="slot-card ${slot.status === 'booked' ? 'disabled' : ''}" 
                         onclick="${slot.status === 'available' ? `app.slots.confirmBook(${slot.id}, '${slot.date}', '${slot.time}')` : ''}">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <h4>${slot.time}</h4>
                            <span title="${slot.type || 'In-Person'}" style="font-size: 1.2rem;">${slot.type === 'Telehealth' ? '📹' : '🏥'}</span>
                        </div>
                        <small>${slot.status}</small>
                    </div>
                `).join('');
            }, 300);
        },
        confirmBook: (id, date, time) => {
            const content = `
                <div style="text-align: center; margin-bottom: 20px;">
                    <p style="color: var(--text-secondary); margin-bottom: 8px;">You are about to book an appointment.</p>
                    <div style="background: #E6FCFF; padding: 16px; border-radius: 8px; border: 1px solid #B3F5FF; display: inline-block; width: 100%;">
                        <div style="font-size: 0.9rem; color: #006644; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Appointment Details</div>
                        <div style="font-size: 1.5rem; font-weight: 700; color: #0052CC; margin: 8px 0;">${time}</div>
                        <div style="font-size: 1rem; color: #172B4D; font-weight: 500;">${new Date(date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    </div>
                </div>
                <p style="text-align: center; font-size: 0.9rem;">Do you want to confirm this slot?</p>
            `;

            app.ui.toggleModal(true, 'Confirm Booking', content, () => {
                // Logic to "Block" the slot
                const slotIndex = app.state.slots.findIndex(s => s.id === id);
                if (slotIndex > -1) {
                    app.state.slots[slotIndex].status = 'booked';
                    app.state.slots[slotIndex].bookedBy = app.state.currentUser.email; // Track who booked it
                    app.saveState(); // Persist
                    app.ui.showToast('Appointment Confirmed! Slot blocked.', 'success');
                    app.slots.fetchAvailable(); // Refresh UI
                }
            });
        },
        cancelBook: (id) => {
            app.ui.toggleModal(true, 'Cancel Appointment', '<p>Are you sure you want to cancel this appointment?</p>', () => {
                const slotIndex = app.state.slots.findIndex(s => s.id === id);
                if (slotIndex > -1) {
                    app.state.slots[slotIndex].status = 'available';
                    app.state.slots[slotIndex].bookedBy = null;
                    app.saveState(); // Persist
                    app.ui.showToast('Appointment cancelled successfully.', 'info');
                    app.slots.fetchAvailable(); // Refresh UI
                }
            });
        }
    },

    // --- Admin Logic ---
    admin: {
        fetchSlots: () => {
            const tbody = document.getElementById('admin-slots-table-body');
            if (!tbody) return;

            // Mock Data - use app.state.slots if available, otherwise fallback
            const slotsToDisplay = app.state.slots.length > 0 ? app.state.slots : [
                { id: 1, date: '2023-11-20', time: '09:00 AM', status: 'available', bookedBy: '-' },
                { id: 2, date: '2023-11-20', time: '10:00 AM', status: 'booked', bookedBy: 'user@example.com' },
            ];

            if (slotsToDisplay.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center">No slots found.</td></tr>';
                return;
            }

            tbody.innerHTML = slotsToDisplay.map(slot => `
                <tr>
                    <td>${slot.date}</td>
                    <td>${slot.time}</td>
                    <td>${slot.type || 'In-Person'}</td>
                    <td><span class="badge ${slot.status}">${slot.status}</span></td>
                    <td>${slot.bookedBy}</td>
                    <td><button class="btn-ghost" style="color:red" onclick="app.admin.deleteSlot(${slot.id})">Delete</button></td>
                </tr>
            `).join('');
        },
        createSlot: (data) => {
            console.log('Creating slot:', data);
            const newSlot = {
                id: app.state.slots.length > 0 ? Math.max(...app.state.slots.map(s => s.id)) + 1 : 1,
                date: data.date,
                time: data.time,
                type: data.type,
                status: 'available',
                bookedBy: '-'
            };
            app.state.slots.push(newSlot);
            app.saveState(); // Persist
            app.ui.showToast('New slot created successfully', 'success');
            app.admin.fetchSlots();
        },
        deleteSlot: (id) => {
            app.ui.toggleModal(true, 'Delete Slot', '<p>Are you sure you want to delete this slot?</p>', () => {
                app.state.slots = app.state.slots.filter(s => s.id !== id);
                app.saveState();
                app.ui.showToast('Slot deleted successfully', 'success');
                app.admin.fetchSlots();
            });
        }
    }
};

// Start App
document.addEventListener('DOMContentLoaded', app.init);
