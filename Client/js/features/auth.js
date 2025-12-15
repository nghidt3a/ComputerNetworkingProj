import { SocketService } from '../services/socket.js';
import { UIManager } from '../utils/ui.js';
import { CONFIG } from '../config.js';

export const AuthFeature = {
    init() {
        // Automatically fill default info from Config (Dev mode)
        const ipInput = document.getElementById('server-ip');
        const portInput = document.getElementById('server-port');
        
        if(ipInput) ipInput.value = CONFIG.DEFAULT_IP;
        if(portInput) portInput.value = CONFIG.DEFAULT_PORT;

        // Listen for submit form event
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault(); // Prevent reload
                this.handleLogin();
            });
        }
    },

    async handleLogin() {
        const ip = document.getElementById('server-ip').value.trim();
        const port = document.getElementById('server-port').value.trim();
        const pass = document.getElementById('auth-pass').value.trim();

        if (!ip || !port) {
            UIManager.setLoginError("Please enter IP and Port!");
            return;
        }

        UIManager.setLoginState("Connecting...");

        try {
            // Call Service to connect
            await SocketService.connect(ip, port, pass);
            
            // If successful:
            UIManager.hideLoginScreen();
            
        } catch (error) {
            // If failed:
            UIManager.setLoginError("Connection Error: " + error.message);
        }
    }
};