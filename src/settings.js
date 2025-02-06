// 导入所需的依赖
import { ICONS } from './icons.js';

// 设置管理器类
class SettingsManager {
  constructor() {
    this.settingsModal = document.getElementById('settings-modal');
    this.settingsIcon = document.querySelector('.settings-icon a');
    this.closeButton = document.querySelector('.settings-modal-close');
    this.tabButtons = document.querySelectorAll('.settings-tab-button');
    this.tabContents = document.querySelectorAll('.settings-tab-content');
    this.bgOptions = document.querySelectorAll('.settings-bg-option');
    this.enableFloatingBallCheckbox = document.getElementById('enable-floating-ball');
    this.enableQuickLinksCheckbox = document.getElementById('enable-quick-links');
    this.openInNewTabCheckbox = document.getElementById('open-in-new-tab');
    this.init();
  }

  init() {
    // 初始化事件监听
    this.initEventListeners();
    // 加载已保存的设置
    this.loadSavedSettings();
    // 初始化主题
    this.initTheme();
    this.initQuickLinksSettings();
    this.initFloatingBallSettings();
    this.initBookmarkManagementTab();
    this.initLinkOpeningSettings();
  }

  initEventListeners() {
    // 打开设置模态框
    this.settingsIcon.addEventListener('click', (e) => {
      e.preventDefault();
      this.settingsModal.style.display = 'block';
    });

    // 关闭设置模态框
    this.closeButton.addEventListener('click', () => {
      this.settingsModal.style.display = 'none';
    });

    // 点击模态框外部关闭
    window.addEventListener('click', (e) => {
      if (e.target === this.settingsModal) {
        this.settingsModal.style.display = 'none';
      }
    });

    // 标签切换
    this.tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tabName = button.getAttribute('data-tab');
        this.switchTab(tabName);
      });
    });

    // 背景颜色选择
    this.bgOptions.forEach(option => {
      option.addEventListener('click', () => this.handleBackgroundChange(option));
    });

    // 悬浮球设置
    this.enableFloatingBallCheckbox.addEventListener('change', () => {
      chrome.storage.sync.set({
        enableFloatingBall: this.enableFloatingBallCheckbox.checked
      });
    });
  }

  switchTab(tabName) {
    this.tabButtons.forEach(btn => btn.classList.remove('active'));
    this.tabContents.forEach(content => content.classList.remove('active'));

    const selectedButton = document.querySelector(`[data-tab="${tabName}"]`);
    const selectedContent = document.getElementById(`${tabName}-settings`);

    selectedButton.classList.add('active');
    selectedContent.classList.add('active');
  }

  handleBackgroundChange(option) {
    const bgClass = option.getAttribute('data-bg');
    
    // 移除所有背景选项的 active 状态
    this.bgOptions.forEach(opt => opt.classList.remove('active'));
    
    // 添加当前选项的 active 状态
    option.classList.add('active');
    
    document.documentElement.className = bgClass;
    localStorage.setItem('selectedBackground', bgClass);
    localStorage.setItem('useDefaultBackground', 'true');
    
    // 清除壁纸相关的状态
    this.clearWallpaper();
  }

  clearWallpaper() {
    document.querySelectorAll('.wallpaper-option').forEach(opt => {
      opt.classList.remove('active');
    });

    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.style.backgroundImage = 'none';
      document.body.style.backgroundImage = 'none';
    }
    localStorage.removeItem('originalWallpaper');

    // 更新欢迎消息颜色
    const welcomeElement = document.getElementById('welcome-message');
    if (welcomeElement && window.WelcomeManager) {
      window.WelcomeManager.adjustTextColor(welcomeElement);
    }
  }

  loadSavedSettings() {
    // 加载悬浮球设置
    chrome.storage.sync.get(['enableFloatingBall'], (result) => {
      this.enableFloatingBallCheckbox.checked = result.enableFloatingBall !== false;
    });

    // 加载背景设置
    const savedBg = localStorage.getItem('selectedBackground');
    if (savedBg) {
      document.documentElement.className = savedBg;
      this.bgOptions.forEach(option => {
        if (option.getAttribute('data-bg') === savedBg) {
          option.classList.add('active');
        }
      });
    }
  }

  initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
      this.updateThemeIcon(savedTheme === 'dark');
    }
  }

  updateThemeIcon(isDark) {
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (!themeToggleBtn) return;
    
    themeToggleBtn.innerHTML = isDark ? ICONS.dark_mode : ICONS.light_mode;
  }

  initQuickLinksSettings() {
    // 加载快捷链接设置
    chrome.storage.sync.get(['enableQuickLinks'], (result) => {
      this.enableQuickLinksCheckbox.checked = result.enableQuickLinks !== false;
      this.toggleQuickLinksVisibility(this.enableQuickLinksCheckbox.checked);
    });

    // 监听快捷链接设置变化
    this.enableQuickLinksCheckbox.addEventListener('change', () => {
      const isEnabled = this.enableQuickLinksCheckbox.checked;
      chrome.storage.sync.set({ enableQuickLinks: isEnabled }, () => {
        this.toggleQuickLinksVisibility(isEnabled);
      });
    });
  }

  toggleQuickLinksVisibility(show) {
    const quickLinksWrapper = document.querySelector('.quick-links-wrapper');
    if (quickLinksWrapper) {
      quickLinksWrapper.style.display = show ? 'flex' : 'none';
    }
  }

  initFloatingBallSettings() {
    // 加载悬浮球设置
    chrome.storage.sync.get(['enableFloatingBall'], (result) => {
      this.enableFloatingBallCheckbox.checked = result.enableFloatingBall !== false;
    });

    // 监听悬浮球设置变化
    this.enableFloatingBallCheckbox.addEventListener('change', () => {
      const isEnabled = this.enableFloatingBallCheckbox.checked;
      // 发送消息到 background script
      chrome.runtime.sendMessage({
        action: 'updateFloatingBallSetting',
        enabled: isEnabled
      }, () => {
        // 保存设置到 storage
        chrome.storage.sync.set({ enableFloatingBall: isEnabled });
      });
    });
  }

  initLinkOpeningSettings() {
    // 加载链接打开方式设置
    chrome.storage.sync.get(['openInNewTab'], (result) => {
      this.openInNewTabCheckbox.checked = result.openInNewTab !== false;
    });

    // 监听设置变化
    this.openInNewTabCheckbox.addEventListener('change', () => {
      const isEnabled = this.openInNewTabCheckbox.checked;
      chrome.storage.sync.set({ openInNewTab: isEnabled });
    });
  }


  initBookmarkManagementTab() {
    const tabButton = document.querySelector('[data-tab="bookmark-management"]');
    if (tabButton) {
      tabButton.addEventListener('click', () => {
        this.switchTab('bookmark-management');
      });
    }
  }
}

// 导出设置管理器实例
export const settingsManager = new SettingsManager(); 