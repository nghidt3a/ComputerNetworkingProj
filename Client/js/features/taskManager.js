import { SocketService } from "../services/socket.js";

const AUTO_REFRESH_MS = 5000;
let currentMode = "apps"; // apps | processes
let autoRefreshTimer = null;
let cachedApps = null;
let cachedProcesses = null;
let appFilter = "all"; // all | running | stopped
let searchTerm = ""; // search filter

export const TaskManagerFeature = {
  init() {
    // Handle APP_LIST event
    SocketService.on("APP_LIST", (data) => {
      const dataList = data.payload || data;
      if (Array.isArray(dataList)) {
        cachedApps = dataList;
      }
      if (currentMode === "apps" && this.isProcessesTabActive()) {
        this.renderCached(); // Use renderCached to apply filter
      }
    });

    // Handle PROCESS_LIST event
    SocketService.on("PROCESS_LIST", (data) => {
      const dataList = data.payload || data;
      if (Array.isArray(dataList)) {
        cachedProcesses = dataList;
      }
      if (currentMode === "processes" && this.isProcessesTabActive()) {
        this.renderCached(); // Use renderCached to apply search filter
      }
    });

    SocketService.on("AUTH_SUCCESS", () => {
      this.prefetchData();
    });

    // Setup button click handlers
    document.getElementById("btn-get-apps")?.addEventListener("click", (e) => {
      e.preventDefault();
      this.switchMode("apps", { refreshNow: true });
    });

    document
      .getElementById("btn-get-processes")
      ?.addEventListener("click", (e) => {
        e.preventDefault();
        this.switchMode("processes", { refreshNow: true });
      });

    // Setup filter buttons
    document
      .getElementById("btn-filter-all")
      ?.addEventListener("click", (e) => {
        e.preventDefault();
        this.setFilter("all");
      });
    document
      .getElementById("btn-filter-running")
      ?.addEventListener("click", (e) => {
        e.preventDefault();
        this.setFilter("running");
      });
    document
      .getElementById("btn-filter-stopped")
      ?.addEventListener("click", (e) => {
        e.preventDefault();
        this.setFilter("stopped");
      });

    // Setup search input
    const searchInput = document.getElementById("task-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        searchTerm = e.target.value.toLowerCase();
        this.renderCached();
      });
    }

    this.setupTabSync();
    this.updateModeButtons();
    this.updateFilterButtons();

    if (this.isProcessesTabActive()) {
      this.startAutoRefresh({ refreshNow: true });
    }
  },

  switchMode(mode, { refreshNow = false } = {}) {
    currentMode = mode;
    appFilter = "all";
    searchTerm = "";

    // Clear search input
    const searchInput = document.getElementById("task-search-input");
    if (searchInput) {
      searchInput.value = "";
      searchInput.placeholder =
        mode === "apps" ? "Search apps..." : "Search processes...";
    }

    this.updateModeButtons();
    this.updateFilterSection();
    this.updateFilterButtons();
    this.updateTableHeader();
    this.renderCached();

    if (refreshNow) {
      this.requestCurrentMode(true); // Log when manually clicking button
    }

    if (this.isProcessesTabActive()) {
      this.startAutoRefresh();
    }
  },

  setFilter(filter) {
    appFilter = filter;
    this.updateFilterButtons();
    this.renderCached();
  },

  updateFilterSection() {
    const filterSection = document.getElementById("search-filter-section");
    const statusFilterButtons = document.getElementById(
      "status-filter-buttons"
    );

    if (filterSection) {
      filterSection.style.display = "block";
    }

    // Hide status filter buttons for processes mode
    if (statusFilterButtons) {
      statusFilterButtons.style.display =
        currentMode === "apps" ? "flex" : "none";
    }
  },

  updateFilterButtons() {
    const btnAll = document.getElementById("btn-filter-all");
    const btnRunning = document.getElementById("btn-filter-running");
    const btnStopped = document.getElementById("btn-filter-stopped");

    if (btnAll) {
      btnAll.classList.toggle("btn-primary", appFilter === "all");
      btnAll.classList.toggle("btn-outline-primary", appFilter !== "all");
    }
    if (btnRunning) {
      btnRunning.classList.toggle("btn-success", appFilter === "running");
      btnRunning.classList.toggle(
        "btn-outline-success",
        appFilter !== "running"
      );
    }
    if (btnStopped) {
      btnStopped.classList.toggle("btn-secondary", appFilter === "stopped");
      btnStopped.classList.toggle(
        "btn-outline-secondary",
        appFilter !== "stopped"
      );
    }
  },

  updateTableHeader() {
    const thead = document.querySelector("#procTable thead tr");
    if (!thead) return;

    if (currentMode === "apps") {
      // Apps mode: 5 columns with Status
      thead.innerHTML = `
        <th>ID</th>
        <th>Name / Title</th>
        <th>Memory</th>
        <th>Status</th>
        <th>Action</th>
      `;
    } else {
      // Process mode: 4 columns without Status
      thead.innerHTML = `
        <th>ID</th>
        <th>Name / Title</th>
        <th>Memory</th>
        <th>Action</th>
      `;
    }
  },

  setupTabSync() {
    const navButtons = document.querySelectorAll("[data-tab]");

    navButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-tab");
        if (targetId === "processes") {
          this.onProcessesTabActivated();
        } else {
          this.stopAutoRefresh();
        }
      });
    });
  },

  requestCurrentMode(logToConsole = false) {
    if (currentMode === "apps") {
      if (logToConsole) console.log("Requesting GET_APPS");
      SocketService.send("GET_APPS");
    } else {
      if (logToConsole) console.log("Requesting GET_PROCESS");
      SocketService.send("GET_PROCESS");
    }
  },

  startAutoRefresh({ refreshNow = false } = {}) {
    this.stopAutoRefresh();

    if (refreshNow) {
      this.requestCurrentMode(true); // Log first manual request
    }

    autoRefreshTimer = setInterval(() => {
      if (this.isProcessesTabActive()) {
        this.requestCurrentMode(false); // Don't log auto-refresh requests
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
    return document
      .getElementById("tab-processes")
      ?.classList.contains("active");
  },

  updateModeButtons() {
    const appsBtn = document.getElementById("btn-get-apps");
    const processesBtn = document.getElementById("btn-get-processes");

    if (appsBtn) {
      appsBtn.classList.toggle("btn-primary", currentMode === "apps");
      appsBtn.classList.toggle("btn-outline-primary", currentMode !== "apps");
    }

    if (processesBtn) {
      processesBtn.classList.toggle(
        "btn-secondary",
        currentMode === "processes"
      );
      processesBtn.classList.toggle(
        "btn-outline-secondary",
        currentMode !== "processes"
      );
    }
  },

  onProcessesTabActivated() {
    this.updateFilterSection();
    this.renderCached();
    this.startAutoRefresh({ refreshNow: true });
  },

  render(dataList) {
    if (!Array.isArray(dataList)) {
      console.warn("Invalid data list:", dataList);
      return;
    }

    const tbody = document.querySelector("#procTable tbody");
    if (!tbody) {
      console.error("procTable tbody not found");
      return;
    }

    tbody.innerHTML = "";

    if (dataList.length === 0) {
      const tr = document.createElement("tr");
      const colspan = currentMode === "apps" ? "5" : "4";
      tr.innerHTML = `<td colspan="${colspan}" class="text-center">No data found</td>`;
      tbody.appendChild(tr);
      return;
    }

    dataList.forEach((item) => {
      const tr = document.createElement("tr");

      // ID
      const tdId = document.createElement("td");
      if (item.id > 0) {
        tdId.innerHTML = `<span class="badge bg-secondary">${item.id}</span>`;
      } else {
        tdId.innerHTML = `<span class="badge bg-light text-dark">-</span>`;
      }

      // Name (Safe)
      const tdName = document.createElement("td");
      tdName.className = "fw-bold";
      tdName.textContent = item.title || item.name || "Unknown";

      // Memory
      const tdMem = document.createElement("td");
      tdMem.textContent = item.memory || "N/A";

      // Status (chỉ hiển thị cho Apps mode)
      let tdStatus = null;
      if (currentMode === "apps") {
        tdStatus = document.createElement("td");
        if (item.status === "running") {
          tdStatus.innerHTML =
            '<span class="badge bg-success"><i class="fas fa-circle"></i> Running</span>';
        } else {
          tdStatus.innerHTML =
            '<span class="badge bg-secondary"><i class="fas fa-circle"></i> Stopped</span>';
        }
      }

      // Action
      const tdAction = document.createElement("td");

      if (currentMode === "apps" && item.status) {
        // Apps mode: Start/Stop buttons
        if (item.status === "running") {
          const btnStop = document.createElement("button");
          btnStop.className = "btn btn-warning btn-sm";
          btnStop.innerHTML = '<i class="fas fa-stop"></i> Stop';
          btnStop.onclick = () => {
            SocketService.send("KILL", item.id.toString());
          };
          tdAction.appendChild(btnStop);
        } else {
          const btnStart = document.createElement("button");
          btnStart.className = "btn btn-success btn-sm";
          btnStart.innerHTML = '<i class="fas fa-play"></i> Start';
          btnStart.onclick = () => {
            SocketService.send("START_APP", item.path || item.name);
          };
          tdAction.appendChild(btnStart);
        }
      } else {
        // Processes mode: Kill button
        const btnKill = document.createElement("button");
        btnKill.className = "btn btn-danger btn-sm";
        btnKill.innerHTML = '<i class="fas fa-trash"></i> Kill';
        btnKill.onclick = () => {
          if (confirm(`Kill process ID ${item.id}?`)) {
            SocketService.send("KILL", item.id.toString());
          }
        };
        tdAction.appendChild(btnKill);
      }

      if (currentMode === "apps") {
        tr.append(tdId, tdName, tdMem, tdStatus, tdAction);
      } else {
        tr.append(tdId, tdName, tdMem, tdAction);
      }
      tbody.appendChild(tr);
    });
  },

  renderCached() {
    let cachedList = currentMode === "apps" ? cachedApps : cachedProcesses;

    if (Array.isArray(cachedList)) {
      // Apply status filter (only for apps mode)
      if (currentMode === "apps" && appFilter !== "all") {
        cachedList = cachedList.filter((app) => app.status === appFilter);
      }

      // Apply search filter (for both modes)
      if (searchTerm) {
        cachedList = cachedList.filter((item) => {
          const name = (item.name || "").toLowerCase();
          const title = (item.title || "").toLowerCase();
          return name.includes(searchTerm) || title.includes(searchTerm);
        });
      }
    }

    if (Array.isArray(cachedList)) {
      this.render(cachedList);
    }
  },

  prefetchData() {
    SocketService.send("GET_APPS");
    SocketService.send("GET_PROCESS");
  },
};
