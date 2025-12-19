/**
 * SIMPLIFIED NAVIGATION - No Animations
 * Dùng để test xem chức năng cơ bản có hoạt động không
 *
 * USAGE:
 * 1. Import trong main.js: import { setupSimpleNavigation } from './navigation-simple.js';
 * 2. Thay thế setupNavigation() bằng setupSimpleNavigation()
 * 3. Nếu hoạt động, vấn đề là do animations. Nếu không, vấn đề khác.
 */

import { Logger } from "./utils/logger.js";

const subtitleMap = {
  dashboard: "Tổng quan hệ thống điều khiển từ xa",
  monitor: "Giám sát màn hình theo thời gian thực",
  webcam: "Theo dõi webcam và ghi hình an toàn",
  audio: "Ghi âm và phát lại âm thanh từ xa",
  processes: "Quản lý tiến trình, ứng dụng và tài nguyên",
  files: "Duyệt, tải lên và tải xuống tệp",
  terminal: "Theo dõi log và lệnh hệ thống",
};

let heroSubtitleEl = null;

export function setupSimpleNavigation() {
  Logger.header("Navigation Initialized");

  // Find all navigation buttons (support both old and new structure)
  const navButtons = document.querySelectorAll("[data-tab]");
  heroSubtitleEl = document.getElementById("hero-subtitle");

  Logger.info(`Found ${navButtons.length} navigation buttons`);

  if (navButtons.length === 0) {
    Logger.error("No navigation buttons found! Check HTML structure.");
    return;
  }

  // Update tab names
  navButtons.forEach((button) => {
    if (button.dataset.tab === "Remote System") {
      button.dataset.tab = "Overview";
      button.textContent = "Overview"; // Cập nhật văn bản hiển thị
    }
  });

  // Attach click handlers
  navButtons.forEach((btn, index) => {
    const targetId = btn.getAttribute("data-tab");
    Logger.navigation(targetId);

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      handleTabChange(targetId, btn);
    });
  });

  // Set initial subtitle based on the active tab (fallback to dashboard)
  const activeBtn =
    document.querySelector("[data-tab].active") || navButtons[0];
  if (activeBtn) {
    const initialTab = activeBtn.getAttribute("data-tab") || "dashboard";
    updateHeroSubtitle(initialTab);
  }

  // Disconnect button
  const disconnectBtn = document.getElementById("btn-disconnect");
  if (disconnectBtn) {
    Logger.debug("Disconnect button found");
    disconnectBtn.addEventListener("click", handleDisconnect);
  } else {
    Logger.warning("Disconnect button NOT found");
  }
}

/**
 * Handle tab change - Simple version without animations
 */
function handleTabChange(targetId, clickedBtn) {
  Logger.navigation(targetId);

  // 1. Find target tab
  const targetTab = document.getElementById(`tab-${targetId}`);

  if (!targetTab) {
    Logger.error(`Target tab not found: tab-${targetId}`);
    return;
  }

  Logger.debug("Target tab found", targetTab.id);

  // 2. Remove all active classes from navigation buttons
  document.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.classList.remove("active");
  });

  // 3. Remove all active classes from tabs
  document.querySelectorAll(".tab-content").forEach((tab) => {
    tab.classList.remove("active");
  });

  // 4. Add active class to clicked button
  clickedBtn.classList.add("active");
  Logger.debug("Active class added to button");

  // 5. Add active class to target tab
  targetTab.classList.add("active");
  Logger.debug("Active class added to tab");

  // 6. Update hero subtitle per tab
  updateHeroSubtitle(targetId);

  // 7. Verify final state
  Logger.debug(
    "Active button",
    document.querySelector("[data-tab].active")?.getAttribute("data-tab")
  );
  Logger.debug("Active tab", document.querySelector(".tab-content.active")?.id);
  Logger.separator();
}

function updateHeroSubtitle(tabId) {
  if (!heroSubtitleEl) return;
  heroSubtitleEl.textContent =
    subtitleMap[tabId] || "Tổng quan hệ thống điều khiển từ xa";
}

/**
 * Handle disconnect
 */
function handleDisconnect() {
  Logger.warning("Disconnect clicked");

  // Import SocketService dynamically to avoid circular dependencies
  import("./services/socket.js").then(({ SocketService }) => {
    SocketService.disconnect();
  });

  // Import UIManager dynamically
  import("./utils/ui.js").then(({ UIManager }) => {
    UIManager.showLoginScreen();
  });
}

/**
 * Debug helper - Call this from console to check state
 */
window.debugNavigation = function () {
  Logger.header("Navigation Debug Info");

  const buttons = document.querySelectorAll("[data-tab]");
  Logger.info(`Navigation Buttons: ${buttons.length}`);
  buttons.forEach((btn, i) => {
    Logger.debug(
      `Button ${i + 1}`,
      `${btn.getAttribute("data-tab")} - Active: ${btn.classList.contains(
        "active"
      )}`
    );
  });

  const tabs = document.querySelectorAll(".tab-content");
  Logger.info(`Tab Contents: ${tabs.length}`);
  tabs.forEach((tab, i) => {
    const display = window.getComputedStyle(tab).display;
    Logger.debug(
      `Tab ${i + 1}`,
      `${tab.id} - Active: ${tab.classList.contains(
        "active"
      )}, Display: ${display}`
    );
  });

  Logger.info("Current Active:");
  Logger.debug(
    "Button",
    document.querySelector("[data-tab].active")?.getAttribute("data-tab") ||
      "None"
  );
  Logger.debug(
    "Tab",
    document.querySelector(".tab-content.active")?.id || "None"
  );

  Logger.separator();
};

// Auto-run debug on load
setTimeout(() => {
  Logger.info("Run window.debugNavigation() in console to check state");
}, 1000);
