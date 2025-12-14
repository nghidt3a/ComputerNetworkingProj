/**
 * MAIN ENTRY POINT
 * Chịu trách nhiệm khởi tạo ứng dụng và liên kết các module.
 */

import { SocketService } from './services/socket.js';
import { UIManager } from './utils/ui.js';

// Import Features (Các tính năng cụ thể)
import { AuthFeature } from './features/auth.js'; // (Nếu bạn tách logic login)
import { DashboardFeature } from './features/dashboard.js';
import { MonitorFeature } from './features/monitor.js';
import { WebcamFeature } from './features/webcam.js';
import { KeyloggerFeature } from './features/keylogger.js';
import { FileManagerFeature } from './features/fileManager.js';
import { TaskManagerFeature } from './features/taskManager.js';

// Import Global Bridge để HTML onclick hoạt động
import './utils/globalBridge.js';

// --- INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    console.log("RCS Client Initializing...");

    // 1. Setup UI Events (Tabs, Sidebar clicks)
    setupNavigation();

    // 2. Setup Theme Toggle
    setupThemeToggle();

    // 2.5 Setup Menu Toggle (Sidebar Collapse)
    setupMenuToggle();

    // 2.6 Setup Logo Click to return to Dashboard
    setupLogoClick();
    
    // 2.7 Setup Scroll Animations
    setupScrollAnimations();
    
    // 2.8 Add page entrance animation
    document.body.style.opacity = '0';
    setTimeout(() => {
        document.body.style.transition = 'opacity 0.5s ease';
        document.body.style.opacity = '1';
    }, 100);

    // 3. Setup Login Event
    AuthFeature.init();
   
    DashboardFeature.init();
    MonitorFeature.init();
    WebcamFeature.init();
    KeyloggerFeature.init();
    FileManagerFeature.init();
    TaskManagerFeature.init();
    
    // 4. Setup disconnect handler
    SocketService.on('DISCONNECT', () => {
        UIManager.showLoginScreen();
        UIManager.showToast('Disconnected from Server', 'error');
    });
});
function setupMenuToggle() {
    // Mobile menu removed - Desktop only version
    // No toggle functionality needed
}

// --- EVENT HANDLERS ---


function setupLogoClick() {
    const logo = document.getElementById('logo-heading');
    if (logo) {
        logo.addEventListener('click', () => {
            // Quay về Dashboard bằng cách trigger click vào nút Dashboard
            const dashboardBtn = document.querySelector('[data-tab="dashboard"]');
            if (dashboardBtn) {
                dashboardBtn.click();
            }
        });
    }
}

function setupNavigation() {
    // Support both old (.list-group-item) and new (.nav-link) selectors
    const navButtons = document.querySelectorAll('#sidebar .list-group-item, #sidebar .nav-link[data-tab]');
    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Get target tab from data-tab attribute
            const targetId = btn.getAttribute('data-tab');
            if (!targetId) return;
            
            // Logic chuyển Tab với smooth transition
            const currentTab = document.querySelector('.tab-content.active');
            const targetTab = document.getElementById(`tab-${targetId}`);
            
            // 1. Remove active class from all navigation items
            document.querySelectorAll('#sidebar .list-group-item, #sidebar .nav-link').forEach(item => {
                item.classList.remove('active');
            });
            
            // 2. Fade out current tab
            if(currentTab && currentTab !== targetTab) {
                currentTab.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
                currentTab.style.opacity = '0';
                currentTab.style.transform = 'translateY(-10px)';
                
                setTimeout(() => {
                    currentTab.classList.remove('active');
                    currentTab.style.opacity = '';
                    currentTab.style.transform = '';
                }, 200);
            }
            
            // 3. Add active class to clicked item and fade in target
            btn.classList.add('active');
            
            setTimeout(() => {
                if(targetTab) {
                    targetTab.style.opacity = '0';
                    targetTab.style.transform = 'translateY(10px)';
                    targetTab.classList.add('active');
                    
                    setTimeout(() => {
                        targetTab.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                        targetTab.style.opacity = '1';
                        targetTab.style.transform = 'translateY(0)';
                    }, 50);
                }
            }, currentTab && currentTab !== targetTab ? 200 : 0);
            
            // 4. Update Title and Breadcrumb with animation
            const titleMap = {
                'dashboard': 'Overview',
                'monitor': 'Screen Monitor',
                'webcam': 'Webcam Control',
                'processes': 'Process Manager',
                'files': 'File Explorer',
                'terminal': 'Terminal Logs'
            };
            const newTitle = titleMap[targetId] || 'RCS';
            const pageTitle = document.getElementById('page-title');
            if(pageTitle) {
                pageTitle.style.transition = 'opacity 0.2s ease';
                pageTitle.style.opacity = '0';
                setTimeout(() => {
                    pageTitle.innerText = newTitle;
                    pageTitle.style.opacity = '1';
                }, 200);
            }
            
            // Update breadcrumb if exists
            const breadcrumb = document.getElementById('breadcrumb-current');
            if (breadcrumb) {
                breadcrumb.innerText = newTitle;
            }
            
            // 6. Scroll to top smoothly
            window.scrollTo({ top: 0, behavior: 'smooth' });
            
            // 5. Trigger Feature Load (Lazy Load)
            if(targetId === 'files') {
                // FileManager.init(); // Gọi hàm load ổ đĩa
            }
        });
    });
    
    // Disconnect button
    const disconnectBtn = document.getElementById('btn-disconnect');
    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', (e) => {
            e.preventDefault();
            SocketService.disconnect();
            UIManager.showLoginScreen();
        });
    }
}

// --- SCROLL ANIMATIONS ---
/**
 * Setup Intersection Observer for scroll animations
 */
function setupScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if(entry.isIntersecting) {
                entry.target.classList.add('in-view');
                // Unobserve after animation to improve performance
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe all cards when they're added to DOM
    const observeCards = () => {
        document.querySelectorAll('.card:not(.in-view)').forEach(card => {
            if(!card.classList.contains('animate-on-scroll')) {
                card.classList.add('animate-on-scroll');
                observer.observe(card);
            }
        });
    };
    
    // Initial observation
    observeCards();
    
    // Re-observe when tab changes (for dynamically loaded content)
    const navButtons = document.querySelectorAll('[data-tab]');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            setTimeout(observeCards, 300);
        });
    });
}

// --- THEME TOGGLE SYSTEM ---
/**
 * Setup Dark Mode Toggle
 * Lưu preference vào localStorage để giữ theme sau khi reload
 */
function setupThemeToggle() {
    // Load saved theme từ localStorage
    const savedTheme = localStorage.getItem('rcs-theme') || 'light';
    applyTheme(savedTheme);

    // Bắt sự kiện click nút toggle (nút này bạn sẽ thêm vào HTML)
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            applyTheme(newTheme);
            localStorage.setItem('rcs-theme', newTheme);
        });
    }
}

/**
 * Áp dụng theme lên HTML root element
 * @param {string} theme - 'light' hoặc 'dark'
 */
function applyTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        updateThemeIcon('dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
        updateThemeIcon('light');
    }
}

/**
 * Cập nhật icon của nút toggle (nếu có)
 * @param {string} theme - Theme hiện tại
 */
function updateThemeIcon(theme) {
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (!themeToggleBtn) return;

    const icon = themeToggleBtn.querySelector('i');
    if (icon) {
        if (theme === 'dark') {
            icon.className = 'fas fa-sun'; // Icon mặt trời khi đang Dark Mode
        } else {
            icon.className = 'fas fa-moon'; // Icon mặt trăng khi đang Light Mode
        }
    }
}