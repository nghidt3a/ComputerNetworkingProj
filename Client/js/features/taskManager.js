import { SocketService } from '../services/socket.js';

const AUTO_REFRESH_MS = 5000;
let currentMode = "processes"; // apps | processes
let autoRefreshTimer = null;

export const TaskManagerFeature = {
    init() {
        // Handle APP_LIST event
        SocketService.on('APP_LIST', (data) => {
            console.log("APP_LIST received:", data);
            if(currentMode === "apps" && this.isProcessesTabActive()) {
                const dataList = data.payload || data;
                this.render(dataList);
            }
        });

        // Handle PROCESS_LIST event
        SocketService.on('PROCESS_LIST', (data) => {
            console.log("PROCESS_LIST received:", data);
            if(currentMode === "processes" && this.isProcessesTabActive()) {
                const dataList = data.payload || data;
                this.render(dataList);
            }
        });

        // Setup button click handlers
        document.getElementById('btn-get-apps')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchMode('apps', { refreshNow: true });
        });

        document.getElementById('btn-get-processes')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.switchMode('processes', { refreshNow: true });
        });

        this.setupTabSync();

        if (this.isProcessesTabActive()) {
            this.startAutoRefresh({ refreshNow: true });
        }
    },

    switchMode(mode, { refreshNow = false } = {}) {
        currentMode = mode;
        this.updateModeButtons();

        if (refreshNow) {
            this.requestCurrentMode();
        }

        if (this.isProcessesTabActive()) {
            this.startAutoRefresh();
        }
    },

    setupTabSync() {
        const navButtons = document.querySelectorAll('[data-tab]');

        navButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-tab');
                if (targetId === 'processes') {
                    this.startAutoRefresh({ refreshNow: true });
                } else {
                    this.stopAutoRefresh();
                }
            });
        });
    },

    requestCurrentMode() {
        if (currentMode === 'apps') {
            console.log("Requesting GET_APPS");
            SocketService.send('GET_APPS');
        } else {
            console.log("Requesting GET_PROCESS");
            SocketService.send('GET_PROCESS');
        }
    },

    startAutoRefresh({ refreshNow = false } = {}) {
        this.stopAutoRefresh();

        if (refreshNow) {
            this.requestCurrentMode();
        }

        autoRefreshTimer = setInterval(() => {
            if (this.isProcessesTabActive()) {
                this.requestCurrentMode();
            } else {
                this.stopAutoRefresh();
            }
        }, AUTO_REFRESH_MS);
    },

    stopAutoRefresh() {
        if (autoRefreshTimer) {
            clearInterval(autoRefreshTimer);
            autoRefreshTimer = null;
        }
    },

    isProcessesTabActive() {
        return document.getElementById('tab-processes')?.classList.contains('active');
    },

    updateModeButtons() {
        const appsBtn = document.getElementById('btn-get-apps');
        const processesBtn = document.getElementById('btn-get-processes');

        if (appsBtn) {
            appsBtn.classList.toggle('btn-primary', currentMode === 'apps');
            appsBtn.classList.toggle('btn-outline-primary', currentMode !== 'apps');
        }

        if (processesBtn) {
            processesBtn.classList.toggle('btn-secondary', currentMode === 'processes');
            processesBtn.classList.toggle('btn-outline-secondary', currentMode !== 'processes');
        }
    },

    render(dataList) {
        if (!Array.isArray(dataList)) {
            console.warn("Invalid data list:", dataList);
            return;
        }

        const tbody = document.querySelector("#procTable tbody");
        if(!tbody) {
            console.error("procTable tbody not found");
            return;
        }
        
        tbody.innerHTML = "";
        
        if (dataList.length === 0) {
            const tr = document.createElement("tr");
            tr.innerHTML = '<td colspan="4" class="text-center">No data found</td>';
            tbody.appendChild(tr);
            return;
        }
        
        dataList.forEach((item) => {
            const tr = document.createElement("tr");

            // ID
            const tdId = document.createElement("td");
            tdId.innerHTML = `<span class="badge bg-secondary">${item.id}</span>`;
            
            // Name (Safe)
            const tdName = document.createElement("td");
            tdName.className = "fw-bold";
            tdName.textContent = item.title || item.name || "Unknown";

            // Memory
            const tdMem = document.createElement("td");
            tdMem.textContent = item.memory || "N/A";

            // Action
            const tdAction = document.createElement("td");
            const btnKill = document.createElement("button");
            btnKill.className = "btn btn-danger btn-sm";
            btnKill.innerHTML = '<i class="fas fa-trash"></i> Kill';
            btnKill.onclick = () => {
                if(confirm(`Kill process ID ${item.id}?`)) {
                    SocketService.send('KILL', item.id.toString());
                }
            };
            tdAction.appendChild(btnKill);

            tr.append(tdId, tdName, tdMem, tdAction);
            tbody.appendChild(tr);
        });
    }
};