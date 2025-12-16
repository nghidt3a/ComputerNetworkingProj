/**
 * SIMPLIFIED NAVIGATION - No Animations
 * Dùng để test xem chức năng cơ bản có hoạt động không
 *
 * USAGE:
 * 1. Import trong main.js: import { setupSimpleNavigation } from './navigation-simple.js';
 * 2. Thay thế setupNavigation() bằng setupSimpleNavigation()
 * 3. Nếu hoạt động, vấn đề là do animations. Nếu không, vấn đề khác.
 */

export function setupSimpleNavigation() {
  console.log("=== SIMPLE NAVIGATION INITIALIZED ===");

  // Find all navigation buttons (support both old and new structure)
  const navButtons = document.querySelectorAll("[data-tab]");

  console.log(`Found ${navButtons.length} navigation buttons`);

  if (navButtons.length === 0) {
    console.error("No navigation buttons found! Check HTML structure.");
    return;
  }

  // Attach click handlers
  navButtons.forEach((btn, index) => {
    const targetId = btn.getAttribute("data-tab");
    console.log(`Button ${index + 1}: ${targetId}`);

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      handleTabChange(targetId, btn);
    });
  });

  // Disconnect button
  const disconnectBtn = document.getElementById("btn-disconnect");
  if (disconnectBtn) {
    console.log("Disconnect button found");
    disconnectBtn.addEventListener("click", handleDisconnect);
  } else {
    console.warn("Disconnect button NOT found");
  }
}

/**
 * Handle tab change - Simple version without animations
 */
function handleTabChange(targetId, clickedBtn) {
  console.log(`\n=== TAB CHANGE: ${targetId} ===`);

  // 1. Find target tab
  const targetTab = document.getElementById(`tab-${targetId}`);

  if (!targetTab) {
    console.error(`Target tab not found: tab-${targetId}`);
    return;
  }

  console.log("Target tab found:", targetTab.id);

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
  console.log("Active class added to button");

  // 5. Add active class to target tab
  targetTab.classList.add("active");
  console.log("Active class added to tab");

  // 6. Update page title
  const titleMap = {
    dashboard: "Overview",
    monitor: "Screen Monitor",
    webcam: "Webcam Control",
    processes: "Process Manager",
    files: "File Explorer",
    terminal: "Terminal Logs",
    audio: "Audio Recorder",
  };

  const newTitle = titleMap[targetId] || "RCS";
  const pageTitleEl = document.getElementById("page-title");

  if (pageTitleEl) {
    pageTitleEl.innerText = newTitle;
    console.log(`Title updated to: ${newTitle}`);
  }

  // 6.1 Update breadcrumb to be consistent and professional
  const breadcrumbCurrent = document.getElementById("breadcrumb-current");
  if (breadcrumbCurrent) {
    breadcrumbCurrent.textContent = newTitle;
  }
  // Keep the root breadcrumb stable (e.g., "Pages")
  const breadcrumbRoot = document.getElementById("breadcrumb-root");
  if (breadcrumbRoot && breadcrumbRoot.textContent.trim().length === 0) {
    breadcrumbRoot.textContent = "Pages";
  }

  // 7. Verify final state
  console.log(
    "Active button:",
    document.querySelector("[data-tab].active")?.getAttribute("data-tab")
  );
  console.log("Active tab:", document.querySelector(".tab-content.active")?.id);
  console.log("=== TAB CHANGE COMPLETE ===\n");
}

/**
 * Handle disconnect
 */
function handleDisconnect() {
  console.log("=== DISCONNECT CLICKED ===");

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
  console.log("\n=== NAVIGATION DEBUG INFO ===");

  const buttons = document.querySelectorAll("[data-tab]");
  console.log(`Navigation Buttons: ${buttons.length}`);
  buttons.forEach((btn, i) => {
    console.log(
      `  ${i + 1}. ${btn.getAttribute(
        "data-tab"
      )} - Active: ${btn.classList.contains("active")}`
    );
  });

  const tabs = document.querySelectorAll(".tab-content");
  console.log(`\nTab Contents: ${tabs.length}`);
  tabs.forEach((tab, i) => {
    const display = window.getComputedStyle(tab).display;
    console.log(
      `  ${i + 1}. ${tab.id} - Active: ${tab.classList.contains(
        "active"
      )}, Display: ${display}`
    );
  });

  console.log("\nCurrent Active:");
  console.log(
    "  Button:",
    document.querySelector("[data-tab].active")?.getAttribute("data-tab") ||
      "None"
  );
  console.log(
    "  Tab:",
    document.querySelector(".tab-content.active")?.id || "None"
  );

  console.log("=== END DEBUG INFO ===\n");
};

// Auto-run debug on load
setTimeout(() => {
  console.log("Run window.debugNavigation() in console to check state");
}, 1000);
