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
    this.widthSettings = document.getElementById('floating-width-settings');
    this.widthSlider = document.getElementById('width-slider');
    this.widthValue = document.getElementById('width-value');
    this.widthPreviewCount = document.getElementById('width-preview-count');
    this.settingsModalContent = document.querySelector('.settings-modal-content');
    this.showHistorySuggestionsCheckbox = document.getElementById('show-history-suggestions');
    this.showBookmarkSuggestionsCheckbox = document.getElementById('show-bookmark-suggestions');
    this.init();
  }

  init() {
    // 初始化事件监听
    this.initEventListeners();
    // 加载已保存的设置
    this.loadSavedSettings();
    // 初始化主题
    this.initTheme();
    // 更新 UI 语言
    window.updateUILanguage();
    this.initQuickLinksSettings();
    this.initFloatingBallSettings();
    this.initBookmarkManagementTab();
    this.initLinkOpeningSettings();
    this.initBookmarkWidthSettings();
    this.initContainerWidthSettings();
    this.initLayoutSettings();
    this.initSearchSuggestionsSettings();
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
    // 从存储中获取保存的宽度值
    chrome.storage.sync.get(['bookmarkWidth'], (result) => {
      const savedWidth = result.bookmarkWidth || 190;
      this.widthSlider.value = savedWidth;
      this.widthValue.textContent = savedWidth;
      this.updatePreviewCount(savedWidth);
      this.updateBookmarkWidth(savedWidth);
      
      // 同步全局滚动条的值
      const globalSlider = document.getElementById('global-width-slider');
      const globalValue = document.getElementById('global-width-value');
      if (globalSlider && globalValue) {
        globalSlider.value = savedWidth;
        globalValue.textContent = savedWidth;
      }
    });

    // 监听滑块的鼠标按下事件
    this.widthSlider.addEventListener('mousedown', () => {
      this.showFloatingMode();
      // 显示全局滚动条
      const globalRangeSlider = document.querySelector('.global-range-slider');
      if (globalRangeSlider) {
        globalRangeSlider.style.display = 'block';
        // 使用 setTimeout 确保 display:block 已经应用
        setTimeout(() => {
          globalRangeSlider.classList.add('visible');
        }, 10);
      }
    });

    // 监听滑块的变化
    this.widthSlider.addEventListener('input', (e) => {
      const width = e.target.value;
      this.widthValue.textContent = width;
      this.updatePreviewCount(width);
      this.updateBookmarkWidth(width);
      
      // 同步全局滚动条的值
      const globalValue = document.getElementById('global-width-value');
      const globalSlider = document.getElementById('global-width-slider');
      if (globalValue && globalSlider) {
        globalValue.textContent = width;
        globalSlider.value = width;
      }
    });

    // 监听全局滚动条的变化
    const globalSlider = document.getElementById('global-width-slider');
    if (globalSlider) {
      globalSlider.addEventListener('input', (e) => {
        const width = e.target.value;
        this.widthSlider.value = width;
        this.widthValue.textContent = width;
        this.updatePreviewCount(width);
        this.updateBookmarkWidth(width);
        document.getElementById('global-width-value').textContent = width;
      });
    }

    // 监听滑块的鼠标释放事件
    this.widthSlider.addEventListener('mouseup', () => {
      this.hideFloatingMode();
      // 隐藏全局滚动条
      const globalRangeSlider = document.querySelector('.global-range-slider');
      if (globalRangeSlider) {
        globalRangeSlider.classList.remove('visible');
        // 等待过渡效果完成后再隐藏元素
        setTimeout(() => {
          globalRangeSlider.style.display = 'none';
        }, 300);
      }
      // 保存设置
      chrome.storage.sync.set({ bookmarkWidth: this.widthSlider.value });
    });

    // 监听鼠标移出滑块事件
    this.widthSlider.addEventListener('mouseleave', () => {
      if (this.widthSettings.classList.contains('floating')) {
        this.hideFloatingMode();
        // 隐藏全局滚动条
        const globalRangeSlider = document.querySelector('.global-range-slider');
        if (globalRangeSlider) {
          globalRangeSlider.classList.remove('visible');
          // 等待过渡效果完成后再隐藏元素
          setTimeout(() => {
            globalRangeSlider.style.display = 'none';
          }, 300);
        }
      }
    });

    // 添加窗口大小改变的监听
    const debouncedUpdate = this.debounce(() => {
      this.updatePreviewCount(this.widthSlider.value);
    }, 250);
    window.addEventListener('resize', debouncedUpdate);
  }

  showFloatingMode() {
    // 添加浮动模式类，使卡片显示在最上层并添加阴影效果
    this.widthSettings.classList.add('floating');
    // 移除模糊效果并隐藏其他内容
    this.settingsModal.classList.add('no-blur');
    this.settingsModalContent.classList.add('no-blur');

    // 显示全局滚动条并定位
    const globalRangeSlider = document.querySelector('.global-range-slider');
    const widthSettings = document.getElementById('floating-width-settings');
    if (globalRangeSlider && widthSettings) {
      const rect = widthSettings.getBoundingClientRect();
      globalRangeSlider.style.display = 'block';
      globalRangeSlider.style.position = 'fixed';
      globalRangeSlider.style.top = `${rect.top}px`;
      globalRangeSlider.style.left = `${rect.left}px`;
      globalRangeSlider.style.width = `${rect.width}px`;
      globalRangeSlider.style.transform = 'none';
      
      // 使用 setTimeout 确保 display:block 已经应用
      setTimeout(() => {
        globalRangeSlider.classList.add('visible');
      }, 10);
    }
  }

  hideFloatingMode() {
    // 移除浮动模式类
    this.widthSettings.classList.remove('floating');
    // 恢复模糊效果
    this.settingsModal.classList.remove('no-blur');
    this.settingsModalContent.classList.remove('no-blur');
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
    
    // 同步更新全局滚动条的预览数量
    const globalPreviewCount = document.getElementById('global-width-preview-count');
    if (globalPreviewCount) {
      globalPreviewCount.textContent = count;
    }
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
    // 加载搜索建议设置
    chrome.storage.sync.get(
      ['showHistorySuggestions', 'showBookmarkSuggestions'], 
      (result) => {
        // 如果设置不存在(undefined)或者没有明确设置为 false,则默认为 true
        this.showHistorySuggestionsCheckbox.checked = result.showHistorySuggestions !== false;
        this.showBookmarkSuggestionsCheckbox.checked = result.showBookmarkSuggestions !== false;

        // 初始化时如果是新用户(设置不存在),则保存默认值
        if (!('showHistorySuggestions' in result)) {
          chrome.storage.sync.set({ showHistorySuggestions: true });
        }
        if (!('showBookmarkSuggestions' in result)) {
          chrome.storage.sync.set({ showBookmarkSuggestions: true });
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
  }
}

// 导出设置管理器实例
export const settingsManager = new SettingsManager();