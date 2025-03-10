// 导入所需的依赖
import { ICONS } from './icons.js';

// 设置管理器类
class SettingsManager {
  constructor() {
    this.settingsModal = document.getElementById('settings-modal');
    this.settingsSidebar = document.getElementById('settings-sidebar');
    this.settingsOverlay = document.getElementById('settings-overlay');
    this.settingsIcon = document.querySelector('.settings-icon a');
    this.closeButton = document.querySelector('.settings-sidebar-close');
    this.tabButtons = document.querySelectorAll('.settings-tab-button');
    this.tabContents = document.querySelectorAll('.settings-tab-content');
    this.bgOptions = document.querySelectorAll('.settings-bg-option');
    this.enableFloatingBallCheckbox = document.getElementById('enable-floating-ball');
    this.enableQuickLinksCheckbox = document.getElementById('enable-quick-links');
    this.openInNewTabCheckbox = document.getElementById('open-in-new-tab');
    
    // 侧边栏模式下的链接打开方式设置元素可能不存在于所有页面
    // 添加安全检查，避免在元素不存在时出错
    const sidepanelOpenInNewTab = document.getElementById('sidepanel-open-in-new-tab');
    const sidepanelOpenInSidepanel = document.getElementById('sidepanel-open-in-sidepanel');
    
    this.sidepanelOpenInNewTabCheckbox = sidepanelOpenInNewTab;
    this.sidepanelOpenInSidepanelCheckbox = sidepanelOpenInSidepanel;
    
    this.widthSettings = document.getElementById('floating-width-settings');
    this.widthSlider = document.getElementById('width-slider');
    this.widthValue = document.getElementById('width-value');
    this.widthPreviewCount = document.getElementById('width-preview-count');
    this.settingsModalContent = document.querySelector('.settings-modal-content');
    this.showHistorySuggestionsCheckbox = document.getElementById('show-history-suggestions');
    this.showBookmarkSuggestionsCheckbox = document.getElementById('show-bookmark-suggestions');
    this.enableWheelSwitchingCheckbox = document.getElementById('enable-wheel-switching');
    this.openSearchInNewTabCheckbox = document.getElementById('open-search-in-new-tab');
    this.init();
  }

  init() {
    this.loadSavedSettings();
    this.initEventListeners();
    this.initTheme();
    
    // 只在相关元素存在时才调用各个初始化方法
    if (this.enableQuickLinksCheckbox) {
      this.initQuickLinksSettings();
    }
    
    if (this.enableFloatingBallCheckbox) {
      this.initFloatingBallSettings();
    }
    
    if (this.openInNewTabCheckbox || this.sidepanelOpenInNewTabCheckbox || this.sidepanelOpenInSidepanelCheckbox) {
      this.initLinkOpeningSettings();
    }
    
    // 检查书签管理相关元素
    const bookmarkCleanupButton = document.getElementById('open-bookmark-cleanup');
    if (bookmarkCleanupButton) {
      this.initBookmarkManagementTab();
    }
    
    // 检查宽度设置相关元素
    if (this.widthSlider && this.widthValue) {
      this.initBookmarkWidthSettings();
    }
    
    // 检查高度设置相关元素
    const heightSlider = document.getElementById('height-slider');
    const heightValue = document.getElementById('height-value');
    if (heightSlider && heightValue) {
      this.initCardHeightSettings();
    }
    
    // 检查容器宽度设置相关元素
    const containerWidthSlider = document.getElementById('container-width-slider');
    if (containerWidthSlider) {
      this.initContainerWidthSettings();
    }
    
    // 检查布局设置相关元素
    const showSearchBoxCheckbox = document.getElementById('show-search-box');
    const showWelcomeMessageCheckbox = document.getElementById('show-welcome-message');
    const showFooterCheckbox = document.getElementById('show-footer');
    if (showSearchBoxCheckbox || showWelcomeMessageCheckbox || showFooterCheckbox) {
      this.initLayoutSettings();
    }
    
    // 检查搜索建议设置相关元素
    if (this.showHistorySuggestionsCheckbox || this.showBookmarkSuggestionsCheckbox) {
      this.initSearchSuggestionsSettings();
    }
    
    // 检查滚轮切换设置相关元素
    if (this.enableWheelSwitchingCheckbox) {
      this.initWheelSwitchingTab();
    }
    
    // 检查快捷键设置相关元素
    const configureShortcuts = document.getElementById('configure-shortcuts');
    if (configureShortcuts) {
      this.initShortcutsSettings();
    }
  }

