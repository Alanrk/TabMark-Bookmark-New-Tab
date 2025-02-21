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
    this.widthSettings = document.getElementById('floating-width-settings');
    this.widthSlider = document.getElementById('width-slider');
    this.widthValue = document.getElementById('width-value');
    this.widthPreviewCount = document.getElementById('width-preview-count');
    this.settingsModalContent = document.querySelector('.settings-modal-content');
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
    this.initLayoutSettings();
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
    
    // 更新显示
    this.widthPreviewCount.textContent = count + ' 个/行';
    
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

  initLayoutSettings() {
    const layoutTab = document.querySelector('[data-tab="layout"]');
    if (layoutTab) {
      layoutTab.addEventListener('click', () => {
        this.switchTab('layout');
        // 切换到布局设置时重新计算预览数量
        const savedWidth = this.widthSlider.value;
        this.updatePreviewCount(savedWidth);
      });
    }
  };

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
    
    // 更新显示
    this.widthPreviewCount.textContent = count + ' 个/行';
    
    // 同步更新全局滚动条的预览数量
    const globalPreviewCount = document.getElementById('global-width-preview-count');
    if (globalPreviewCount) {
      globalPreviewCount.textContent = count + ' 个/行';
    }
  }
}

// 导出设置管理器实例
export const settingsManager = new SettingsManager();