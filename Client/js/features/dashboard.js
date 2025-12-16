import { SocketService } from '../services/socket.js';
import { UIManager } from '../utils/ui.js';

let allInstalledApps = [];
let perfInterval = null;

const clampPercent = (value) => {
    const num = Number(value) || 0;
    return Math.min(100, Math.max(0, Math.round(num)));
};

const getState = (value) => {
    if (value >= 90) return "danger";
    if (value >= 80) return "warn";
    return "ok";
};

const stateColors = {
    ok: "var(--stat-accent)",
    warn: "var(--stat-warn)",
    danger: "var(--stat-danger)",
};

const getStateLabel = (value, labels) => {
    if (value >= 90) return labels.danger;
    if (value >= 80) return labels.warn;
    return labels.ok;
};

const setGauge = (circle, percent, radius) => {
    if (!circle) return;
    const value = clampPercent(percent);
    const circumference = 2 * Math.PI * radius;
    circle.setAttribute("data-state", getState(value));
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    circle.style.strokeDashoffset = `${circumference - (value / 100) * circumference}`;
    const color = stateColors[getState(value)] || stateColors.ok;
    circle.style.stroke = color;
};

const setBarFill = (el, percent) => {
    if (!el) return;
    const value = clampPercent(percent);
    const state = getState(value);
    el.style.height = `${value}%`;
    el.classList.remove("state-ok", "state-warn", "state-danger");
    el.classList.add(`state-${state}`);
};

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
    
    updateSystemInfo(info) {
        const elOs = document.getElementById('os-info');
        if (elOs) elOs.innerText = info.os || 'Windows';

        const elPc = document.getElementById('pc-name');
        if (elPc) elPc.innerText = info.pcName || 'Unknown';

        const elCpu = document.getElementById('cpu-name');
        if (elCpu) elCpu.innerText = info.cpuName || 'Standard CPU';

        const elCpuMax = document.getElementById('cpu-max');
        if (elCpuMax) {
            if (info.cpuMaxSpeedGHz) {
                elCpuMax.innerText = `${info.cpuMaxSpeedGHz} GHz`;
            } else {
                elCpuMax.innerText = '--';
            }
        }

        const elCpuCores = document.getElementById('cpu-cores');
        if (elCpuCores) elCpuCores.innerText = (info.cpuCores ?? '--').toString();

        const elGpu = document.getElementById('gpu-name');
        if (elGpu) elGpu.innerText = info.gpuName || 'Integrated Graphics';

        const elVram = document.getElementById('vram-val');
        if (elVram) elVram.innerText = info.vram || 'N/A';

        const diskName = info.totalDisk || info.diskName || 'N/A';
        const elDisk = document.getElementById('disk-name');
        if (elDisk) elDisk.innerText = diskName;

        const statDisk = document.getElementById('stat-ssd-name');
        if (statDisk) statDisk.textContent = diskName;
    },
    
    updatePerformanceStats(perf) {
        const cpuUsage = clampPercent(perf.cpu);
        const cpuGauge = document.getElementById('stat-cpu-gauge');
        setGauge(cpuGauge, cpuUsage, 55);

        const elCpuPercent = document.getElementById('stat-cpu-percent');
        if (elCpuPercent) elCpuPercent.textContent = `${cpuUsage}%`;

        const elCpuFreq = document.getElementById('stat-cpu-freq');
        if (elCpuFreq) {
            if (perf.cpuFreqCurrent && perf.cpuFreqMax) {
                elCpuFreq.textContent = `${perf.cpuFreqCurrent}/${perf.cpuFreqMax} GHz`;
            } else if (perf.cpuTemp) {
                elCpuFreq.textContent = `Temp ${perf.cpuTemp}°C`;
            } else {
                elCpuFreq.textContent = '--';
            }
        }

        const elCpuBadge = document.getElementById('stat-cpu-badge');
        if (elCpuBadge) {
            const state = getState(cpuUsage);
            elCpuBadge.className = `stat-badge state-${state}`;
            elCpuBadge.textContent = getStateLabel(cpuUsage, {
                ok: 'Normal',
                warn: 'Moderate',
                danger: 'High',
            });
        }

        const gpuUsage = clampPercent(perf.gpu);
        setBarFill(document.getElementById('stat-gpu-bar'), gpuUsage);
        const elGpuPercent = document.getElementById('stat-gpu-percent');
        if (elGpuPercent) elGpuPercent.textContent = `${gpuUsage}%`;

        const elGpuBadge = document.getElementById('stat-gpu-badge');
        if (elGpuBadge) {
            const state = getState(gpuUsage);
            elGpuBadge.className = `stat-badge state-${state}`;
            elGpuBadge.textContent = getStateLabel(gpuUsage, {
                ok: 'Idle',
                warn: 'Active',
                danger: 'Busy',
            });
        }

        const elGpuInfo = document.getElementById('stat-gpu-info');
        if (elGpuInfo) {
            if (perf.gpuClock !== undefined && perf.gpuClockMax !== undefined) {
                elGpuInfo.textContent = `${perf.gpuClock}/${perf.gpuClockMax} MHz`;
            } else if (perf.vramUsedGB !== undefined && perf.vramTotalGB !== undefined) {
                elGpuInfo.textContent = `${Number(perf.vramUsedGB).toFixed(1)}/${Number(perf.vramTotalGB).toFixed(1)} GB`;
            } else {
                elGpuInfo.textContent = '--';
            }
        }

        const ramUsage = clampPercent(perf.ram);
        setBarFill(document.getElementById('stat-ram-bar'), ramUsage);
        const elRamPercent = document.getElementById('stat-ram-percent');
        if (elRamPercent) elRamPercent.textContent = `${ramUsage}%`;

        const elRamBadge = document.getElementById('stat-ram-badge');
        if (elRamBadge) {
            const state = getState(ramUsage);
            elRamBadge.className = `stat-badge state-${state}`;
            elRamBadge.textContent = getStateLabel(ramUsage, {
                ok: 'OK',
                warn: 'High',
                danger: 'Critical',
            });
        }

        const elRamAbs = document.getElementById('stat-ram-abs');
        if (elRamAbs && perf.ramUsedGB !== undefined && perf.ramTotalGB !== undefined) {
            elRamAbs.textContent = `${Number(perf.ramUsedGB).toFixed(1)} / ${Number(perf.ramTotalGB).toFixed(1)} GB`;
        } else if (elRamAbs) {
            elRamAbs.textContent = '--';
        }

        const diskUsage = clampPercent(perf.diskUsage);
        const ssdGauge = document.getElementById('stat-ssd-gauge');
        setGauge(ssdGauge, diskUsage, 44);
        const elSsdPercent = document.getElementById('stat-ssd-percent');
        if (elSsdPercent) elSsdPercent.textContent = `${diskUsage}%`;

        const elSsdAbs = document.getElementById('stat-ssd-abs');
        if (elSsdAbs && perf.diskUsedGB !== undefined && perf.diskTotalGB !== undefined) {
            elSsdAbs.textContent = `${Number(perf.diskUsedGB).toFixed(0)} / ${Number(perf.diskTotalGB).toFixed(0)} GB`;
        } else if (elSsdAbs) {
            elSsdAbs.textContent = '--';
        }

        const elSsdBadge = document.getElementById('stat-ssd-badge');
        if (elSsdBadge) {
            const state = getState(diskUsage);
            elSsdBadge.className = `stat-badge state-${state}`;
            elSsdBadge.textContent = getStateLabel(diskUsage, {
                ok: 'Healthy',
                warn: 'Low',
                danger: 'Full',
            });
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