  initEventListeners() {
    // 打开设置侧边栏
    this.settingsIcon.addEventListener('click', (e) => {
      e.preventDefault();
      this.openSettingsSidebar();
    });

    // 关闭设置侧边栏
    if (this.closeButton) {
      this.closeButton.addEventListener('click', () => {
        this.closeSettingsSidebar();
        
        // 关闭侧边栏时更新欢迎消息
        if (window.WelcomeManager) {
          window.WelcomeManager.updateWelcomeMessage();
        }
      });
    }

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
    if (this.enableFloatingBallCheckbox) {
      this.enableFloatingBallCheckbox.addEventListener('change', () => {
        chrome.storage.sync.set({
          enableFloatingBall: this.enableFloatingBallCheckbox.checked
        });
      });
    }
    
    // 添加键盘事件监听，按ESC关闭侧边栏
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.settingsSidebar && this.settingsSidebar.classList.contains('open')) {
        this.closeSettingsSidebar();
      }
    });

    // 添加点击侧边栏外部关闭功能
    document.addEventListener('click', (e) => {
      // 如果侧边栏已打开，且点击的不是侧边栏内部元素
      if (this.settingsSidebar && 
          this.settingsSidebar.classList.contains('open') && 
          !this.settingsSidebar.contains(e.target) && 
          !this.settingsIcon.contains(e.target)) {
        this.closeSettingsSidebar();
        
        // 关闭侧边栏时更新欢迎消息
        if (window.WelcomeManager) {
          window.WelcomeManager.updateWelcomeMessage();
        }
      }
    });
    
    // 阻止侧边栏内部点击事件冒泡到文档
    this.settingsSidebar.addEventListener('click', (e) => {
      // 如果点击的是链接，不阻止事件冒泡
      if (e.target.tagName === 'A' || e.target.closest('a')) {
        return; // 允许链接点击事件正常传播
      }
      e.stopPropagation();
    });
    
    // 阻止设置图标点击事件冒泡到文档
    this.settingsIcon.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  // 打开设置侧边栏
  openSettingsSidebar() {
    if (this.settingsSidebar) {
      this.settingsSidebar.classList.add('open');
    }
  }
  
  // 关闭设置侧边栏
  closeSettingsSidebar() {
    if (this.settingsSidebar) {
      this.settingsSidebar.classList.remove('open');
    }
  }

  switchTab(tabName) {
    // 移除所有标签的 active 类
    this.tabButtons.forEach(button => {
      button.classList.remove('active');
    });
    
    // 移除所有内容的 active 类
    this.tabContents.forEach(content => {
      content.classList.remove('active');
    });
    
    // 添加当前标签的 active 类
    const selectedButton = document.querySelector(`[data-tab="${tabName}"]`);
    const selectedContent = document.getElementById(`${tabName}-settings`);
    
    if (selectedButton && selectedContent) {
      selectedButton.classList.add('active');
      selectedContent.classList.add('active');
      // 更新 UI 语言
      window.updateUILanguage();
      
      // 确保欢迎消息也被更新
      if (window.WelcomeManager) {
        window.WelcomeManager.updateWelcomeMessage();
      }
    }
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
    
    // 更新欢迎消息
    if (window.WelcomeManager) {
      window.WelcomeManager.updateWelcomeMessage();
    }
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
    const themeSelect = document.getElementById('theme-select');
    const savedTheme = localStorage.getItem('theme') || 'auto';
    
    // 设置下拉菜单的初始值
    themeSelect.value = savedTheme;
    
    // 如果是自动模式，根据系统主题设置初始主题
    if (savedTheme === 'auto') {
      this.setThemeBasedOnSystem();
    } else {
      document.documentElement.setAttribute('data-theme', savedTheme);
      this.updateThemeIcon(savedTheme === 'dark');
    }

    // 监听系统主题变化
    window.matchMedia('(prefers-color-scheme: dark)').addListener((e) => {
      if (localStorage.getItem('theme') === 'auto') {
        const isDark = e.matches;
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        this.updateThemeIcon(isDark);
      }
    });

    // 监听主题选择变化
    themeSelect.addEventListener('change', (e) => {
      const selectedTheme = e.target.value;
      localStorage.setItem('theme', selectedTheme);
      
      if (selectedTheme === 'auto') {
        this.setThemeBasedOnSystem();
      } else {
        document.documentElement.setAttribute('data-theme', selectedTheme);
        this.updateThemeIcon(selectedTheme === 'dark');
      }
    });

    // 保留原有的主题切换按钮功能
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        themeSelect.value = newTheme;
        
        this.updateThemeIcon(newTheme === 'dark');
      });
    }
  }

  setThemeBasedOnSystem() {
    const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = isDarkMode ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    this.updateThemeIcon(isDarkMode);
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
    // 检查元素是否存在
    if (!this.openInNewTabCheckbox) {
      console.log('openInNewTabCheckbox not found, skipping settings initialization');
      return;
    }
    
    // 检查侧边栏模式下的链接打开方式设置元素是否存在
    const hasSidepanelSettings = this.sidepanelOpenInNewTabCheckbox && this.sidepanelOpenInSidepanelCheckbox;
    
    // 加载链接打开方式设置
    chrome.storage.sync.get(['openInNewTab'], (result) => {
      this.openInNewTabCheckbox.checked = result.openInNewTab !== false;
    });

    // 监听设置变化
    this.openInNewTabCheckbox.addEventListener('change', () => {
      const isEnabled = this.openInNewTabCheckbox.checked;
      chrome.storage.sync.set({ openInNewTab: isEnabled });
    });
    
    // 如果侧边栏模式下的链接打开方式设置元素不存在，则跳过
    if (!hasSidepanelSettings) {
      console.log('Sidepanel checkboxes not found, skipping sidepanel settings initialization');
      return;
    }
    
    // 加载侧边栏模式下的链接打开方式设置
    chrome.storage.sync.get(['sidepanelOpenInNewTab', 'sidepanelOpenInSidepanel'], (result) => {
      // 默认在新标签页中打开
      this.sidepanelOpenInNewTabCheckbox.checked = result.sidepanelOpenInNewTab !== false;
      this.sidepanelOpenInSidepanelCheckbox.checked = result.sidepanelOpenInSidepanel === true;
      
      // 确保两个选项是互斥的
      if (this.sidepanelOpenInNewTabCheckbox.checked && this.sidepanelOpenInSidepanelCheckbox.checked) {
        // 如果两个都被选中，优先使用在新标签页中打开
        this.sidepanelOpenInSidepanelCheckbox.checked = false;
        chrome.storage.sync.set({ sidepanelOpenInSidepanel: false });
      }
    });
    
    // 监听侧边栏模式下的链接打开方式设置变化
    this.sidepanelOpenInNewTabCheckbox.addEventListener('change', () => {
      const isEnabled = this.sidepanelOpenInNewTabCheckbox.checked;
      chrome.storage.sync.set({ sidepanelOpenInNewTab: isEnabled });
      
      // 如果启用了在新标签页中打开，则禁用在侧边栏内打开
      if (isEnabled && this.sidepanelOpenInSidepanelCheckbox.checked) {
        this.sidepanelOpenInSidepanelCheckbox.checked = false;
        chrome.storage.sync.set({ sidepanelOpenInSidepanel: false });
      }
    });
    
    this.sidepanelOpenInSidepanelCheckbox.addEventListener('change', () => {
      const isEnabled = this.sidepanelOpenInSidepanelCheckbox.checked;
      chrome.storage.sync.set({ sidepanelOpenInSidepanel: isEnabled });
      
      // 如果启用了在侧边栏内打开，则禁用在新标签页中打开
      if (isEnabled && this.sidepanelOpenInNewTabCheckbox.checked) {
        this.sidepanelOpenInNewTabCheckbox.checked = false;
        chrome.storage.sync.set({ sidepanelOpenInNewTab: false });
      }
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

  initWheelSwitchingTab() {
    const tabButton = document.querySelector('[data-tab="wheel-switching"]');
    if (tabButton) {
      tabButton.addEventListener('click', () => {
        this.switchTab('wheel-switching');
      });
    }
    
    // 加载保存的设置
    chrome.storage.sync.get({ enableWheelSwitching: false }, (result) => {
      if (this.enableWheelSwitchingCheckbox) {
        this.enableWheelSwitchingCheckbox.checked = result.enableWheelSwitching;
        
        // 添加事件监听器
        this.enableWheelSwitchingCheckbox.addEventListener('change', () => {
          const isEnabled = this.enableWheelSwitchingCheckbox.checked;
          chrome.storage.sync.set({ enableWheelSwitching: isEnabled });
          
          // 触发自定义事件，通知滚轮切换状态变化
          document.dispatchEvent(new CustomEvent('wheelSwitchingChanged', {
            detail: { enabled: isEnabled }
          }));
        });
      }
    });
  }

  // 添加 debounce 方法来优化性能
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  initBookmarkWidthSettings() {
    // 获取元素引用
    this.widthSlider = document.getElementById('width-slider');
    this.widthValue = document.getElementById('width-value');
    this.widthPreviewCount = document.getElementById('width-preview-count');
    
    if (!this.widthSlider || !this.widthValue) {
      console.log('Width slider elements not found, skipping bookmark width settings initialization');
      return;
    }
    
    // 从存储中获取保存的宽度值
    chrome.storage.sync.get(['bookmarkWidth'], (result) => {
      const savedWidth = result.bookmarkWidth || 190; // 默认190px
      this.widthSlider.value = savedWidth;
      this.widthValue.textContent = savedWidth;
      this.updatePreviewCount(savedWidth);
      this.updateBookmarkWidth(savedWidth);
    });
    
    // 监听滑块的变化
    this.widthSlider.addEventListener('input', (e) => {
      const width = e.target.value;
      this.widthValue.textContent = width;
      this.updatePreviewCount(width);
      this.updateBookmarkWidth(width);
    });
      
    // 监听滑块的鼠标释放事件
    this.widthSlider.addEventListener('mouseup', () => {
      // 保存设置
      chrome.storage.sync.set({ bookmarkWidth: this.widthSlider.value });
    });
        
    // 添加窗口大小改变的监听
    const debouncedUpdate = this.debounce(() => {
      this.updatePreviewCount(this.widthSlider.value);
    }, 250);
    window.addEventListener('resize', debouncedUpdate);
  }
  
  // 新增书签卡片高度设置函数
  initCardHeightSettings() {
    // 获取滑块和显示元素
    this.heightSlider = document.getElementById('height-slider');
    this.heightValue = document.getElementById('height-value');
    
    if (!this.heightSlider || !this.heightValue) {
      console.log('Height slider elements not found, skipping card height settings initialization');
      return;
    }
    
    // 从存储中获取保存的高度值
    chrome.storage.sync.get('bookmarkCardHeight', (result) => {
      const savedHeight = result.bookmarkCardHeight || 48; // 默认值为48px
      
      // 设置滑块和显示值
      this.heightSlider.value = savedHeight;
      this.heightValue.textContent = savedHeight;
      
      // 应用高度设置
      this.updateCardHeight(savedHeight);
    });
    
    // 监听滑块的变化
    this.heightSlider.addEventListener('input', (e) => {
      const height = e.target.value;
      this.heightValue.textContent = height;
      this.updateCardHeight(height);
    });
    
    // 监听滑块的鼠标释放事件
    this.heightSlider.addEventListener('mouseup', () => {
      // 保存设置
      chrome.storage.sync.set({ bookmarkCardHeight: this.heightSlider.value });
    });
  }
  
  // 更新书签卡片高度
  updateCardHeight(height) {
    // 创建或更新自定义样式
    let styleElement = document.getElementById('custom-card-height');
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'custom-card-height';
      document.head.appendChild(styleElement);
    }
    
    // 设置卡片高度
    styleElement.textContent = `
      .card {
        height: ${height}px !important;
      }
    `;
  }

  updatePreviewCount(width) {
    // 获取书签列表容器
    const bookmarksList = document.getElementById('bookmarks-list');
    if (!bookmarksList) return;

    // 确保容器可见
    const originalDisplay = bookmarksList.style.display;
    if (getComputedStyle(bookmarksList).display === 'none') {
      bookmarksList.style.display = 'grid';
    }

    // 获取容器的实际可用宽度
    const containerStyle = getComputedStyle(bookmarksList);
    const containerWidth = bookmarksList.offsetWidth 
      - parseFloat(containerStyle.paddingLeft) 
      - parseFloat(containerStyle.paddingRight);

    // 还原容器显示状态
    bookmarksList.style.display = originalDisplay;

    // 使用与 CSS Grid 相同的计算逻辑
    const gap = 16; // gap: 1rem
    const minWidth = parseInt(width);
    
    // 计算一行能容纳的最大数量
    // 使用 Math.floor 确保不会超出容器宽度
    const count = Math.floor((containerWidth + gap) / (minWidth + gap));
    
    // 更新显示 - 使用本地化文本
    const previewText = chrome.i18n.getMessage("bookmarksPerRow", [count]) || `${count} 个/行`;
    this.widthPreviewCount.textContent = previewText;
  }

  updateBookmarkWidth(width) {
    // 更新CSS变量
    document.documentElement.style.setProperty('--bookmark-width', width + 'px');
    
    // 更新Grid布局
    const bookmarksList = document.getElementById('bookmarks-list');
    if (bookmarksList) {
      // 使用 minmax 确保最小宽度，但允许在空间足够时扩展
      bookmarksList.style.gridTemplateColumns = `repeat(auto-fit, minmax(${width}px, 1fr))`;
      // 设置 gap
      bookmarksList.style.gap = '1rem';
    }
  }

  initContainerWidthSettings() {
    // 获取元素引用
    this.containerWidthSlider = document.getElementById('container-width-slider');
    this.containerWidthValue = document.getElementById('container-width-value');
    
    if (!this.containerWidthSlider || !this.containerWidthValue) {
      console.log('Container width slider elements not found, skipping container width settings initialization');
      return;
    }
    
    // 从存储中获取保存的宽度值
    chrome.storage.sync.get(['bookmarkContainerWidth'], (result) => {
      const savedWidth = result.bookmarkContainerWidth || 85; // 默认85%
      this.containerWidthSlider.value = savedWidth;
      this.containerWidthValue.textContent = savedWidth;
      this.updateContainerWidth(savedWidth);
    });
    
    // 监听滑块的变化
    this.containerWidthSlider.addEventListener('input', (e) => {
      const width = e.target.value;
      this.containerWidthValue.textContent = width;
      this.updateContainerWidth(width);
    });
    
    // 监听滑块的鼠标释放事件，保存设置
    this.containerWidthSlider.addEventListener('mouseup', () => {
      // 保存设置
      chrome.storage.sync.set({ bookmarkContainerWidth: this.containerWidthSlider.value });
    });
  }

  // 更新书签容器宽度的方法
  updateContainerWidth(widthPercent) {
    const bookmarksContainer = document.querySelector('.bookmarks-container');
    if (bookmarksContainer) {
      bookmarksContainer.style.width = `${widthPercent}%`;
    }
  }

  initLayoutSettings() {
    // 获取元素引用
    this.showSearchBoxCheckbox = document.getElementById('show-search-box');
    this.showWelcomeMessageCheckbox = document.getElementById('show-welcome-message');
    this.showFooterCheckbox = document.getElementById('show-footer');

    // 添加快捷链接图标的设置
    this.showHistoryLinkCheckbox = document.getElementById('show-history-link');
    this.showDownloadsLinkCheckbox = document.getElementById('show-downloads-link');
    this.showPasswordsLinkCheckbox = document.getElementById('show-passwords-link');
    this.showExtensionsLinkCheckbox = document.getElementById('show-extensions-link');

    // 加载保存的设置
    chrome.storage.sync.get(
      [
        'showSearchBox', 
        'showWelcomeMessage', 
        'showFooter',
        'showHistoryLink',
        'showDownloadsLink',
        'showPasswordsLink',
        'showExtensionsLink'
      ],
      (result) => {
        // 设置复选框状态 - 修改搜索框的默认值为 false
        this.showSearchBoxCheckbox.checked = result.showSearchBox === true; // 默认为 false
        this.showWelcomeMessageCheckbox.checked = result.showWelcomeMessage !== false;
        this.showFooterCheckbox.checked = result.showFooter !== false;
        
        // 设置快捷链接图标的状态
        this.showHistoryLinkCheckbox.checked = result.showHistoryLink !== false;
        this.showDownloadsLinkCheckbox.checked = result.showDownloadsLink !== false;
        this.showPasswordsLinkCheckbox.checked = result.showPasswordsLink !== false;
        this.showExtensionsLinkCheckbox.checked = result.showExtensionsLink !== false;
        
        // 应用设置到界面
        this.toggleElementVisibility('#history-link', result.showHistoryLink !== false);
        this.toggleElementVisibility('#downloads-link', result.showDownloadsLink !== false);
        this.toggleElementVisibility('#passwords-link', result.showPasswordsLink !== false);
        this.toggleElementVisibility('#extensions-link', result.showExtensionsLink !== false);

        // 检查是否所有链接都被隐藏
        const linksContainer = document.querySelector('.links-icons');
        if (linksContainer) {
          const allLinksHidden = 
            result.showHistoryLink === false && 
            result.showDownloadsLink === false && 
            result.showPasswordsLink === false && 
            result.showExtensionsLink === false;
          
          linksContainer.style.display = allLinksHidden ? 'none' : '';
        }
      }
    );

    // 监听设置变化
    this.showSearchBoxCheckbox.addEventListener('change', () => {
      const isVisible = this.showSearchBoxCheckbox.checked;
      chrome.storage.sync.set({ showSearchBox: isVisible });
      
      // 立即应用设置
      const searchContainer = document.querySelector('.search-container');
      if (searchContainer) {
        searchContainer.style.display = isVisible ? '' : 'none';
      }
      
      // 立即更新欢迎语显示
      if (window.WelcomeManager) {
        window.WelcomeManager.updateWelcomeMessage();
      }
    });

    this.showWelcomeMessageCheckbox.addEventListener('change', () => {
      const isVisible = this.showWelcomeMessageCheckbox.checked;
      chrome.storage.sync.set({ showWelcomeMessage: isVisible });
      
      // 立即应用设置
      const welcomeMessage = document.getElementById('welcome-message');
      if (welcomeMessage) {
        welcomeMessage.style.display = isVisible ? '' : 'none';
      }
    });

    this.showFooterCheckbox.addEventListener('change', () => {
      const isVisible = this.showFooterCheckbox.checked;
      chrome.storage.sync.set({ showFooter: isVisible });
      
      // 立即应用设置
      const footer = document.querySelector('footer');
      if (footer) {
        footer.style.display = isVisible ? '' : 'none';
      }
    });

    // 添加事件监听器
    this.showHistoryLinkCheckbox.addEventListener('change', () => {
      const isVisible = this.showHistoryLinkCheckbox.checked;
      chrome.storage.sync.set({ showHistoryLink: isVisible });
      this.toggleElementVisibility('#history-link', isVisible);
    });

    this.showDownloadsLinkCheckbox.addEventListener('change', () => {
      const isVisible = this.showDownloadsLinkCheckbox.checked;
      chrome.storage.sync.set({ showDownloadsLink: isVisible });
      this.toggleElementVisibility('#downloads-link', isVisible);
    });

    this.showPasswordsLinkCheckbox.addEventListener('change', () => {
      const isVisible = this.showPasswordsLinkCheckbox.checked;
      chrome.storage.sync.set({ showPasswordsLink: isVisible });
      this.toggleElementVisibility('#passwords-link', isVisible);
    });

    this.showExtensionsLinkCheckbox.addEventListener('change', () => {
      const isVisible = this.showExtensionsLinkCheckbox.checked;
      chrome.storage.sync.set({ showExtensionsLink: isVisible });
      this.toggleElementVisibility('#extensions-link', isVisible);
    });
  }

  // 辅助方法：切换元素可见性
  toggleElementVisibility(selector, isVisible) {
    const element = document.querySelector(selector);
    if (element) {
      element.style.display = isVisible ? '' : 'none';
      
      // 特殊处理 links-icons 容器
      if (selector.includes('link')) {
        const linksContainer = document.querySelector('.links-icons');
        if (linksContainer) {
          // 检查是否所有链接都被隐藏
          const visibleLinks = Array.from(linksContainer.querySelectorAll('a')).filter(
            link => link.style.display !== 'none'
          ).length;
          
          linksContainer.style.display = visibleLinks === 0 ? 'none' : '';
        }
      }
    }
  }

  initSearchSuggestionsSettings() {
    // 获取元素引用
    this.showHistorySuggestionsCheckbox = document.getElementById('show-history-suggestions');
    this.showBookmarkSuggestionsCheckbox = document.getElementById('show-bookmark-suggestions');
    this.openSearchInNewTabCheckbox = document.getElementById('open-search-in-new-tab');
    
    // 加载搜索建议设置
    chrome.storage.sync.get(
      ['showHistorySuggestions', 'showBookmarkSuggestions', 'showSearchBox', 'openSearchInNewTab'], 
      (result) => {
        // 如果设置不存在(undefined)或者没有明确设置为 false,则默认为 true
        this.showHistorySuggestionsCheckbox.checked = result.showHistorySuggestions !== false;
        this.showBookmarkSuggestionsCheckbox.checked = result.showBookmarkSuggestions !== false;
        this.openSearchInNewTabCheckbox.checked = result.openSearchInNewTab !== false;

        // 初始化时如果是新用户(设置不存在),则保存默认值
        if (!('showHistorySuggestions' in result)) {
          chrome.storage.sync.set({ showHistorySuggestions: true });
        }
        if (!('showBookmarkSuggestions' in result)) {
          chrome.storage.sync.set({ showBookmarkSuggestions: true });
        }
        if (!('showSearchBox' in result)) {
          chrome.storage.sync.set({ showSearchBox: false });
        }
        if (!('openSearchInNewTab' in result)) {
          chrome.storage.sync.set({ openSearchInNewTab: true });
        }
      }
    );

    // 监听设置变化
    this.showHistorySuggestionsCheckbox.addEventListener('change', () => {
      const isEnabled = this.showHistorySuggestionsCheckbox.checked;
      chrome.storage.sync.set({ showHistorySuggestions: isEnabled });
    });

    this.showBookmarkSuggestionsCheckbox.addEventListener('change', () => {
      const isEnabled = this.showBookmarkSuggestionsCheckbox.checked;
      chrome.storage.sync.set({ showBookmarkSuggestions: isEnabled });
    });
    
    this.openSearchInNewTabCheckbox.addEventListener('change', () => {
      const isEnabled = this.openSearchInNewTabCheckbox.checked;
      chrome.storage.sync.set({ openSearchInNewTab: isEnabled });
    });
  }

  initShortcutsSettings() {
    const shortcutItem = document.getElementById('configure-shortcuts');
    if (shortcutItem) {
      shortcutItem.addEventListener('click', () => {
        chrome.tabs.create({
          url: 'chrome://extensions/shortcuts'
        });
      });
    }
  }
}

// 导出设置管理器实例
export const settingsManager = new SettingsManager();