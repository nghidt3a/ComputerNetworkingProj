import { SocketService } from '../services/socket.js';
import { UIManager } from '../utils/ui.js';

let allInstalledApps = [];
let perfInterval = null;

export const DashboardFeature = {
    init() {
        // Listen to socket events
        SocketService.on('INSTALLED_LIST', (data) => {
            allInstalledApps = data.payload || data;
            this.renderAppGrid(allInstalledApps);
        });

        SocketService.on('LOG', (data) => {
            const text = data.payload || data;
            this.logToTerminal(text);
            if (text.includes('Lỗi') || text.includes('Error')) {
                UIManager.showToast(text, 'error');
            } else if (text.includes('Đã') || text.includes('Successfully')) {
                UIManager.showToast(text, 'success');
            }
        });
        
        // Listen for System Info
        SocketService.on('SYS_INFO', (data) => {
            this.updateSystemInfo(data.payload || data);
        });
        
        // Listen for Performance Stats
        SocketService.on('PERF_STATS', (data) => {
            this.updatePerformanceStats(data.payload || data);
        });
        
        // Start monitoring when authenticated
        SocketService.on('AUTH_SUCCESS', () => {
            this.startPerformanceMonitoring();
        });
        
        // Stop monitoring when disconnected
        SocketService.on('DISCONNECT', () => {
            this.stopPerformanceMonitoring();
        });

        // Listen for filter event from global bridge
        window.addEventListener('filterApps', (e) => {
            const keyword = e.detail.keyword;
            const filtered = allInstalledApps.filter(app => 
                app.name.toLowerCase().includes(keyword)
            );
            this.renderAppGrid(filtered);
        });

        // Power Controls
        document.getElementById('btn-shutdown')?.addEventListener('click', () => {
            if(confirm('Shutdown Server?')) SocketService.send('SHUTDOWN');
        });
        
        document.getElementById('btn-restart')?.addEventListener('click', () => {
            if(confirm('Restart Server?')) SocketService.send('RESTART');
        });

        // Quick Launch
        document.getElementById('btn-run-app')?.addEventListener('click', this.runApp);
        document.getElementById('quickAppInput')?.addEventListener('keydown', (e) => {
            if(e.key === 'Enter') this.runApp();
        });

        // Web Shortcuts (Event Delegation)
        document.querySelectorAll('.btn-web-launch').forEach(btn => {
            btn.addEventListener('click', () => {
                const url = btn.getAttribute('data-url');
                this.openWeb(url);
            });
        });
    },

    runApp() {
        const input = document.getElementById("quickAppInput");
        const appName = input.value.trim();
        if (appName) {
            SocketService.send("START_APP", appName);
            UIManager.showToast(`Opening: ${appName}...`, "info");
            input.value = "";
        } else {
            UIManager.showToast("Please enter app name!", "error");
        }
    },

    openWeb(url) {
        SocketService.send("START_APP", url);
        UIManager.showToast(`Opening browser: ${url}...`, "info");
    },

    renderAppGrid(appList) {
        const container = document.getElementById("app-grid");
        if(!container) return;
        
        container.innerHTML = "";
        if (!appList || appList.length === 0) {
            container.innerHTML = '<p class="text-center w-100">No apps found.</p>';
            return;
        }
        
        appList.forEach(app => {
            const div = document.createElement("div");
            div.className = "app-item-btn";
            div.onclick = () => {
                SocketService.send("START_APP", app.path);
                window.closeAppLibrary();
                UIManager.showToast(`Launching ${app.name}...`, "success");
            };
            
            const icon = document.createElement("i");
            icon.className = "fas fa-cube app-item-icon";
            const span = document.createElement("span");
            span.className = "app-item-name";
            span.textContent = app.name;
            
            div.appendChild(icon);
            div.appendChild(span);
            container.appendChild(div);
        });
    },

    logToTerminal(text) {
        const term = document.getElementById("terminal-output");
        if(!term) return;
        
        const div = document.createElement("div");
        div.style.color = "#10b981";
        div.textContent = `[${new Date().toLocaleTimeString()}] > ${text}`;
        term.appendChild(div);
        term.scrollTop = term.scrollHeight;
    },
    
    // ... (Phần updateSystemInfo và updatePerformanceStats giữ nguyên logic, chỉ cần chắc chắn text bên trong HTML đã đổi)
    updateSystemInfo(info) {
        if (document.getElementById('os-info')) {
            document.getElementById('os-info').innerText = info.os || 'Windows';
            document.getElementById('pc-name').innerText = info.pcName || 'Unknown';
            document.getElementById('cpu-name').innerText = info.cpuName || 'Standard CPU';
            document.getElementById('gpu-name').innerText = info.gpuName || 'Integrated Graphics';
            document.getElementById('vram-val').innerText = info.vram || 'N/A';
            document.getElementById('disk-name').innerText = info.totalDisk || 'N/A';
        }
    },
    
    updatePerformanceStats(perf) {
        // ... (Giữ nguyên logic update)
        const getUsageColor = (value) => {
            if (value < 50) return 'text-success';
            if (value < 80) return 'text-warning';
            return 'text-danger';
        };
        
        const cpuUsage = perf.cpu || 0;
        const elCpuFreq = document.getElementById('disp-cpu-freq');
        if (elCpuFreq) elCpuFreq.innerHTML = `${cpuUsage}%`;
        
        const elCpuChange = document.getElementById('cpu-change');
        if (elCpuChange) {
            elCpuChange.className = `text-sm font-weight-bolder ${getUsageColor(cpuUsage)}`;
            elCpuChange.textContent = cpuUsage < 50 ? 'Normal' : cpuUsage < 80 ? 'Moderate' : 'High';
        }
        
        const elCpuTemp = document.getElementById('disp-cpu-temp');
        if (elCpuTemp) {
            if (perf.cpuTemp) {
                elCpuTemp.innerHTML = `<span class="text-secondary">Temp:</span> ${perf.cpuTemp}°C`;
            } else {
                elCpuTemp.innerHTML = '<span class="text-secondary">Temp:</span> --°C';
            }
        }
        
        const ramUsage = perf.ram || 0;
        const elRam = document.getElementById('disp-ram-usage');
        if (elRam) elRam.innerHTML = `${ramUsage}%`;
        
        const elRamChange = document.getElementById('ram-change');
        if (elRamChange) {
            elRamChange.className = `text-sm font-weight-bolder ${getUsageColor(ramUsage)}`;
            elRamChange.textContent = ramUsage < 50 ? '✓ OK' : ramUsage < 80 ? '⚠ High' : '⚠ Critical';
        }

        if (perf.ramUsedGB && perf.ramTotalGB) {
            const elRamUsed = document.getElementById('ram-used');
            const elRamTotal = document.getElementById('ram-total');
            if (elRamUsed) elRamUsed.textContent = `${perf.ramUsedGB.toFixed(1)} GB`;
            if (elRamTotal) elRamTotal.textContent = `${perf.ramTotalGB.toFixed(1)} GB`;
        }
        
        const gpuUsage = perf.gpu || 0;
        const elGpu = document.getElementById('disp-gpu-vram');
        if (elGpu) elGpu.innerHTML = `${gpuUsage}%`;
        
        const elGpuChange = document.getElementById('gpu-change');
        if (elGpuChange) {
            elGpuChange.className = `text-sm font-weight-bolder ${getUsageColor(gpuUsage)}`;
            elGpuChange.textContent = gpuUsage < 50 ? 'Idle' : gpuUsage < 80 ? 'Active' : 'Busy';
        }
        
        const diskUsage = perf.diskUsage || 0;
        const elDisk = document.getElementById('disp-disk-free');
        if (elDisk) elDisk.innerHTML = `${diskUsage}%`;
        
        const elDiskChange = document.getElementById('disk-change');
        if (elDiskChange) {
            elDiskChange.className = `text-sm font-weight-bolder ${getUsageColor(diskUsage)}`;
            elDiskChange.textContent = diskUsage < 50 ? '✓ Healthy' : diskUsage < 80 ? '⚠ Low' : '⚠ Full';
        }
        
        if (perf.diskUsedGB && perf.diskTotalGB) {
            const elDiskUsed = document.getElementById('disk-used');
            const elDiskTotal = document.getElementById('disk-total');
            if (elDiskUsed) elDiskUsed.textContent = `${perf.diskUsedGB.toFixed(0)} GB`;
            if (elDiskTotal) elDiskTotal.textContent = `${perf.diskTotalGB.toFixed(0)} GB`;
        }
    },
    
    startPerformanceMonitoring() {
        SocketService.send('GET_SYS_INFO');
        if (perfInterval) clearInterval(perfInterval);
        perfInterval = setInterval(() => {
            SocketService.send('GET_PERFORMANCE');
        }, 2000); 
    },
    
    stopPerformanceMonitoring() {
        if (perfInterval) {
            clearInterval(perfInterval);
            perfInterval = null;
        }
    }
};