import { SocketService } from '../services/socket.js';

export const PingFeature = {
    intervalId: null,

    init() {
        SocketService.on('PONG', (data) => {
            const sentTime = parseInt(data.payload);
            const latency = Date.now() - sentTime;
            this.updateUI(latency);
        });

        SocketService.on('AUTH_SUCCESS', () => {
            const badge = document.getElementById('ping-badge');
            // Dùng display: inline-flex để giữ layout flexbox chuẩn
            if (badge) badge.style.display = 'inline-flex';
            this.startPing();
        });

        SocketService.on('DISCONNECT', () => {
            const badge = document.getElementById('ping-badge');
            if (badge) badge.style.display = 'none';
            this.stopPing();
        });
    },

    startPing() {
        this.stopPing();
        this.intervalId = setInterval(() => {
            SocketService.send('PING', Date.now());
        }, 2000);
    },

    stopPing() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    },

    updateUI(latency) {
        const badge = document.getElementById('ping-badge');
        const value = document.getElementById('ping-value');
        
        if (!badge || !value) return;

        value.innerText = `${latency} ms`;

        // Xóa các class trạng thái cũ
        badge.classList.remove('good', 'medium', 'bad');

        // Thêm class mới dựa trên độ trễ
        if (latency < 100) {
            badge.classList.add('good');
        } else if (latency < 300) {
            badge.classList.add('medium');
        } else {
            badge.classList.add('bad');
        }
    }
};