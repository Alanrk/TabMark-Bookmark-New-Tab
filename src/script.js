let bookmarkTreeNodes = [];
let defaultSearchEngine = 'google';
let contextMenu = null;
let currentBookmark = null;

// 使用单一的状态变量
let itemToDelete = null;

// Define and initialize the variables
let bookmarkFolderContextMenu = null;
let currentBookmarkFolder = null;
// 在文件顶部添加导入语句
import { ICONS } from './icons.js';

function updateThemeIcon(isDark) {
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (!themeToggleBtn) return;
  
  // 使用不同的图标来表示是否跟随系统
  if (followSystem) {
    themeToggleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24">
      <path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>
    </svg>`;
  } else {
    themeToggleBtn.innerHTML = isDark ? ICONS.dark_mode : ICONS.light_mode;
  }
  
  // 添加提示文本
  themeToggleBtn.title = followSystem ? '当前跟随系统主题' : (isDark ? '暗色模式' : '亮色模式');
}
import { replaceIconsWithSvg, getIconHtml } from './icons.js';

document.addEventListener('DOMContentLoaded', function () {
  // 替换所有图标
  replaceIconsWithSvg();

  // 或者在动态创建元素时使用
  const button = document.createElement('button');
  button.innerHTML = getIconHtml('settings') + ' Settings';
});
function getLocalizedMessage(messageName) {
  const message = chrome.i18n.getMessage(messageName);
  return message || messageName;
}


// Define the context menu creation function
function createContextMenu() {
  console.log('Creating context menu');
  
  // 移除任何已存在的上下文菜单
  const existingMenu = document.querySelector('.custom-context-menu');
  if (existingMenu) {
    existingMenu.remove();
  }

  const menu = document.createElement('div');
  menu.className = 'custom-context-menu';
  document.body.appendChild(menu);

  const menuItems = [
    { text: getLocalizedMessage('openInNewTab'), icon: 'open_in_new', action: () => currentBookmark && window.open(currentBookmark.url, '_blank') },
    { text: getLocalizedMessage('openInNewWindow'), icon: 'launch', action: () => currentBookmark && openInNewWindow(currentBookmark.url) },
    { text: getLocalizedMessage('openInIncognito'), icon: 'visibility_off', action: () => currentBookmark && openInIncognito(currentBookmark.url) },
    { text: getLocalizedMessage('editQuickLink'), icon: 'edit', action: () => currentBookmark && openEditDialog(currentBookmark) },
    { 
      text: getLocalizedMessage('deleteQuickLink'), 
      icon: 'delete', 
      action: () => {
        console.log('Delete action triggered. Current item:', currentBookmark);
        
        if (!currentBookmark) {
          console.error('No item selected for deletion');
          return;
        }

        itemToDelete = {
          type: currentBookmark.type,
          data: {
            id: currentBookmark.id,
            title: currentBookmark.title,
            url: currentBookmark.url
          }
        };
        
        console.log('Set itemToDelete:', itemToDelete);
        
        const message = itemToDelete.type === 'quickLink' 
          ? chrome.i18n.getMessage("confirmDeleteQuickLink", [`<strong>${itemToDelete.data.title}</strong>`])
          : chrome.i18n.getMessage("confirmDeleteBookmark", [`<strong>${itemToDelete.data.title}</strong>`]);
        
        showConfirmDialog(message, () => {
          if (itemToDelete && itemToDelete.data) {
            if (itemToDelete.type === 'quickLink') {
              deleteQuickLink(itemToDelete.data);
            } else {
              deleteBookmark(itemToDelete.data.id, itemToDelete.data.title);
            }
          }
        });
      }
    },
    { text: getLocalizedMessage('copyLink'), icon: 'content_copy', action: () => currentBookmark && Utilities.copyBookmarkLink(currentBookmark) },
    { text: getLocalizedMessage('createQRCode'), icon: 'qr_code', action: () => currentBookmark && createQRCode(currentBookmark.url, currentBookmark.title) }
  ];

  menuItems.forEach(item => {
    const menuItem = document.createElement('div');
    menuItem.className = 'custom-context-menu-item';
    
    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.innerHTML = ICONS[item.icon];
    icon.style.marginRight = '8px';
    icon.style.fontSize = '18px';
    
    const text = document.createElement('span');
    text.textContent = item.text;

    menuItem.appendChild(icon);
    menuItem.appendChild(text);

    menuItem.addEventListener('click', () => {
      if (typeof item.action === 'function') {
        item.action();
      }
      menu.style.display = 'none';
    });

    menu.appendChild(menuItem);
  });

  return menu;
}

// 在文件顶部添加这个函数
function applyBackgroundColor() {
    const savedBg = localStorage.getItem('selectedBackground');
    if (savedBg) {
        const useDefaultBackground = localStorage.getItem('useDefaultBackground');
        console.log('[Background] Current state:', {
            savedBg,
            useDefaultBackground,
            hasWallpaper: localStorage.getItem('originalWallpaper')
        });

        if (useDefaultBackground !== 'true') {
            console.log('[Background] Skipping color application - wallpaper is active');
            document.querySelectorAll('.settings-bg-option').forEach(option => {
                option.classList.remove('active');
            });
            return;
        }

        console.log('[Background] Applying background color:', savedBg);
        
        // 先设置背景类
        document.documentElement.className = savedBg;
        
        // 使用 WelcomeManager 更新欢迎消息颜色
        const welcomeElement = document.getElementById('welcome-message');
        if (welcomeElement && window.WelcomeManager) {
            window.WelcomeManager.adjustTextColor(welcomeElement);
        }
    }
}

// 立即调用这个函数
applyBackgroundColor();

// 添加颜色缓存管理器
const ColorCache = {
  data: new Map(),
  maxSize: 2000, // 最多缓存500个书签的颜色
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7天过期
  storageKey: 'bookmark-colors-v2', // 新的存储键，避免与旧数据冲突

  // 初始化缓存
  init() {
    try {
      // 从 localStorage 加载缓存数据
      const cached = localStorage.getItem(this.storageKey);
      if (cached) {
        const parsedData = JSON.parse(cached);
        Object.entries(parsedData).forEach(([key, value]) => {
          if (Date.now() - value.timestamp < this.maxAge) {
            this.data.set(key, value);
          }
        });
      }
    } catch (error) {
      console.error('Error initializing color cache:', error);
      this.clear();
    }
  },

  // 获取颜色
  get(bookmarkId, url) {
    const cached = this.data.get(bookmarkId);
    if (!cached) return null;

    // 检查URL是否变化和过期时间
    if (cached.url !== url || Date.now() - cached.timestamp > this.maxAge) {
      this.data.delete(bookmarkId);
      return null;
    }

    return cached.colors;
  },

  // 设置颜色
  set(bookmarkId, url, colors) {
    // 如果缓存即将超出限制，清理旧数据
    if (this.data.size >= this.maxSize) {
      this.cleanup();
    }

    this.data.set(bookmarkId, {
      colors,
      url,
      timestamp: Date.now()
    });

    // 异步保存到 localStorage
    this.scheduleSave();
  },

  // 清理过期和多余的缓存
  cleanup() {
    const now = Date.now();
    const entries = Array.from(this.data.entries());

    // 删除过期项
    entries.forEach(([key, value]) => {
      if (now - value.timestamp > this.maxAge) {
        this.data.delete(key);
      }
    });

    // 如果仍然超出限制，删除最旧的项
    if (this.data.size >= this.maxSize) {
      const sortedEntries = Array.from(this.data.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);

      const deleteCount = Math.floor(this.data.size * 0.2);
      sortedEntries.slice(0, deleteCount).forEach(([key]) => {
        this.data.delete(key);
      });
    }
  },

  // 清除所有缓存
  clear() {
    this.data.clear();
    localStorage.removeItem(this.storageKey);
  },

  // 使用防抖保存到 localStorage
  scheduleSave: _.debounce(function () {
    try {
      const dataToSave = Object.fromEntries(this.data);
      localStorage.setItem(this.storageKey, JSON.stringify(dataToSave));
    } catch (error) {
      // 如果存储失败（比如超出配额），清理一半的缓存后重试
      const entries = Array.from(this.data.entries());
      entries.slice(0, Math.floor(entries.length / 2)).forEach(([key]) => {
        this.data.delete(key);
      });
      this.scheduleSave();
    }
  }, 1000)
};

function getSearchEngineIconPath(engineName) {
  const iconPaths = {
    google: '../images/google-logo.svg',
    bing: '../images/bing-logo.png',
    baidu: '../images/baidu-logo.svg', // 添加百度图标路径
    doubao: '../images/doubao-logo.png',
    kimi: '../images/kimi-logo.svg',
    metaso: '../images/metaso-logo.png',
    felo: '../images/felo-logo.svg',
    chatgpt: '../images/chatgpt-logo.svg'
  };
  return iconPaths[engineName.toLowerCase()] || '../images/google-logo.svg';
}

// 同样，将这个函数也移到全作用域
function setDefaultIcon(iconElement) {
  iconElement.src = '../images/default-search-icon.png';
  iconElement.alt = 'Default Search Engine';
}

// 1. 首先定义全局变量
let bookmarksList;
let itemHeight = 120;
let bufferSize = 5;
let visibleItems;
let allBookmarks = [];
let renderTimeout = null;
let scrollHandler = null;
let resizeObserver = null;

// 2. 定义主要的虚拟滚动函数
function initVirtualScroll() {
  bookmarksList = document.getElementById('bookmarks-list');
  if (!bookmarksList) return;
  
  visibleItems = Math.ceil(window.innerHeight / itemHeight) + 2 * bufferSize;

  // 渲染函数
  function renderVisibleBookmarks() {
    if (!bookmarksList) return;
    // ... 保持原有的 renderVisibleBookmarks 实现 ...
  }

  // 滚动处理函数
  const handleScroll = _.throttle(() => {
    if (renderTimeout) {
      cancelAnimationFrame(renderTimeout);
    }
    renderTimeout = requestAnimationFrame(renderVisibleBookmarks);
  }, 16);

  // 窗口大小变化处理函数
  function handleResize() {
    const newVisibleItems = Math.ceil(window.innerHeight / itemHeight) + 2 * bufferSize;
    if (newVisibleItems !== visibleItems) {
      visibleItems = newVisibleItems;
      renderVisibleBookmarks();
    }
  }

  // 清理函数
  function cleanup() {
    if (scrollHandler) {
      bookmarksList.removeEventListener('scroll', scrollHandler);
    }
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    if (renderTimeout) {
      cancelAnimationFrame(renderTimeout);
    }
    allBookmarks = [];
  }

  // 初始化事件监听
  function initializeListeners() {
    cleanup(); // 清理旧的监听器

    scrollHandler = handleScroll;
    bookmarksList.addEventListener('scroll', scrollHandler, { passive: true });

    // 确保 handleResize 在正确的作用域内
    const boundHandleResize = handleResize.bind(this);
    resizeObserver = new ResizeObserver(_.debounce(boundHandleResize, 100));
    resizeObserver.observe(bookmarksList);
  }

  // 更新书签显示
  window.updateBookmarksDisplay = function(parentId, movedItemId, newIndex) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.getChildren(parentId, (bookmarks) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        cleanup();
        allBookmarks = bookmarks;
        
        updateContainerHeight();
        updateFolderName(parentId);
        renderVisibleBookmarks();
        
        bookmarksList.dataset.parentId = parentId;
        initializeListeners();
        
        resolve();
      });
    });
  };

  // 初始化
  initializeListeners();
}
function updateSearchEngineIcon(engine) {
  console.log('[Icon] Updating icon for engine:', engine);

  const searchEngineIcon = document.getElementById('search-engine-icon');
  if (!searchEngineIcon) {
    console.warn('[Icon] Search engine icon element not found');
    return;
  }

  const iconMap = {
    'google': '../images/google-logo.svg',
    'bing': '../images/bing-logo.png',
    'baidu': '../images/baidu-logo.svg',
    'kimi': '../images/kimi-logo.svg',
    'doubao': '../images/doubao-logo.png',
    'chatgpt': '../images/chatgpt-logo.svg',
    'felo': '../images/felo-logo.svg',
    'metaso': '../images/metaso-logo.png'
  };

  const iconPath = iconMap[engine] || iconMap['google'];
  console.log('[Icon] Setting icon path:', iconPath);
  searchEngineIcon.src = iconPath;
  searchEngineIcon.alt = `${engine} icon`;
}
// 3. 合并 DOMContentLoaded 事件监听器
document.addEventListener('DOMContentLoaded', function() {
  // 初始化虚拟滚动
  initVirtualScroll();
  createSearchEngineDropdown();
  // 其他初始化代码...


  startPeriodicSync();
  setupSpecialLinks();
  console.log('[Init] Starting initialization...');

  // 获取当前存储的搜索引擎
  const currentEngine = localStorage.getItem('selectedSearchEngine');
  console.log('[Init] Current engine from storage:', currentEngine);

  // 如果没有设置默认搜索引擎，则设置为 google
  if (!currentEngine) {
    console.log('[Init] Setting default engine to google');
    localStorage.setItem('selectedSearchEngine', 'google');
  }

  // 确认设置成功
  const defaultEngine = localStorage.getItem('selectedSearchEngine');
  console.log('[Init] Confirmed default engine:', defaultEngine);

  // 初始化搜索引擎图
  updateSearchEngineIcon(defaultEngine);

  // 初始化 tabs 的激活状态
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    if (tab.getAttribute('data-engine') === defaultEngine) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // 显示搜索引擎更新提示
  showSearchEngineUpdateTip();

  // 加载保存的背景颜色
  const savedBg = localStorage.getItem('selectedBackground');
  const useDefaultBackground = localStorage.getItem('useDefaultBackground');
  const hasWallpaper = localStorage.getItem('originalWallpaper');

  console.log('[Background] Initial load state:', {
    savedBg,
    useDefaultBackground,
    hasWallpaper
  });

  // 清除所有选项的 active 状态
  document.querySelectorAll('.settings-bg-option').forEach(opt => {
    opt.classList.remove('active');
  });

  if (savedBg) {
    if (useDefaultBackground === 'true') {
      console.log('[Background] Activating saved background color:', savedBg);
      document.documentElement.className = savedBg;
      const activeOption = document.querySelector(`[data-bg="${savedBg}"]`);
      if (activeOption) {
        activeOption.classList.add('active');
      }
    } else if (hasWallpaper) {
      console.log('[Background] Wallpaper is active, keeping background options unselected');
    }
  } else {
    console.log('[Background] No saved background, checking wallpaper state');
    if (!hasWallpaper && useDefaultBackground !== 'false') {
      console.log('[Background] No wallpaper, using default background');
      document.documentElement.className = 'gradient-background-7';
      const defaultOption = document.querySelector('[data-bg="gradient-background-7"]');
      if (defaultOption) {
        defaultOption.classList.add('active');
      }
    } else {
      console.log('[Background] Wallpaper exists, skipping default background');
      document.documentElement.className = '';
    }
  }

  // 如果有壁纸，激活对应的壁纸选项
  if (hasWallpaper) {
    const wallpaperOption = document.querySelector(`.wallpaper-option[data-wallpaper-url="${hasWallpaper}"]`);
    if (wallpaperOption) {
      console.log('[Background] Activating wallpaper option');
      wallpaperOption.classList.add('active');
    }
  }

  // 背景选项点击事件
  const bgOptions = document.querySelectorAll('.settings-bg-option');
  bgOptions.forEach(option => {
    option.addEventListener('click', function() {
      const bgClass = this.getAttribute('data-bg');
      console.log('[Background] Color option clicked:', {
        bgClass,
        previousBackground: document.documentElement.className,
        previousWallpaper: localStorage.getItem('originalWallpaper')
      });

      // 移除所有背景选项的 active 状态
      bgOptions.forEach(opt => {
        opt.classList.remove('active');
        console.log('[Background] Removing active state from:', opt.getAttribute('data-bg'));
      });
      
      // 添加当前选项的 active 状态
      this.classList.add('active');
      console.log('[Background] Setting active state for:', bgClass);
      
      document.documentElement.className = bgClass;
      localStorage.setItem('selectedBackground', bgClass);
      localStorage.setItem('useDefaultBackground', 'true');
      
      // 清除壁纸相关的状态
      document.querySelectorAll('.wallpaper-option').forEach(opt => {
        opt.classList.remove('active');
      });

      // 清除壁纸
      const mainElement = document.querySelector('main');
      if (mainElement) {
        mainElement.style.backgroundImage = 'none';
        document.body.style.backgroundImage = 'none';
        console.log('[Background] Cleared wallpaper');
      }
      localStorage.removeItem('originalWallpaper');

      // 使用 WelcomeManager 更新欢迎消息颜色
      const welcomeElement = document.getElementById('welcome-message');
      if (welcomeElement && window.WelcomeManager) {
        window.WelcomeManager.adjustTextColor(welcomeElement);
      }
    });
  });

  // 监听主题变化
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'class') {
        // 当背景类发生变化时，调整文字颜色
        requestAnimationFrame(() => {
          const welcomeElement = document.getElementById('welcome-message');
          if (welcomeElement && window.WelcomeManager) {
            window.WelcomeManager.adjustTextColor(welcomeElement);
          }
        });
      }
    });
  });

  // 开始观察 documentElement 的 class 变化
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  });
});

const bookmarksCache = {
  data: new Map(),
  maxSize: 100, // 最大缓存条目数
  maxAge: 5 * 60 * 1000, // 5分钟缓存

  set(parentId, bookmarks) {
    // 如果缓存即将超出限制，清理最旧的数据
    if (this.data.size >= this.maxSize) {
      this.cleanup();
    }

    // 分块存储大量书签
    const chunks = this.chunkArray(bookmarks, 100);

    this.data.set(parentId, {
      timestamp: Date.now(),
      bookmarks: bookmarks,
      chunks: chunks,
      totalCount: bookmarks.length
    });
  },

  get(parentId) {
    const cached = this.data.get(parentId);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.maxAge) {
      this.data.delete(parentId);
      return null;
    }

    return cached;
  },

  // 获取指定范围的书签
  getRange(parentId, startIndex, endIndex) {
    const cached = this.get(parentId);
    if (!cached) return null;

    return cached.bookmarks.slice(startIndex, endIndex);
  },

  // 清理过和最少使用缓存
  cleanup() {
    const now = Date.now();
    const entries = Array.from(this.data.entries());

    // 按最后访问时间排序
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    // 删除最旧的 20% 缓存
    const deleteCount = Math.floor(entries.length * 0.2);
    entries.slice(0, deleteCount).forEach(([key]) => {
      this.data.delete(key);
    });
  },

  // 将数组分块
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
};

function updateBookmarkCards() {
  const bookmarksList = document.getElementById('bookmarks-list');
  const defaultBookmarkId = localStorage.getItem('defaultBookmarkId');
  const parentId = defaultBookmarkId || bookmarksList.dataset.parentId || '1';

  chrome.bookmarks.getChildren(parentId, function (bookmarks) {
    displayBookmarks({ id: parentId, children: bookmarks });

    // 在显示书签后更新默认书签指示器
    updateDefaultBookmarkIndicator();
    updateSidebarDefaultBookmarkIndicator();

    // 更新 bookmarks-list 的 data-parent-id
    bookmarksList.dataset.parentId = parentId;
  });
}

document.addEventListener('DOMContentLoaded', function () {
  // Create context menu immediately when the document loads
  contextMenu = createContextMenu();
  
  const searchEngineIcon = document.getElementById('search-engine-icon');
  const defaultSearchEngine = localStorage.getItem('selectedSearchEngine') || 'google';
  console.log('[Init] Default search engine:', localStorage.getItem('selectedSearchEngine'));
  let deletedBookmark = null;
  let deletedCategory = null; // 添加这行
  let deleteTimeout = null;
  let bookmarkTreeNodes = []; // 定义全局变量
  // 调用 updateBookmarkCards
  updateBookmarkCards();
  
  setSearchEngineIcon(defaultSearchEngine);

  function setSearchEngineIcon(engineName) {
    const iconPath = getSearchEngineIconPath(engineName);
    searchEngineIcon.src = iconPath;
    searchEngineIcon.alt = `${engineName} Search`;
  }
  if (searchEngineIcon.src === '') {      
    searchEngineIcon.src = '../images/placeholder-icon.svg';
  }
  setTimeout(() => {
    updateSearchEngineIcon(defaultSearchEngine);
  }, 0);
  // 修改 updateSearchEngineIcon 函数
  function updateSearchEngineIcon(engineName) {
    setSearchEngineIcon(engineName);
  }


  // 更新侧边栏默认书签指示器和选中状态
  updateSidebarDefaultBookmarkIndicator();

  // ... 其他代码 ...

  // 主题切换功能
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const themeIcon = themeToggleBtn.querySelector('.material-icons');

  // 检测系统主题
  const systemThemeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  // 从 localStorage 获取主题设置
  let followSystem = localStorage.getItem('followSystemTheme') !== 'false'; // 默认为true
  const savedTheme = localStorage.getItem('theme');

  // 根据系统主题和用户设置更新主题
  function updateThemeBasedOnSystem() {
    if (followSystem) {
      const newTheme = systemThemeMediaQuery.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
      updateThemeIcon(newTheme === 'dark');
      localStorage.setItem('theme', newTheme);
      // 隐藏主题切换按钮
      themeToggleBtn.style.display = 'none';
    } else {
      // 显示主题切换按钮
      themeToggleBtn.style.display = 'flex';
      if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeIcon(savedTheme === 'dark');
      }
    }
  }

  // 初始化主题
  updateThemeBasedOnSystem();

  // 监听系统主题变化
  systemThemeMediaQuery.addListener(updateThemeBasedOnSystem);

  // 获取跟随系统主题的开关元素
  const followSystemThemeCheckbox = document.getElementById('follow-system-theme');

  // 加载设置
  if (followSystemThemeCheckbox) {
    followSystemThemeCheckbox.checked = followSystem;

    // 保存设置
    followSystemThemeCheckbox.addEventListener('change', function() {
      followSystem = this.checked;
      localStorage.setItem('followSystemTheme', followSystem);
      
      // 立即应用新的主题设置
      updateThemeBasedOnSystem();
    });
  }

  themeToggleBtn.addEventListener('click', () => {
    if (!followSystem) {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      updateThemeIcon(newTheme === 'dark');
      
      // 更新背景样式
      const activeBackground = document.documentElement.className;
      if (activeBackground && activeBackground.includes('gradient-background')) {
        // 如果有活动的背景，重新应用以触发暗黑模式样式
        requestAnimationFrame(() => {
          document.documentElement.className = '';
          requestAnimationFrame(() => {
            document.documentElement.className = activeBackground;
          });
        });
      }
    }
  });

  function updateThemeIcon(isDark) {
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (!themeToggleBtn) return;
    
    // 使用 innerHTML 来设置 SVG 图标
    themeToggleBtn.innerHTML = isDark ? ICONS.dark_mode : ICONS.light_mode;
  }



  
  // 优化后的更新显示函数
  function updateBookmarksDisplay(parentId, movedItemId, newIndex) {
    return new Promise((resolve, reject) => {
      const cached = bookmarksCache.get(parentId);
      
      if (cached && !movedItemId) {
        // 使用缓存数据进行分页显示
        renderBookmarksPage(cached, 0);
        resolve();
        return;
      }

      chrome.bookmarks.getChildren(parentId, (bookmarks) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }
        
        // 缓存新数据
        bookmarksCache.set(parentId, bookmarks);
        
        // 初始渲染第一页
        renderBookmarksPage({ bookmarks, totalCount: bookmarks.length }, 0);
        resolve();
      });
    });
  }

  // 分页渲染函数
  function renderBookmarksPage(cachedData, pageIndex, pageSize = 100) {
    const startIndex = pageIndex * pageSize;
    const endIndex = Math.min(startIndex + pageSize, cachedData.totalCount);
    
    const bookmarksList = document.getElementById('bookmarks-list');
    const bookmarksContainer = document.querySelector('.bookmarks-container');
    
    // 使用 DocumentFragment 优化 DOM 操作
    const fragment = document.createDocumentFragment();
    
    // 获取当前页的书签
    const pageBookmarks = cachedData.bookmarks.slice(startIndex, endIndex);
    
    // 渲染书签
    pageBookmarks.forEach((bookmark, index) => {
      const bookmarkElement = bookmark.url ? 
        createBookmarkCard(bookmark, startIndex + index) : 
        createFolderCard(bookmark, startIndex + index);
      fragment.appendChild(bookmarkElement);
    });
    
    // 更新 DOM
    bookmarksList.innerHTML = '';
    bookmarksList.appendChild(fragment);
    
    // 更新分页信息
    updatePagination(pageIndex, Math.ceil(cachedData.totalCount / pageSize));
  }

  // 添加分页控制
  function updatePagination(currentPage, totalPages) {
    // 实现分页控制UI
    // ...
  }

  // 化书顺序步
  function syncBookmarkOrder(parentId) {
    const cached = bookmarksCache.get(parentId);
    if (!cached) return;
    
    chrome.bookmarks.getChildren(parentId, (bookmarks) => {
      const chromeOrder = bookmarks.map(b => b.id);
      const cachedOrder = cached.bookmarks.map(b => b.id);
      
      if (JSON.stringify(chromeOrder) !== JSON.stringify(cachedOrder)) {
        // 更新缓存
        bookmarksCache.set(parentId, bookmarks);
        
        // 重新渲染当前页
        renderBookmarksPage({ bookmarks, totalCount: bookmarks.length }, 0);
      }
    });
  }

  document.addEventListener('contextmenu', function (event) {
    const targetFolder = event.target.closest('.bookmark-folder');
    const targetCard = event.target.closest('.bookmark-card');
    
    if (targetFolder) {
      event.preventDefault();
      
      // 确保文件夹上下文菜单存在
      if (!bookmarkFolderContextMenu) {
        bookmarkFolderContextMenu = createBookmarkFolderContextMenu();
      }

      if (!bookmarkFolderContextMenu) {
        console.error('Failed to create bookmark folder context menu');
        return;
      }

      currentBookmarkFolder = targetFolder;
      
      // 设置菜单位置
      bookmarkFolderContextMenu.style.display = 'block';
      bookmarkFolderContextMenu.style.top = `${event.clientY}px`;
      bookmarkFolderContextMenu.style.left = `${event.clientX}px`;

      // 确保菜单不会超出视窗
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const menuRect = bookmarkFolderContextMenu.getBoundingClientRect();

      if (event.clientX + menuRect.width > viewportWidth) {
        bookmarkFolderContextMenu.style.left = `${viewportWidth - menuRect.width - 5}px`;
      }

      if (event.clientY + menuRect.height > viewportHeight) {
        bookmarkFolderContextMenu.style.top = `${viewportHeight - menuRect.height - 5}px`;
      }

      // 隐藏书签卡片的上下文菜单
      if (contextMenu) {
        contextMenu.style.display = 'none';
      }
    } else if (targetCard) {
      event.preventDefault();
      // 确保在显示菜单前重置当前书签信息
      currentBookmark = {
        id: targetCard.dataset.id,
        url: targetCard.href,
        title: targetCard.querySelector('.card-title').textContent
      };
      
      // 隐藏文件夹的上下文菜单
      if (bookmarkFolderContextMenu) {
        bookmarkFolderContextMenu.style.display = 'none';
      }
      
      // 显示书签卡片的上下文菜单
      contextMenu.style.top = `${event.clientY}px`;
      contextMenu.style.left = `${event.clientX}px`;
      contextMenu.style.display = 'block';
    } else {
      // 点击在其他地方，隐藏所有上下文菜单
      if (contextMenu) {
        contextMenu.style.display = 'none';
        currentBookmark = null;
      }
      if (bookmarkFolderContextMenu) {
        bookmarkFolderContextMenu.style.display = 'none';
        currentBookmarkFolder = null;
      }
    }
  });

  // 在点击其他地方时重置状态
  document.addEventListener('click', function () {
    if (contextMenu) {
      contextMenu.style.display = 'none';
      currentBookmark = null;  // 重置 currentBookmark
    }
  });
});

function showMovingFeedback(element) {
  element.style.opacity = '0.5';
}

function hideMovingFeedback(element) {
  element.style.opacity = '1';
}

function showSuccessFeedback(element) {
  element.style.backgroundColor = '#e6ffe6';
  setTimeout(() => {
    element.style.backgroundColor = '';
  }, 1000);
}

function showErrorFeedback(element) {
  element.style.backgroundColor = '#ffe6e6';
  setTimeout(() => {
    element.style.backgroundColor = '';
  }, 1000);
}

function openCategory(category) {
  if (category && category.classList.contains('folder-item')) {
    document.querySelectorAll('#categories-list li').forEach(function (item) {
      item.classList.remove('bg-emerald-500');
    });
    category.classList.add('bg-emerald-500');

    if (category.dataset.id) {
      updateBookmarksDisplay(category.dataset.id);
    }
  }
}

function waitForFirstCategory(attemptsLeft) {
  if (attemptsLeft <= 0) {
    updateBookmarksDisplay('1');
    updateFolderName('默认文件夹');
    return;
  }

  let defaultBookmarkId = localStorage.getItem('defaultBookmarkId');

  // 如果没有默认书签ID，直接显示根目录
  if (!defaultBookmarkId) {
    updateBookmarksDisplay('1');
    updateFolderName('默认文件夹');
    
    // 更新书签树显示
    chrome.bookmarks.getTree(function (nodes) {
      bookmarkTreeNodes = nodes;
      displayBookmarkCategories(bookmarkTreeNodes[0].children, 0, null, '1');
      
      // 选中根目录
      selectSidebarFolder('1');
    });
    return;
  }

  // 验证默认书签ID是否有效
  chrome.bookmarks.get(defaultBookmarkId, function (results) {
    if (results && results.length > 0) {
      const defaultBookmark = results[0];
      updateBookmarksDisplay(defaultBookmarkId).then(() => {
        updateFolderName(defaultBookmarkId);

        chrome.bookmarks.getTree(function (nodes) {
          bookmarkTreeNodes = nodes;
          displayBookmarkCategories(bookmarkTreeNodes[0].children, 0, null, '1');
          selectSidebarFolder(defaultBookmarkId);
        });
      });
    } else {
      // 如果默认书签ID无效，显示根目录
      updateBookmarksDisplay('1');
      updateFolderName('默认文件夹');
      
      chrome.bookmarks.getTree(function (nodes) {
        bookmarkTreeNodes = nodes;
        displayBookmarkCategories(bookmarkTreeNodes[0].children, 0, null, '1');
        selectSidebarFolder('1');
      });
    }
  });
}

function updateBookmarksDisplay(parentId, movedItemId, newIndex) {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.getChildren(parentId, (bookmarks) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      const bookmarksList = document.getElementById('bookmarks-list');
      const bookmarksContainer = document.querySelector('.bookmarks-container');

      // 先隐藏容器
      bookmarksContainer.style.opacity = '0';
      bookmarksContainer.style.transform = 'translateY(20px)';

      // 清空现有书签和占位符
      bookmarksList.innerHTML = '';

      // 更新本地缓存
      bookmarkOrderCache[parentId] = bookmarks.map(b => b.id);

      // 添加新的书签
      bookmarks.forEach((bookmark, index) => {
        const bookmarkElement = bookmark.url ? createBookmarkCard(bookmark, index) : createFolderCard(bookmark, index);
        bookmarksList.appendChild(bookmarkElement);
      });

      bookmarksList.dataset.parentId = parentId;

      if (movedItemId) {
        highlightBookmark(movedItemId);
      }

      // 更新文件夹名称
      updateFolderName(parentId);

      // 使用 requestAnimationFrame 来确保 DOM 更新后再显示容器
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          bookmarksContainer.style.opacity = '1';
          bookmarksContainer.style.transform = 'translateY(0)';
        });
      });

      resolve();
    });
  });
}

// 获取书栏的本地化名称
function getBookmarksBarName() {
  return new Promise((resolve) => {
    chrome.bookmarks.getTree(function(tree) {
      if (tree && tree[0] && tree[0].children) {
        const bookmarksBar = tree[0].children.find(child => child.id === '1');
        if (bookmarksBar) {
          resolve(bookmarksBar.title);
        } else {
          resolve('Bookmarks Bar'); // 默认英文名称
        }
      } else {
        resolve('Bookmarks Bar'); // 默认英文名称
      }
    });
  });
}

function getBookmarkPath(bookmarkId) {
  return new Promise((resolve, reject) => {
    getBookmarksBarName().then(bookmarksBarName => {
      function getParentRecursive(id, path = []) {
        chrome.bookmarks.get(id, function(results) {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          if (results && results[0]) {
            path.unshift(results[0].title);
            if (results[0].parentId && results[0].parentId !== '0') {
              getParentRecursive(results[0].parentId, path);
            } else {
              // 确保书签栏名称总是作为第一个元素
              if (path[0] !== bookmarksBarName) {
                path.unshift(bookmarksBarName);
              }
              resolve(path);
            }
          } else {
            reject(new Error('Bookmark not found'));
          }
        });
      }
      getParentRecursive(bookmarkId);
    });
  });
}

function updateFolderName(bookmarkId) {
  const folderNameElement = document.getElementById('folder-name');
  if (!folderNameElement) return;

  // 清除所有内容
  folderNameElement.innerHTML = '';

  // 检查 bookmarkId 是否有效
  if (!bookmarkId || bookmarkId === 'undefined') {
    folderNameElement.textContent = getLocalizedMessage('bookmarks');
    return;
  }

  // 尝试获取书签路径
  getBookmarkPath(bookmarkId).then(pathArray => {
    let breadcrumbHtml = '';
    let currentPath = '';

    pathArray.forEach((part, index) => {
      currentPath += (index > 0 ? ' > ' : '') + part;
      breadcrumbHtml += `<span class="breadcrumb-item" data-path="${currentPath}">${getLocalizedMessage(part)}</span>`;
      if (index < pathArray.length - 1) {
        breadcrumbHtml += '<span class="breadcrumb-separator">&gt;</span>';
      }
    });

    folderNameElement.innerHTML = breadcrumbHtml;
    addBreadcrumbClickListeners();
  }).catch(error => {
    console.warn('Error updating folder name:', error);
    // 设置默认文本，并确保它被本地化
    folderNameElement.textContent = getLocalizedMessage('bookmarks');
  });
}

function addBreadcrumbClickListeners() {
  const breadcrumbItems = document.querySelectorAll('.breadcrumb-item');
  breadcrumbItems.forEach(item => {
    item.addEventListener('click', function () {
      const path = this.dataset.path;
      navigateToPath(path);
    });
  });
}

function navigateToPath(path) {
  const pathParts = path.split(' > ');
  
  // 获取书签栏的名称
  getBookmarksBarName().then(bookmarksBarName => {
    let currentId = '1'; // 默认从根目录开始
    let startIndex = 0;

    // 如果路径不是从书签栏开始，我们需要找到正确的起始点
    if (pathParts[0] !== bookmarksBarName) {
      chrome.bookmarks.search({title: pathParts[0]}, function(results) {
        if (results.length > 0) {
          currentId = results[0].id;
        }
        navigateRecursive(startIndex);
      });
    } else {
      startIndex = 1; // 如果从书签栏开始，跳过第一个元素
      navigateRecursive(startIndex);
    }

    function navigateRecursive(index) {
      if (index >= pathParts.length) {
        updateBookmarksDisplay(currentId);
        return;
      }

      chrome.bookmarks.getChildren(currentId, function(children) {
        const matchingChild = children.find(child => child.title === pathParts[index]);
        if (matchingChild) {
          currentId = matchingChild.id;
          navigateRecursive(index + 1);
        } else {
          updateBookmarksDisplay(currentId);
        }
      });
    }
  });
}

function displayBookmarks(bookmark) {
  const bookmarksList = document.getElementById('bookmarks-list');
  const bookmarksContainer = document.querySelector('.bookmarks-container');
  if (!bookmarksList) {
    return;
  }

  // 先移除 loaded 类
  bookmarksContainer.classList.remove('loaded');
  
  const fragment = document.createDocumentFragment();
  
  let itemsToDisplay = bookmark.children || [];
  
  itemsToDisplay.sort((a, b) => a.index - b.index);
  
  itemsToDisplay.forEach((child) => {
    if (child.url) {
      const card = createBookmarkCard(child, child.index);
      fragment.appendChild(card);
    } else {
      const folderCard = createFolderCard(child, child.index);
      fragment.appendChild(folderCard);
    }
  });
  
  bookmarksList.innerHTML = '';
  bookmarksList.appendChild(fragment);
  bookmarksList.dataset.parentId = bookmark.id;
  
  // 使用 requestAnimationFrame 确保在下一帧添加 loaded 类
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      bookmarksContainer.classList.add('loaded');
    });
  });
  
  setupSortable();
}

function getColors(img) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0, img.width, img.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  let colors = {};

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a === 0) continue; // 跳过完全透明的像素
    const rgb = `${r},${g},${b}`;
    colors[rgb] = (colors[rgb] || 0) + 1;
  }

  const sortedColors = Object.entries(colors).sort((a, b) => b[1] - a[1]);
  
  if (sortedColors.length === 0) {
    // 如果图片完全透明，返回默认颜色
    return { primary: [200, 200, 200], secondary: [220, 220, 220] };
  }
  
  const primaryColor = sortedColors[0][0].split(',').map(Number);
  const secondaryColor = sortedColors.length > 1 
    ? sortedColors[1][0].split(',').map(Number)
    : primaryColor.map(c => Math.min(255, c + 20)); // 如果只有一种颜色，创建一个稍微亮的次要颜色

  return { primary: primaryColor, secondary: secondaryColor };
}



// 修改现有的颜色处理函数
function updateBookmarkColors(bookmark, img, card) {
  img.onload = function () {
    const colors = getColors(img);
    applyColors(card, colors);
    // 使用新的缓存系统
    ColorCache.set(bookmark.id, bookmark.url, colors);
  };

  img.onerror = function () {
    const defaultColors = {
      primary: [200, 200, 200],
      secondary: [220, 220, 220]
    };
    applyColors(card, defaultColors);
    ColorCache.set(bookmark.id, bookmark.url, defaultColors);
  };
}

// 修改创建书签卡片时的颜色处理
function createBookmarkCard(bookmark, index) {
  const card = document.createElement('a');
  card.href = bookmark.url;
  card.className = 'bookmark-card card';
  card.dataset.id = bookmark.id;
  card.dataset.parentId = bookmark.parentId;
  card.dataset.index = index.toString();

  const img = document.createElement('img');
  img.className = 'w-6 h-6 mr-2';
  img.src = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(bookmark.url)}&size=32`;

  // 尝试从缓存获取颜色
  const cachedColors = localStorage.getItem(`bookmark-colors-${bookmark.id}`);
  
  if (cachedColors) {
    // 如果有缓存，直接应用缓存的颜色
    const colors = JSON.parse(cachedColors);
    applyColors(card, colors);
    
    // 只加载 favicon 图片，不重新计算颜色
    img.onload = null;
  } else {
    // 只在没有缓存时计算颜色
    img.onload = function() {
      const colors = getColors(img);
      applyColors(card, colors);
      localStorage.setItem(`bookmark-colors-${bookmark.id}`, JSON.stringify(colors));
    };
  }

  img.onerror = function() {
    // 处 favicon 加载失败的情况
    const defaultColors = { primary: [200, 200, 200], secondary: [220, 220, 220] };
    applyColors(card, defaultColors);
    localStorage.setItem(`bookmark-colors-${bookmark.id}`, JSON.stringify(defaultColors));
  };

  const favicon = document.createElement('div');
  favicon.className = 'favicon';
  favicon.appendChild(img);
  card.appendChild(favicon);

  const content = document.createElement('div');
  content.className = 'card-content';

  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = bookmark.title;

  content.appendChild(title);
  card.appendChild(content);

  card.addEventListener('contextmenu', function(event) {
    event.preventDefault();
    console.log('Bookmark context menu triggered:', bookmark);
    showContextMenu(event, bookmark, 'bookmark'); // 明确指定类型为 'bookmark'
  });

  // 添加鼠标悬停效果
  card.addEventListener('mouseenter', function() {
    this.style.transform = 'scale(1.03)';
    this.style.boxShadow = '0 1px 1px rgba(0,0,0,0.01)';
    this.style.backgroundColor = 'rgba(255,255,255,1)';
  });

  card.addEventListener('mouseleave', function() {
    this.style.transform = 'scale(1)';
    this.style.boxShadow = '';
    this.style.backgroundColor = '';
  });

  return card;
}

function adjustColor(r, g, b) {
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  let factor = 1;

  if (brightness < 128) {
    // 如果颜色太暗，增加亮度
    factor = 1 + (128 - brightness) / 128;
  } else if (brightness > 200) {
    // 如果颜色太亮，减少亮度
    factor = 1 - (brightness - 200) / 55;
  }

  return {
    r: Math.min(255, Math.round(r * factor)),
    g: Math.min(255, Math.round(g * factor)),
    b: Math.min(255, Math.round(b * factor))
  };
}

function applyColors(card, colors) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const adjustedPrimary = adjustColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  const adjustedSecondary = adjustColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  
  const opacity = isDark ? '0.1' : '0.06';
  card.style.background = `linear-gradient(135deg, 
    rgba(${adjustedPrimary.r}, ${adjustedPrimary.g}, ${adjustedPrimary.b}, ${opacity}), 
    rgba(${adjustedSecondary.r}, ${adjustedSecondary.g}, ${adjustedSecondary.b}, ${opacity}))`;
  card.style.border = `1px solid rgba(${adjustedPrimary.r}, ${adjustedPrimary.g}, ${adjustedPrimary.b}, ${isDark ? '0.1' : '0.01'})`;
}

function openInNewWindow(url) {
  chrome.windows.create({ url: url }, function (window) {
    console.log('New window opened with id: ' + window.id);
  });
}

function openInIncognito(url) {
  chrome.windows.create({ url: url, incognito: true }, function (window) {
    console.log('New incognito window opened with id: ' + window.id);
  });
}

// Encapsulate toast and bookmark link copier functionality in a closure
const Utilities = (function() {
  let toastTimeout;

  function showToast(message = getLocalizedMessage('moreSearchSupportToast'), duration = 1500) {
    const toast = document.getElementById('more-button-toast');
    if (!toast) {
      console.error('Toast element not found');
      return;
    }

    // If toast is already showing, clear the previous timeout
    if (toast.classList.contains('show')) {
      clearTimeout(toastTimeout);
      toast.classList.remove('show');
      setTimeout(() => showToast(message, duration), 300); // Try showing again after a short delay
      return;
    }

    const toastMessage = toast.querySelector('p');
    if (toastMessage) {
      toastMessage.textContent = message;
    }

    toast.classList.add('show');

    toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }

  function copyBookmarkLink(bookmark) {
    try {
      if (!bookmark || !bookmark.url) {
        throw new Error('No valid bookmark link found');
      }
      navigator.clipboard.writeText(bookmark.url).then(() => {
        showToast(getLocalizedMessage('linkCopied'));
      }).catch(err => {
        console.error('Failed to copy link:', err);
        showToast(getLocalizedMessage('copyLinkFailed'));
      });
    } catch (error) {
      console.error('Error copying bookmark link:', error);
      if (error.message === 'Extension context invalidated.') {
        showToast(getLocalizedMessage('extensionReloaded'));
      } else {
        showToast(getLocalizedMessage('copyLinkFailed'));
      }
    }
  }

  return {
    showToast: showToast,
    copyBookmarkLink: copyBookmarkLink
  };
})();

// 修改 showContextMenu 函数
function showContextMenu(event, item, type = 'bookmark') {
  console.log('=== Showing Context Menu ===');
  console.log('Event:', event.type);
  console.log('Item:', item);
  console.log('Type:', type);
  console.log('Previous itemToDelete:', itemToDelete);
  console.log('Previous currentBookmark:', currentBookmark);

  // 先创建上下文菜单
  if (!contextMenu) {
    console.log('Creating new context menu');
    contextMenu = createContextMenu();
  }

  if (!contextMenu) {
    console.error('Failed to create context menu');
    return;
  }

  // 清除之前的状态
  itemToDelete = null;
  currentBookmark = null;
  
  // 设置当前项目，确保包含类型信息
  currentBookmark = {
    id: item.id || item.dataset?.id,
    title: item.title || item.querySelector?.('.card-title')?.textContent || item.querySelector?.('span')?.textContent,
    url: item.url || item.dataset?.url,
    type: item.type || type  // 优先使用项目自带的类型，否则使用传入的类型
  };

  console.log('Set currentBookmark:', currentBookmark);

  // 显示上下文菜单
  contextMenu.style.display = 'block';
  contextMenu.style.left = `${event.clientX}px`;
  contextMenu.style.top = `${event.clientY}px`;

  // 确保菜单不会超出视窗
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const menuRect = contextMenu.getBoundingClientRect();

  if (event.clientX + menuRect.width > viewportWidth) {
    contextMenu.style.left = `${viewportWidth - menuRect.width - 5}px`;
  }

  if (event.clientY + menuRect.height > viewportHeight) {
    contextMenu.style.top = `${viewportHeight - menuRect.height - 5}px`;
  }
}



// 新增函数：根据类型创建菜单项
function createContextMenuItems(contextMenu, type) {
  const menuItems = [
    { text: getLocalizedMessage('openInNewTab'), icon: 'open_in_new', action: () => currentBookmark && window.open(currentBookmark.url, '_blank') },
    { text: getLocalizedMessage('openInNewWindow'), icon: 'launch', action: () => currentBookmark && openInNewWindow(currentBookmark.url) },
    { text: getLocalizedMessage('openInIncognito'), icon: 'visibility_off', action: () => currentBookmark && openInIncognito(currentBookmark.url) },
    { text: getLocalizedMessage('editQuickLink'), icon: 'edit', action: () => currentBookmark && openEditDialog(currentBookmark) },
    { 
      text: type === 'quickLink' ? getLocalizedMessage('deleteQuickLink') : getLocalizedMessage('deleteBookmark'), 
      icon: 'delete', 
      action: () => {
        console.log('=== Delete Action Triggered ===');
        console.log('Current bookmark:', currentBookmark);
        console.log('Menu type:', type);
        
        if (!currentBookmark) {
          console.error('No item selected for deletion');
          return;
        }

        // 使用全局的 itemToDelete 变量
        itemToDelete = {
          type: currentBookmark.type,  // 使用当前项目的类型
          data: {
            id: currentBookmark.id,
            title: currentBookmark.title,
            url: currentBookmark.url,
            type: currentBookmark.type  // 确保在 data 中也保存类型信息
          }
        };
        
        console.log('Set itemToDelete:', itemToDelete);
        
        // 根据类型显示不同的确认消息
        const message = itemToDelete.type === 'quickLink' 
          ? chrome.i18n.getMessage("confirmDeleteQuickLink", [`<strong>${itemToDelete.data.title}</strong>`])
          : chrome.i18n.getMessage("confirmDeleteBookmark", [`<strong>${itemToDelete.data.title}</strong>`]);
        
        console.log('Showing confirmation dialog with message:', message);
        
        showConfirmDialog(message, () => {
          console.log('=== Delete Confirmation Callback ===');
          console.log('itemToDelete:', itemToDelete);
          
          if (itemToDelete && itemToDelete.data) {
            if (itemToDelete.type === 'quickLink') {
              console.log('Deleting quick link:', itemToDelete.data);
              deleteQuickLink(itemToDelete.data);
            } else {
              console.log('Deleting bookmark:', itemToDelete.data);
              deleteBookmark(itemToDelete.data.id, itemToDelete.data.title);
            }
          } else {
            console.error('Invalid itemToDelete state:', itemToDelete);
          }
        });
      }
    },
    { text: getLocalizedMessage('copyLink'), icon: 'content_copy', action: () => currentBookmark && Utilities.copyBookmarkLink(currentBookmark) },
    { text: getLocalizedMessage('createQRCode'), icon: 'qr_code', action: () => currentBookmark && createQRCode(currentBookmark.url, currentBookmark.title) }
  ];

  menuItems.forEach(item => {
    const menuItem = document.createElement('div');
    menuItem.className = 'custom-context-menu-item';
    
    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.innerHTML = ICONS[item.icon];
    icon.style.marginRight = '8px';
    icon.style.fontSize = '18px';
    
    const text = document.createElement('span');
    text.textContent = item.text;

    menuItem.appendChild(icon);
    menuItem.appendChild(text);

    menuItem.addEventListener('click', () => {
      if (typeof item.action === 'function') {
        item.action();
      }
      contextMenu.style.display = 'none';
    });

    menu.appendChild(menuItem);
  });
}

function showDeleteConfirmDialog() {
  if (!itemToDelete || !itemToDelete.data) {
    console.error('Invalid delete item:', itemToDelete);
    return;
  }

  console.log('=== Showing Delete Confirm Dialog ===');
  console.log('Item to delete:', itemToDelete);

  const confirmDialog = document.getElementById('confirm-dialog');
  const confirmMessage = document.getElementById('confirm-dialog-message');
  const confirmButton = document.getElementById('confirm-delete-button');
  const cancelButton = document.getElementById('cancel-delete-button');

  if (!confirmDialog || !confirmMessage || !confirmButton || !cancelButton) {
    console.error('Required dialog elements not found');
    return;
  }

  // 清空之前的消息
  confirmMessage.innerHTML = '';
  
  // 根据类型显示不同的确认消息
  const message = itemToDelete.type === 'quickLink' 
    ? chrome.i18n.getMessage("confirmDeleteQuickLink", [`<strong>${itemToDelete.data.title}</strong>`])
    : chrome.i18n.getMessage("confirmDeleteBookmark", [`<strong>${itemToDelete.data.title}</strong>`]);
  confirmMessage.innerHTML = message;
  
  console.log('Showing confirmation dialog for:', {
    type: itemToDelete.type,
    title: itemToDelete.data.title
  });
  
  confirmDialog.style.display = 'block';

  const handleConfirm = () => {
    console.log('=== Delete Confirmed ===');
    console.log('Deleting item:', itemToDelete);
    
    if (itemToDelete.type === 'quickLink') {
      deleteQuickLink(itemToDelete.data);
    } else {
      deleteBookmark(itemToDelete.data.id, itemToDelete.data.title);
    }
    
    confirmDialog.style.display = 'none';
    cleanup();
    itemToDelete = null;
  };

  const handleCancel = () => {
    console.log('=== Delete Cancelled ===');
    console.log('Cancelled item:', itemToDelete);
    confirmDialog.style.display = 'none';
    cleanup();
    itemToDelete = null;
  };

  const cleanup = () => {
    console.log('Cleaning up event listeners and state');
    confirmButton.removeEventListener('click', handleConfirm);
    cancelButton.removeEventListener('click', handleCancel);
    itemToDelete = null;
  };

  // 设置事件监听器
  confirmButton.removeEventListener('click', handleConfirm);
  cancelButton.removeEventListener('click', handleCancel);
  confirmButton.addEventListener('click', handleConfirm);
  cancelButton.addEventListener('click', handleCancel);
}

// 在创建快捷链接卡片时
function createQuickLinkCard(quickLink) {
  const card = document.createElement('div');
  card.className = 'quick-link-item-container';
  card.dataset.url = quickLink.url;
  card.dataset.id = quickLink.id;
  card.dataset.type = 'quickLink';  // 明确设置类型

  // ... 其他代码保持不变 ...

  card.addEventListener('contextmenu', function(event) {
    event.preventDefault();
    console.log('=== Quick Link Context Menu Triggered ===');
    console.log('Quick link data:', quickLink);
    console.log('Card dataset:', this.dataset);
    
    // 构造完整的快捷链接对象
    const quickLinkData = {
      id: quickLink.id || this.dataset.id,
      title: quickLink.title || this.querySelector('span').textContent,
      url: quickLink.url || this.dataset.url,
      type: 'quickLink'  // 明确指定类型
    };
    
    console.log('Constructed quickLinkData:', quickLinkData);
    showContextMenu(event, quickLinkData, 'quickLink');
  });

  // ... 其他代码保持不变 ...
}

// 在确认对话框关闭时清理数据
function closeConfirmDialog() {
  const confirmDialog = document.getElementById('confirm-dialog');
  if (confirmDialog) {
    confirmDialog.style.display = 'none';
    // 清理所有相关数据
    currentBookmark = null;
    itemToDelete = null;
  }
}

// 分别定义两个函数处理不同类型的删除
function confirmBookmarkDeletion(bookmark) {
  console.log('=== Starting Bookmark Deletion Process ===');
  console.log('Input bookmark:', bookmark);
  console.log('Current states before setting:', {
    itemToDelete,
    currentBookmark
  });

  if (!bookmark || !bookmark.id) {
    console.error('Invalid bookmark data:', bookmark);
    return;
  }

  // 设置当前要删除的书签
  itemToDelete = { ...bookmark };
  
  console.log('States after setting bookmark:', {
    itemToDelete,
    currentBookmark
  });

  const confirmDialog = document.getElementById('confirm-dialog');
  const confirmMessage = document.getElementById('confirm-dialog-message');
  const confirmButton = document.getElementById('confirm-delete-button');
  const cancelButton = document.getElementById('cancel-delete-button');

  if (!confirmDialog || !confirmMessage || !confirmButton || !cancelButton) {
    console.error('Required dialog elements not found');
    return;
  }

  // 清空之前的消息
  confirmMessage.innerHTML = '';
  
  // 只显示书签删除的确认消息
  confirmMessage.innerHTML = chrome.i18n.getMessage(
    "confirmDeleteBookmark", 
    [`<strong>${bookmark.title}</strong>`]
  );
  
  confirmDialog.style.display = 'block';

  const handleConfirm = () => {
    console.log('=== Bookmark Deletion Confirmed ===');
    console.log('Deleting bookmark:', itemToDelete);
    deleteBookmark(itemToDelete);
    confirmDialog.style.display = 'none';
    cleanup();
    clearDeleteStates();
  };

  const handleCancel = () => {
    console.log('=== Bookmark Deletion Cancelled ===');
    console.log('States before cleanup:', {
      itemToDelete,
      currentBookmark
    });
    confirmDialog.style.display = 'none';
    cleanup();
    clearDeleteStates();
  };

  const cleanup = () => {
    confirmButton.removeEventListener('click', handleConfirm);
    cancelButton.removeEventListener('click', handleCancel);
  };

  // 设置事件监听器
  confirmButton.removeEventListener('click', handleConfirm);
  cancelButton.removeEventListener('click', handleCancel);
  confirmButton.addEventListener('click', handleConfirm);
  cancelButton.addEventListener('click', handleCancel);
}

function confirmQuickLinkDeletion(quickLink) {
  console.log('=== Starting QuickLink Deletion Process ===');
  console.log('Input quickLink:', quickLink);
  console.log('Current states before setting:', {
    itemToDelete,
    currentBookmark
  });

  if (!quickLink || !quickLink.id) {
    console.error('Invalid quick link data:', quickLink);
    return;
  }

  // 设置当前要删除的快捷链接
  itemToDelete = { ...quickLink };

  console.log('States after setting quickLink:', {
    itemToDelete,
    currentBookmark
  });

  const confirmDialog = document.getElementById('confirm-dialog');
  const confirmMessage = document.getElementById('confirm-dialog-message');
  const confirmButton = document.getElementById('confirm-delete-button');
  const cancelButton = document.getElementById('cancel-delete-button');

  if (!confirmDialog || !confirmMessage || !confirmButton || !cancelButton) {
    console.error('Required dialog elements not found');
    return;
  }

  // 清空之前的消息
  confirmMessage.innerHTML = '';
  
  // 只显示快捷链接删除的确认消息
  confirmMessage.innerHTML = chrome.i18n.getMessage(
    "confirmDeleteQuickLink", 
    [`<strong>${quickLink.title}</strong>`]
  );
  
  confirmDialog.style.display = 'block';

  const handleConfirm = () => {
    console.log('=== QuickLink Deletion Confirmed ===');
    console.log('Deleting quickLink:', itemToDelete);
    deleteQuickLink(itemToDelete);
    confirmDialog.style.display = 'none';
    cleanup();
    clearDeleteStates();
  };

  const handleCancel = () => {
    console.log('=== QuickLink Deletion Cancelled ===');
    console.log('States before cleanup:', {
      itemToDelete,
      currentBookmark
    });
    confirmDialog.style.display = 'none';
    cleanup();
    clearDeleteStates();
  };

  const cleanup = () => {
    console.log('Cleaning up QuickLink deletion event listeners');
    confirmButton.removeEventListener('click', handleConfirm);
    cancelButton.removeEventListener('click', handleCancel);
  };

  // 设置事件监听器
  confirmButton.removeEventListener('click', handleConfirm);
  cancelButton.removeEventListener('click', handleCancel);
  confirmButton.addEventListener('click', handleConfirm);
  cancelButton.addEventListener('click', handleCancel);
}

// 新增：清理所有删除相关的状态
function clearDeleteStates() {
  console.log('=== Clearing All Delete States ===');
  console.log('States before clearing:', {
    itemToDelete,
    currentBookmark
  });
  
  itemToDelete = null;
  currentBookmark = null;
  
  console.log('States after clearing:', {
    itemToDelete,
    currentBookmark
  });
}

// 修改 showConfirmDialog 函数
function showConfirmDialog(message, callback) {
  console.log('=== Showing Confirm Dialog ===');
  // 先保存当前状态的副本
  const currentState = {
    itemToDelete: itemToDelete ? { ...itemToDelete } : null,
    currentBookmark: currentBookmark ? { ...currentBookmark } : null,
    type: itemToDelete ? itemToDelete.type : 'unknown'  // 从 itemToDelete 获取类型
  };
  
  console.log('Current state:', currentState);
  
  const confirmDialog = document.getElementById('confirm-dialog');
  const confirmMessage = document.getElementById('confirm-dialog-message');
  const confirmQuickLinkMessage = document.getElementById('confirm-delete-quick-link-message');
  const confirmButton = document.getElementById('confirm-delete-button');
  const cancelButton = document.getElementById('cancel-delete-button');

  if (!confirmDialog || !confirmMessage || !confirmButton || !cancelButton) {
    console.error('Required dialog elements not found');
    return;
  }

  // 清空所有确认消息
  confirmMessage.innerHTML = '';
  if (confirmQuickLinkMessage) {
    confirmQuickLinkMessage.innerHTML = '';
    confirmQuickLinkMessage.style.display = 'none';
  }
  
  // 根据 itemToDelete 的类型显示相应的消息
  if (itemToDelete && itemToDelete.type === 'quickLink') {
    if (confirmQuickLinkMessage) {
      confirmQuickLinkMessage.innerHTML = message;
      confirmQuickLinkMessage.style.display = 'block';
      confirmMessage.style.display = 'none';
    }
  } else {
    confirmMessage.innerHTML = message;
    confirmMessage.style.display = 'block';
    if (confirmQuickLinkMessage) {
      confirmQuickLinkMessage.style.display = 'none';
    }
  }

  confirmDialog.style.display = 'block';

  const handleConfirm = () => {
    console.log('Confirm clicked. Current state:', currentState);
    if (typeof callback === 'function') {
      callback();
    }
    confirmDialog.style.display = 'none';
    cleanup();
  };

  const handleCancel = () => {
    console.log('Cancel clicked. Clearing state...');
    confirmDialog.style.display = 'none';
    
    // 清空所有确认消息
    confirmMessage.innerHTML = '';
    confirmMessage.style.display = 'block';
    if (confirmQuickLinkMessage) {
      confirmQuickLinkMessage.innerHTML = '';
      confirmQuickLinkMessage.style.display = 'none';
    }
    
    // 使用之前保存的状态副本记录日志
    console.log('State before cancel:', currentState);
    
    clearAllStates();
    cleanup();
  };

  const cleanup = () => {
    console.log('Cleaning up event listeners');
    confirmButton.removeEventListener('click', handleConfirm);
    cancelButton.removeEventListener('click', handleCancel);
  };

  // 移除旧的事件监听器并添加新的
  confirmButton.removeEventListener('click', handleConfirm);
  cancelButton.removeEventListener('click', handleCancel);
  confirmButton.addEventListener('click', handleConfirm);
  cancelButton.addEventListener('click', handleCancel);
}

// 新增一个函数来清理所有状态
function clearAllStates() {
  console.log('=== Clearing All States ===');
  console.log('States before clearing:', {
    itemToDelete,
    currentBookmark,
    contextMenu
  });
  
  itemToDelete = null;
  currentBookmark = null;
  
  // 隐藏上下文菜单
  if (contextMenu) {
    contextMenu.style.display = 'none';
  }
  
  console.log('States after clearing:', {
    itemToDelete,
    currentBookmark,
    contextMenu
  });
}

function handleBookmarkDeletion() {
  console.log('=== Handling Bookmark Deletion ===');
  console.log('Current itemToDelete:', itemToDelete);
  
  if (!itemToDelete || !itemToDelete.data) {
    console.error('No valid bookmark to delete');
    Utilities.showToast(getLocalizedMessage('deleteBookmarkError'));
    clearAllStates();
    return;
  }

  chrome.bookmarks.remove(itemToDelete.data.id, function() {
    if (chrome.runtime.lastError) {
      console.error('Error deleting bookmark:', chrome.runtime.lastError);
      Utilities.showToast(chrome.i18n.getMessage('deleteBookmarkError'));    
    } else {
      console.log(`Bookmark deleted successfully: ID=${itemToDelete.data.id}, Title=${itemToDelete.data.title}`);
      Utilities.showToast(getLocalizedMessage('deleteSuccess'));
      
      // 更新显示
      const bookmarksList = document.getElementById('bookmarks-list');
      if (bookmarksList && bookmarksList.dataset.parentId) {
        updateBookmarksDisplay(bookmarksList.dataset.parentId);
      }
    }
    // 清理所有状态
    clearAllStates();
  });
}

function deleteBookmark(bookmarkId, bookmarkTitle) {
  if (!bookmarkId) {
    console.error('No bookmark ID provided for deletion');
    return;
  }

  chrome.bookmarks.remove(bookmarkId, function() {
    if (chrome.runtime.lastError) {
      console.error('Error deleting bookmark:', chrome.runtime.lastError);
      Utilities.showToast(getLocalizedMessage('deleteBookmarkError'));
    } else {
      console.log(`Bookmark deleted: ID=${bookmarkId}, Title=${bookmarkTitle}`);
      Utilities.showToast(getLocalizedMessage('deleteSuccess'));
      
      // 更新显示
      const parentId = document.getElementById('bookmarks-list').dataset.parentId;
      if (parentId) {
        updateBookmarksDisplay(parentId);
      }
    }
  });
}

function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) {
    console.error('Toast element not found');
    return;
  }
  toast.textContent = message;
  toast.style.display = 'block';
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.style.display = 'none';
    }, 300);
  }, duration);
}



function createFolderCard(folder, index) {
  const card = document.createElement('div');
  card.className = 'bookmark-folder card';
  card.dataset.id = folder.id;
  card.dataset.parentId = folder.parentId;
  card.dataset.index = index.toString();

  const icon = document.createElement('span');
  icon.className = 'material-icons mr-2';
  icon.innerHTML = ICONS.folder;
  
  const content = document.createElement('div');
  content.className = 'card-content';
  
  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = folder.title;
  
  content.appendChild(title);
  card.appendChild(icon);
  card.appendChild(content);

  // Add click event handler to display folder contents
  card.addEventListener('click', function() {
    updateBookmarksDisplay(folder.id);
    updateFolderName(folder.id);
  });

  // 从缓存获取文件夹颜色
  const cachedColors = ColorCache.get(folder.id, 'folder');
  if (cachedColors) {
    applyColors(card, cachedColors);
  } else {
    // 为文件夹生成默认颜色
    const defaultColors = {
      primary: [230, 230, 230],    // 稍微浅一点的灰色
      secondary: [240, 240, 240]    // 更浅的灰色
    };
    applyColors(card, defaultColors);
    ColorCache.set(folder.id, 'folder', defaultColors);
  }

  // 修改右键点击事件，使用文件夹的上下文菜单
  card.addEventListener('contextmenu', function (event) {
    event.preventDefault();
    event.stopPropagation();
    
    // 确保文件夹上下文菜单存在
    if (!bookmarkFolderContextMenu) {
      bookmarkFolderContextMenu = createBookmarkFolderContextMenu();
    }

    if (!bookmarkFolderContextMenu) {
      console.error('Failed to create bookmark folder context menu');
      return;
    }

    currentBookmarkFolder = card;
    
    // 设置菜单位置
    bookmarkFolderContextMenu.style.display = 'block';
    bookmarkFolderContextMenu.style.top = `${event.clientY}px`;
    bookmarkFolderContextMenu.style.left = `${event.clientX}px`;

    // 确保菜单不会超出视窗
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuRect = bookmarkFolderContextMenu.getBoundingClientRect();

    if (event.clientX + menuRect.width > viewportWidth) {
      bookmarkFolderContextMenu.style.left = `${viewportWidth - menuRect.width - 5}px`;
    }

    if (event.clientY + menuRect.height > viewportHeight) {
      bookmarkFolderContextMenu.style.top = `${viewportHeight - menuRect.height - 5}px`;
    }

    // 隐藏书签卡片的上下文菜单
    if (contextMenu) {
      contextMenu.style.display = 'none';
    }
  });

  return card;
}

function setupSortable() {
  const bookmarksList = document.getElementById('bookmarks-list');
  if (bookmarksList) {
    new Sortable(bookmarksList, {
      animation: 150,
      onEnd: function (evt) {
        const itemId = evt.item.dataset.id;
        const newParentId = bookmarksList.dataset.parentId;
        const newIndex = evt.newIndex;

        showMovingFeedback(evt.item);

        moveBookmark(itemId, newParentId, newIndex)
          .then(() => {
            hideMovingFeedback(evt.item);
            showSuccessFeedback(evt.item);
          })
          .catch(error => {
            console.error('Error moving bookmark:', error);
            hideMovingFeedback(evt.item);
            showErrorFeedback(evt.item);
            syncBookmarkOrder(newParentId);
          });
      }
    });
  } else {
    console.error('Bookmarks list element not found');
  }

  const categoriesList = document.getElementById('categories-list');
  if (categoriesList) {
    new Sortable(categoriesList, {
      animation: 150,
      group: 'nested',
      fallbackOnBody: true,
      swapThreshold: 0.65,
      onStart: function (evt) {
        console.log('Category drag started:', evt.item.dataset.id);
      },
      onEnd: function (evt) {
        const itemEl = evt.item;
        const newIndex = evt.newIndex;
        const bookmarkId = itemEl.dataset.id;
        const newParentId = evt.to.closest('li') ? evt.to.closest('li').dataset.id : '1';

        console.log('Category moved:', {
          bookmarkId: bookmarkId,
          newParentId: newParentId,
          oldIndex: evt.oldIndex,
          newIndex: newIndex,
          fromList: evt.from.id,
          toList: evt.to.id
        });

        if (evt.oldIndex !== evt.newIndex || evt.from !== evt.to) {
          moveBookmark(bookmarkId, newParentId, newIndex);
        }
      }
    });

    const folders = categoriesList.querySelectorAll('li ul');
    folders.forEach((folder, index) => {
      new Sortable(folder, {
        group: 'nested',
        animation: 150,
        fallbackOnBody: true,
        swapThreshold: 0.65,
        onStart: function (evt) {
          console.log('Subfolder drag started:', evt.item.dataset.id);
        },
        onEnd: function (evt) {
          const itemEl = evt.item;
          const newIndex = evt.newIndex;
          const bookmarkId = itemEl.dataset.id;
          const newParentId = evt.to.closest('li') ? evt.to.closest('li').dataset.id : '1';

          console.log('Subfolder item moved:', {
            bookmarkId: bookmarkId,
            newParentId: newParentId,
            oldIndex: evt.oldIndex,
            newIndex: newIndex,
            fromList: evt.from.id,
            toList: evt.to.id
          });

          if (evt.oldIndex !== evt.newIndex || evt.from !== evt.to) {
            moveBookmark(bookmarkId, newParentId, newIndex);
          }
        }
      });
    });
  } else {
    console.error('Categories list element not found');
  }
}

function moveBookmark(itemId, newParentId, newIndex) {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.move(itemId, { index: newIndex }, (result) => {
      if (chrome.runtime.lastError) {
        console.error('Error moving bookmark:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        console.log(`Bookmark ${itemId} moved to index ${result.index}`);
        updateAffectedBookmarks(newParentId, itemId, result.index)
          .then(() => {
            console.log(`Bookmark ${itemId} position updated in UI`);
            resolve(result);
          })
          .catch(reject);
      }
    });
  });
}

function updateAffectedBookmarks(parentId, movedItemId, newIndex) {
  return new Promise((resolve, reject) => {
    const bookmarksList = document.getElementById('bookmarks-list');
    const bookmarkElements = Array.from(bookmarksList.children);
    const movedElement = bookmarksList.querySelector(`[data-id="${movedItemId}"]`);
    
    if (!movedElement) {
      console.error('Moved element not found');
      reject(new Error('Moved element not found'));
      return;
    }

    const oldIndex = bookmarkElements.indexOf(movedElement);
    
    // 如置没有变化，不需要更新
    if (oldIndex === newIndex) {
      resolve();
      return;
    }

    // 移动元素到新位置
    if (newIndex >= bookmarkElements.length) {
      bookmarksList.appendChild(movedElement);
    } else {
      bookmarksList.insertBefore(movedElement, bookmarksList.children[newIndex]);
    }

    // 更新所有书签的索引
    bookmarkElements.forEach((element, index) => {
      element.dataset.index = index.toString();
    });

    // 更新本地缓存
    bookmarkOrderCache[parentId] = bookmarkElements.map(el => el.dataset.id);

    highlightBookmark(movedItemId);
    console.log(`UI updated: Bookmark ${movedItemId} moved from ${oldIndex} to ${newIndex}`);
    resolve();
  });
}

function highlightBookmark(itemId) {
  const bookmarkElement = document.querySelector(`[data-id="${itemId}"]`);
  if (bookmarkElement) {
    bookmarkElement.style.transition = 'background-color 0.5s ease';
    bookmarkElement.style.backgroundColor = '#ffff99';
    setTimeout(() => {
      bookmarkElement.style.backgroundColor = '';
    }, 1000);
  }
}

function displayBookmarkCategories(bookmarkNodes, level, parentUl, parentId) {
  const categoriesList = parentUl || document.getElementById('categories-list');

  if (parentId === '1') {
    categoriesList.style.display = 'block';
  }

  bookmarkNodes.forEach(function (bookmark) {
    if (bookmark.children && bookmark.children.length > 0) {
      let li = document.createElement('li');
      li.className = 'cursor-pointer p-2 hover:bg-emerald-500 rounded-lg flex items-center folder-item';
      li.style.paddingLeft = `${(level * 20) + 8}px`;
      li.dataset.title = bookmark.title;
      li.dataset.id = bookmark.id;

      let span = document.createElement('span');
      span.textContent = bookmark.title;

      const folderIcon = document.createElement('span');
      folderIcon.className = 'material-icons mr-2';
      folderIcon.innerHTML = ICONS.folder;
      li.insertBefore(folderIcon, li.firstChild);

      const hasSubfolders = bookmark.children.some(child => child.children);
      let arrowIcon;
      if (hasSubfolders) {
        arrowIcon = document.createElement('span');
        arrowIcon.className = 'material-icons ml-auto';
        arrowIcon.innerHTML = ICONS.chevron_right;
        li.appendChild(arrowIcon);
      }

      let sublist = document.createElement('ul');
      sublist.className = 'pl-4 space-y-2';

      sublist.style.display = 'none';

      li.addEventListener('click', function (event) {
        event.stopPropagation();
        if (hasSubfolders) {
          let isExpanded = sublist.style.display === 'block';
          sublist.style.display = isExpanded ? 'none' : 'block';
          if (arrowIcon) {
            arrowIcon.innerHTML = isExpanded ? ICONS.chevron_right : ICONS.expand_less;
          }
        }

        document.querySelectorAll('#categories-list li').forEach(function (item) {
          item.classList.remove('bg-emerald-500');
        });
        li.classList.add('bg-emerald-500');

        updateBookmarksDisplay(bookmark.id);
      });

      li.appendChild(span);
      categoriesList.appendChild(li);
      categoriesList.appendChild(sublist);

      displayBookmarkCategories(bookmark.children, level + 1, sublist, bookmark.id);
    }
  });

  setupSortable();
}
// 添加一个获取文件夹内书签数量的函数
function getFolderBookmarkCount(folderId) {
  return new Promise((resolve) => {
    let count = 0;

    function countBookmarks(bookmarkNodes) {
      bookmarkNodes.forEach(node => {
        if (node.url) {
          count++;
        }
        if (node.children) {
          countBookmarks(node.children);
        }
      });
    }

    chrome.bookmarks.getChildren(folderId, (children) => {
      if (chrome.runtime.lastError) {
        resolve(0);
        return;
      }
      countBookmarks(children);
      resolve(count);
    });
  });
}
// 创建文件夹上下文菜单
function createBookmarkFolderContextMenu() {
  console.log('Creating folder context menu');

  // 移除任何已存在的上下文菜单
  const existingMenu = document.querySelector('.bookmark-folder-context-menu');
  if (existingMenu) {
    existingMenu.remove();
  }

  const menu = document.createElement('div');
  menu.className = 'bookmark-folder-context-menu custom-context-menu';
  document.body.appendChild(menu);

  // 直接创建菜单项，不需要获取书签数量
  createMenuItems(menu);

  return menu;
}

function createMenuItems(menu) {  
  const menuItems = [
    { 
      text: getLocalizedMessage('openAllBookmarks'),
      icon: 'open_in_new',  
      action: () => {
        if (currentBookmarkFolder) {
          const folderId = currentBookmarkFolder.dataset.id;
          const folderTitle = currentBookmarkFolder.querySelector('.card-title').textContent;
          
          chrome.bookmarks.getChildren(folderId, (bookmarks) => {
            // 过滤出有效的书签URL
            const validUrls = bookmarks
              .filter(bookmark => bookmark.url)
              .map(bookmark => bookmark.url);

            if (validUrls.length > 0) {
              // 使用 chrome.runtime.sendMessage 发送消息给后台脚本
              chrome.runtime.sendMessage({
                action: 'openMultipleTabsAndGroup',
                urls: validUrls,
                groupName: folderTitle // 使用文件夹名称作为标签组名称
              }, (response) => {
                if (response.success) {
                  console.log('Bookmarks opened in new tab group');
                } else {
                  console.error('Error opening bookmarks:', response.error);
                }
              });
            }
          });
        }
      }
    },
    // 原有的菜单项
    { text: getLocalizedMessage('rename'), icon: 'edit', action: () => currentBookmarkFolder && openEditBookmarkFolderDialog(currentBookmarkFolder) },
    { text: getLocalizedMessage('delete'), icon: 'delete', action: () => {
      if (currentBookmarkFolder) {
        const folderId = currentBookmarkFolder.dataset.id;
        const folderTitle = currentBookmarkFolder.querySelector('.card-title').textContent;
        showConfirmDialog(chrome.i18n.getMessage("confirmDeleteFolder", [`<strong>${folderTitle}</strong>`]), () => {
          chrome.bookmarks.removeTree(folderId, () => {
            currentBookmarkFolder.remove();
            Utilities.showToast(getLocalizedMessage('categoryDeleted'));
          });
        });
      }
    }},
    { text: getLocalizedMessage('setAsHomepage'), icon: 'home', action: () => currentBookmarkFolder && setDefaultBookmark(currentBookmarkFolder.dataset.id) }
  ];

  // 创建菜单项的其余代码保持不变
  menuItems.forEach(item => {
    const menuItem = document.createElement('div');
    menuItem.className = 'custom-context-menu-item';
    
    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.innerHTML = ICONS[item.icon];
    icon.style.marginRight = '8px';
    icon.style.fontSize = '18px';
    
    const text = document.createElement('span');
    text.textContent = item.text;

    menuItem.appendChild(icon);
    menuItem.appendChild(text);

    menuItem.addEventListener('click', () => {
      if (typeof item.action === 'function') {
        item.action();
      }
      menu.style.display = 'none';
    });

    menu.appendChild(menuItem);
  });
}

// 修改文件夹上下文菜单事件监听
document.addEventListener('contextmenu', function (event) {
  const targetFolder = event.target.closest('.bookmark-folder');
  const targetCard = event.target.closest('.bookmark-card');
  
  if (targetFolder) {
    event.preventDefault();
    
    // 确保文件夹上下文菜单存在
    if (!bookmarkFolderContextMenu) {
      bookmarkFolderContextMenu = createBookmarkFolderContextMenu();
    }

    if (!bookmarkFolderContextMenu) {
      console.error('Failed to create bookmark folder context menu');
      return;
    }

    currentBookmarkFolder = targetFolder;
    
    // 设置菜单位置
    bookmarkFolderContextMenu.style.display = 'block';
    bookmarkFolderContextMenu.style.top = `${event.clientY}px`;
    bookmarkFolderContextMenu.style.left = `${event.clientX}px`;

    // 确保菜单不会超出视窗
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuRect = bookmarkFolderContextMenu.getBoundingClientRect();

    if (event.clientX + menuRect.width > viewportWidth) {
      bookmarkFolderContextMenu.style.left = `${viewportWidth - menuRect.width - 5}px`;
    }

    if (event.clientY + menuRect.height > viewportHeight) {
      bookmarkFolderContextMenu.style.top = `${viewportHeight - menuRect.height - 5}px`;
    }

    // 隐藏书签卡片的上下文菜单
    if (contextMenu) {
      contextMenu.style.display = 'none';
    }
  } else if (targetCard) {
    event.preventDefault();
    // 确保在显示菜单前重置当前书签信息
    currentBookmark = {
      id: targetCard.dataset.id,
      url: targetCard.href,
      title: targetCard.querySelector('.card-title').textContent
    };
    
    // 隐藏文件夹的上下文菜单
    if (bookmarkFolderContextMenu) {
      bookmarkFolderContextMenu.style.display = 'none';
    }
    
    // 显示书签卡片的上下文菜单
    contextMenu.style.top = `${event.clientY}px`;
    contextMenu.style.left = `${event.clientX}px`;
    contextMenu.style.display = 'block';
  } else {
    // 点击在其他地方，隐藏所有上下文菜单
    if (contextMenu) {
      contextMenu.style.display = 'none';
      currentBookmark = null;
    }
    if (bookmarkFolderContextMenu) {
      bookmarkFolderContextMenu.style.display = 'none';
      currentBookmarkFolder = null;
    }
  }
});

// 在点击其他地方时隐藏菜单
document.addEventListener('click', function (event) {
  if (bookmarkFolderContextMenu && !event.target.closest('.bookmark-folder')) {
    bookmarkFolderContextMenu.style.display = 'none';
  }
});

// 添加文件夹相关的全局变量
// Add event listeners or logic that uses these variables
document.addEventListener('DOMContentLoaded', () => {
  // Example initialization logic
  bookmarkFolderContextMenu = document.querySelector('#bookmark-folder-context-menu');
  currentBookmarkFolder = document.querySelector('.bookmark-folder.active');

  // Ensure these elements exist before using them
  if (bookmarkFolderContextMenu && currentBookmarkFolder) {
    // Add your event listeners or logic here
  }
});


function openEditBookmarkFolderDialog(folderElement) {
  const folderId = folderElement.dataset.id;
  const folderTitle = folderElement.querySelector('.card-title').textContent;

  const editCategoryNameInput = document.getElementById('edit-category-name');
  const editCategoryDialog = document.getElementById('edit-category-dialog');
  const editCategoryForm = document.getElementById('edit-category-form');

  editCategoryNameInput.value = folderTitle;
  editCategoryDialog.style.display = 'block';

  editCategoryForm.onsubmit = function (event) {
    event.preventDefault();
    const newTitle = editCategoryNameInput.value;
    chrome.bookmarks.update(folderId, { title: newTitle }, function () {
      console.log('Bookmark updated:', folderId, newTitle);
      updateCategoryUI(folderId, newTitle);
      updateFolderName(folderId);
      editCategoryDialog.style.display = 'none';
    });
  };
}

function updateCategoryUI(folderId, newTitle) {
  console.log('Updating UI for folder:', folderId, newTitle);

  // 更新侧边栏中的文件夹名称
  const sidebarItem = document.querySelector(`#categories-list li[data-id="${folderId}"]`);
  if (sidebarItem) {
    // 更新文本内
    const textSpan = sidebarItem.querySelector('span:not(.material-icons)');
    if (textSpan) {
      textSpan.textContent = newTitle;
      console.log('Updated sidebar item text:', newTitle);
    }

    // 更新 data-title 属性
    sidebarItem.setAttribute('data-title', newTitle);

    // 更新样式
    sidebarItem.classList.add('updated-folder');
    setTimeout(() => {
      sidebarItem.classList.remove('updated-folder');
    }, 2000); // 2秒后移除高亮效果

    console.log('Updated sidebar item:', sidebarItem);
  } else {
    console.log('Sidebar item not found for folder:', folderId);
  }

  // 更新面包屑导航
  updateFolderName(folderId);

  // 更新文件夹卡片（如果在当前视图中）
  const folderCard = document.querySelector(`.bookmark-folder[data-id="${folderId}"]`);
  if (folderCard) {
    const titleElement = folderCard.querySelector('.card-title');
    if (titleElement) {
      titleElement.textContent = newTitle;
      console.log('Updated folder card:', newTitle);
    }
  }

  console.log('UI update complete for folder:', folderId);
}


function showFolder(folderId) {
  // 显示侧边栏的文件夹
  const sidebarFolderElement = document.querySelector(`#categories-list li[data-id="${folderId}"]`);
  if (sidebarFolderElement) {
    sidebarFolderElement.style.display = '';
    // 如果文夹之前是展开的，显示其子列表
    const sublist = sidebarFolderElement.nextElementSibling;
    if (sublist && sublist.tagName === 'UL') {
      sublist.style.display = '';

    }
  } else {
    console.log('Sidebar folder element not found');
  }

  // 显示内容区域中的文件夹内容（如果当前显示的是该文夹的内容）
  const bookmarksList = document.getElementById('bookmarks-list');
  if (bookmarksList.dataset.parentId === folderId) {
    bookmarksList.style.display = '';

  }

  // 显示文件夹卡片
  const folderCard = document.querySelector(`.bookmark-folder[data-id="${folderId}"]`);
  if (folderCard) {
    folderCard.style.display = '';

  } else {
    console.log('Folder card not found');
  }
}

function setDefaultBookmark(bookmarkId) {

  localStorage.setItem('defaultBookmarkId', bookmarkId);
  updateDefaultBookmarkIndicator();
  selectSidebarFolder(bookmarkId);


  // 刷新 bookmarks-container
  updateBookmarksDisplay(bookmarkId);

  // 更新侧边栏中的默认书签指示和选中状态
  updateSidebarDefaultBookmarkIndicator();

  // 通知背景脚本更新默认书签ID
  chrome.runtime.sendMessage({ action: 'setDefaultBookmarkId', defaultBookmarkId: bookmarkId }, function (response) {
    if (response && response.success) {
      console.log('Background script has updated the defaultBookmarkId');
    }
  });
}

function updateSidebarDefaultBookmarkIndicator() {
  const defaultBookmarkId = localStorage.getItem('defaultBookmarkId');
  console.log('Updating sidebar indicator for:', defaultBookmarkId);
  selectSidebarFolder(defaultBookmarkId);
  
  const allCategories = document.querySelectorAll('#categories-list li');
  allCategories.forEach(category => {
    const indicator = category.querySelector('.default-indicator');
    if (indicator) {
      indicator.remove();
    }
    if (category.dataset.id === defaultBookmarkId) {
      console.log('Adding indicator to:', category.dataset.id);
      const defaultIndicator = document.createElement('span');
      defaultIndicator.className = 'default-indicator material-icons';
      defaultIndicator.textContent = 'star';
      defaultIndicator.title = getLocalizedMessage('homepage');
      category.appendChild(defaultIndicator);
    }
  });
}

// 添加局变量来存储本地缓存
let bookmarkOrderCache = {};

// 添加一函数来同步本地缓存和 Chrome 书签
function syncBookmarkOrder(parentId) {
  const cached = bookmarksCache.get(parentId);
  if (!cached) return;
  
  
  chrome.bookmarks.getChildren(parentId, (bookmarks) => {
    const chromeOrder = bookmarks.map(b => b.id);
    const cachedOrder = cached.bookmarks.map(b => b.id);
    
    if (JSON.stringify(chromeOrder) !== JSON.stringify(cachedOrder)) {
      // 更新缓存
      bookmarksCache.set(parentId, bookmarks);
      
      // 重新渲染当前页
      renderBookmarksPage({ bookmarks, totalCount: bookmarks.length }, 0);
    }
  });
}

// 添加一个定期同步函数
function startPeriodicSync() {
  setInterval(() => {
      const bookmarksList = document.getElementById('bookmarks-list');
      if (bookmarksList && bookmarksList.dataset.parentId) {
      const currentParentId = bookmarksList.dataset.parentId;
      try {
        syncBookmarkOrder(currentParentId);
      } catch (error) {
        console.error('Error during bookmark sync:', error);
      }
    }
  }, 30000); // 每30秒同步一次
}

let isRequestPending = false;

function setupSpecialLinks() {
  const specialLinks = document.querySelectorAll('.links-icons a, .settings-icon a');
  let isProcessingClick = false;

  specialLinks.forEach(link => {
    link.addEventListener('click', async function (e) {
      e.preventDefault();
      if (isProcessingClick) return;

      isProcessingClick = true;

      const href = this.getAttribute('href');
      let chromeUrl;
      switch (href) {
        case '#history':
          chromeUrl = 'chrome://history';
          break;
        case '#downloads':
          chromeUrl = 'chrome://downloads';
          break;
        case '#passwords':
          chromeUrl = 'chrome://settings/passwords';
          break;
        case '#extensions':
          chromeUrl = 'chrome://extensions';
          break;
        case '#settings':
          openSettingsModal();
          isProcessingClick = false; // 立即重置标志，因为不需要等待异步操作
          return; // 直接返回，不需要执行后面的代码
        default:
          console.error('Unknown special link:', href);
          isProcessingClick = false;
          return;
      }

      try {
        const response = await chrome.runtime.sendMessage({ action: 'openInternalPage', url: chromeUrl });
        if (response && response.success) {
          console.log('Successfully opened internal page:', response.message);
        } else if (response) {
          console.error('Failed to open internal page:', response.error);
        } else {
          console.error('No response received');
        }
      } catch (error) {
        console.error('Error opening internal page:', error);
      } finally {
        setTimeout(() => {
          isProcessingClick = false;
        }, 1000); // 添加一个短暂的延迟，防止快速重复点击
      }
    });
  });
}

function updateDefaultBookmarkIndicator() {
  const defaultBookmarkId = localStorage.getItem('defaultBookmarkId');
  const allBookmarks = document.querySelectorAll('.bookmark-card, .bookmark-folder');
  allBookmarks.forEach(bookmark => {
    const indicator = bookmark.querySelector('.default-indicator');
    if (indicator) {
      indicator.remove();
    }
    if (bookmark.dataset.id === defaultBookmarkId) {
      const defaultIndicator = document.createElement('span');
      defaultIndicator.className = 'default-indicator material-icons';
      defaultIndicator.textContent = 'star';
      defaultIndicator.title = getLocalizedMessage('homepage');
      bookmark.appendChild(defaultIndicator);
    }
  });
}

function selectSidebarFolder(folderId) {
  const allFolders = document.querySelectorAll('#categories-list li');
  allFolders.forEach(folder => {
    folder.classList.remove('bg-emerald-500');
    if (folder.dataset.id === folderId) {
      folder.classList.add('bg-emerald-500');
    }
  });
}
function openSettingsModal() {
  const settingsModal = document.getElementById('settings-modal');
  if (settingsModal) {
    settingsModal.style.display = 'block';
    // 强制浏览器重新计算样式，确保模糊效果立即生效
    settingsModal.offsetHeight;
  } else {
    console.error('Settings modal not found');
  }
}


// 确在 DOMContentLoaded 事件初始化上文菜单
document.addEventListener('DOMContentLoaded', function () {
  // ... 其他初始化代码 ...
  createBookmarkFolderContextMenu();
  // 获取模态对话框元素
  const settingsIcon = document.querySelector('.settings-icon a');
  const settingsModal = document.getElementById('settings-modal');
  const closeButton = document.querySelector('.settings-modal-close');
  const tabButtons = document.querySelectorAll('.settings-tab-button');
  const tabContents = document.querySelectorAll('.settings-tab-content');
  const bgOptions = document.querySelectorAll('.settings-bg-option');

  // 打开设置模态框
  settingsIcon.addEventListener('click', function (e) {
    e.preventDefault();
    settingsModal.style.display = 'block';
  });

  // 关闭设置模态框
  closeButton.addEventListener('click', function () {
    settingsModal.style.display = 'none';
  });

  // 点击模态框外部关闭
  window.addEventListener('click', function (e) {
    if (e.target === settingsModal) {
      settingsModal.style.display = 'none';
    }
  });

  // 标签切换
  tabButtons.forEach(button => {
    button.addEventListener('click', function () {
      const tabName = this.getAttribute('data-tab');

      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      this.classList.add('active');
      document.getElementById(`${tabName}-settings`).classList.add('active');
    });
  });

  // 背景颜色选择
  bgOptions.forEach(option => {
    option.addEventListener('click', function () {
      const bgClass = this.getAttribute('data-bg');
      console.log('[Background] Color option clicked:', {
        bgClass,
        previousBackground: document.documentElement.className,
        previousWallpaper: localStorage.getItem('originalWallpaper')
      });

      // 移除所有背景选项的 active 状态
      bgOptions.forEach(opt => {
        opt.classList.remove('active');
        console.log('[Background] Removing active state from:', opt.getAttribute('data-bg'));
      });
      
      // 添加当前选项的 active 状态
      this.classList.add('active');
      console.log('[Background] Setting active state for:', bgClass);
      
      document.documentElement.className = bgClass;
      localStorage.setItem('selectedBackground', bgClass);
      localStorage.setItem('useDefaultBackground', 'true');
      
      // 清除壁纸相关的状态
      document.querySelectorAll('.wallpaper-option').forEach(opt => {
        opt.classList.remove('active');
      });

      // 清除壁纸
      const mainElement = document.querySelector('main');
      if (mainElement) {
        mainElement.style.backgroundImage = 'none';
        document.body.style.backgroundImage = 'none';
        console.log('[Background] Cleared wallpaper');
      }
      localStorage.removeItem('originalWallpaper');

      // 使用 WelcomeManager 更新欢迎消息颜色
      const welcomeElement = document.getElementById('welcome-message');
      if (welcomeElement && window.WelcomeManager) {
        window.WelcomeManager.adjustTextColor(welcomeElement);
      }
    });
  });

  const enableFloatingBallCheckbox = document.getElementById('enable-floating-ball');

  // 加载设置
  chrome.storage.sync.get(['enableFloatingBall'], function (result) {
    enableFloatingBallCheckbox.checked = result.enableFloatingBall !== false;
  });

  // 保存设置
  enableFloatingBallCheckbox.addEventListener('change', function() {
    const isEnabled = this.checked;
    chrome.runtime.sendMessage({action: 'updateFloatingBallSetting', enabled: isEnabled}, function(response) {
      if (response && response.success) {
        console.log('Floating ball setting updated successfully');
      } else {
        console.error('Failed to update floating ball setting');
      }
    });
  });
});

  // 获取 Quick Links 开关元素
  const enableQuickLinksCheckbox = document.getElementById('enable-quick-links');

  // 加载设置
  chrome.storage.sync.get(['enableQuickLinks'], function (result) {
    // 默认为开启状态
    enableQuickLinksCheckbox.checked = result.enableQuickLinks !== false;
    
    // 根据设置显示或隐藏 Quick Links
    toggleQuickLinksVisibility(enableQuickLinksCheckbox.checked);
  });

  // 保存设置
  enableQuickLinksCheckbox.addEventListener('change', function() {
    const isEnabled = this.checked;
    
    // 保存设置到 Chrome 存储
    chrome.storage.sync.set({ enableQuickLinks: isEnabled }, function() {
      console.log('Quick Links setting saved:', isEnabled);
    });

    // 显示或隐藏 Quick Links
    toggleQuickLinksVisibility(isEnabled);
  });

  // 控制 Quick Links 显示/隐藏的函数
  function toggleQuickLinksVisibility(show) {
    const quickLinksWrapper = document.querySelector('.quick-links-wrapper');
    if (quickLinksWrapper) {
      quickLinksWrapper.style.display = show ? 'flex' : 'none';
    }
  }




// 保留原有的DOMContentLoaded事件监听器，但移除其中的背景应用逻辑
document.addEventListener('DOMContentLoaded', function () {

  // 在页面加载完成后立即检查 folder-name 元素
  const folderNameElement = document.getElementById('folder-name');

  // 设置一个 MutationObserver 来监视 folder-name 元素的变化
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
    });
  });

  observer.observe(folderNameElement, { childList: true, subtree: true });

  function expandBookmarkTree(category) {
    let parent = category.parentElement;
    while (parent && parent.id !== 'categories-list') {
      if (parent.classList.contains('folder-item')) {
        const sublist = parent.nextElementSibling;
        if (sublist && sublist.tagName === 'UL') {
          sublist.style.display = 'block';
          const arrowIcon = parent.querySelector('.material-icons.ml-auto');
          if (arrowIcon) {
            arrowIcon.textContent = 'expand_less';
          }
        }
      }
      parent = parent.parentElement;
    }
  }

  function waitForFirstCategoryEdge(attemptsLeft) {
    waitForFirstCategory(attemptsLeft);
  }

  function findBookmarksByParentId(nodes, parentId) {
    if (!nodes) return [];
    let bookmarks = [];
    nodes.forEach(node => {
      if (node.parentId === parentId) {
        bookmarks.push(node);
      }
      if (node.children && node.children.length > 0) {
        bookmarks = bookmarks.concat(findBookmarksByParentId(node.children, parentId));
      }
    });
    return bookmarks;
  }


  function isEdgeBrowser() {
    return /Edg/.test(navigator.userAgent);
  }

  if (isEdgeBrowser()) {
    waitForFirstCategoryEdge(10);
  } else {
    waitForFirstCategory(10);
  }

  const toggleSidebarButton = document.getElementById('toggle-sidebar');
  const sidebarContainer = document.getElementById('sidebar-container');

  // 读保存的侧边栏状态
  const isSidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';

  // 初状
  function setSidebarState(isCollapsed) {
    if (isCollapsed) {
      sidebarContainer.classList.add('collapsed');
      toggleSidebarButton.textContent = '>';
      toggleSidebarButton.style.left = '2rem'; // 收起时的位置
    } else {
      sidebarContainer.classList.remove('collapsed');
      toggleSidebarButton.textContent = '<';
      toggleSidebarButton.style.left = '14.75rem'; // 展开时的位置
    }
  }

  // 应用初始状态
  setSidebarState(isSidebarCollapsed);

  // 切换侧边状态的函数
  function toggleSidebar() {
    const isCollapsed = sidebarContainer.classList.toggle('collapsed');
    setSidebarState(isCollapsed);
    localStorage.setItem('sidebarCollapsed', isCollapsed);
  }

  // 添加点击事件监听器
  toggleSidebarButton.addEventListener('click', toggleSidebar);

  document.addEventListener('click', function (event) {
    if (event.target.closest('#categories-list li')) {
      updateBookmarkCards();
    }
  });

  updateBookmarkCards();

  function createContextMenu() {
    const menu = document.createElement('div');
    menu.className = 'custom-context-menu';
    document.body.appendChild(menu);

    const menuItems = [
      { text: getLocalizedMessage('openInNewTab'), icon: 'open_in_new', action: () => currentBookmark && window.open(currentBookmark.url, '_blank') },
      { text: getLocalizedMessage('openInNewWindow'), icon: 'launch', action: () => currentBookmark && openInNewWindow(currentBookmark.url) },
      { text: getLocalizedMessage('openInIncognito'), icon: 'visibility_off', action: () => currentBookmark && openInIncognito(currentBookmark.url) },
      { text: getLocalizedMessage('editQuickLink'), icon: 'edit', action: () => currentBookmark && openEditDialog(currentBookmark) },
      { 
        text: getLocalizedMessage('deleteQuickLink'), 
        icon: 'delete', 
        action: () => {
          console.log('Delete action triggered. Current item:', currentBookmark);
          
          if (!currentBookmark) {
            console.error('No item selected for deletion');
            return;
          }

          // 使用全局的 itemToDelete 变量，而不是创建局部变量
          itemToDelete = {
            type: currentBookmark.type || 'bookmark',  // 使用项目自带的类型或默认为 bookmark
            data: {
              id: currentBookmark.id,
              title: currentBookmark.title,
              url: currentBookmark.url
            }
          };
          
          console.log('Set itemToDelete:', itemToDelete);
          
          // 根据类型显示不同的确认消息
          const message = itemToDelete.type === 'quickLink' 
            ? chrome.i18n.getMessage("confirmDeleteQuickLink", [`<strong>${itemToDelete.data.title}</strong>`])
            : chrome.i18n.getMessage("confirmDeleteBookmark", [`<strong>${itemToDelete.data.title}</strong>`]);
          
          showConfirmDialog(message, () => {
            if (itemToDelete && itemToDelete.data) {
              if (itemToDelete.type === 'quickLink') {
                deleteQuickLink(itemToDelete.data);
              } else {
                deleteBookmark(itemToDelete.data.id, itemToDelete.data.title);
              }
            }
          });
        }
      },
      { text: getLocalizedMessage('copyLink'), icon: 'content_copy', action: () => currentBookmark && Utilities.copyBookmarkLink(currentBookmark) },
      { text: getLocalizedMessage('createQRCode'), icon: 'qr_code', action: () => currentBookmark && createQRCode(currentBookmark.url, currentBookmark.title) }
    ];

    menuItems.forEach((item, index) => {
      const menuItem = document.createElement('div');
      menuItem.className = 'custom-context-menu-item';
      
      const icon = document.createElement('span');
      icon.className = 'material-icons';
      icon.innerHTML = ICONS[item.icon];
      icon.style.marginRight = '8px';
      icon.style.fontSize = '18px';
      
      const text = document.createElement('span');
      text.textContent = item.text;

      menuItem.appendChild(icon);
      menuItem.appendChild(text);

      menuItem.addEventListener('click', function() {
        // 这里添加每个菜单项点击件理
        item.action();
        menu.style.display = 'none';
      });

      if (index === 3 || index === 5) {
        const divider = document.createElement('div');
        divider.className = 'custom-context-menu-divider';
        menu.appendChild(divider);
      }

      menu.appendChild(menuItem);
    });

    return menu;
  }

  // 创建二维码的函数
  function createQRCode(url, bookmarkName) {
    // 创建一个模态来显维码
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.left = '0';
    modal.style.top = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.zIndex = '1000';

    const qrContainer = document.createElement('div');
    qrContainer.style.backgroundColor = 'white';
    qrContainer.style.padding = '1.5rem 3rem';
    qrContainer.style.width = '320px';
    qrContainer.style.borderRadius = '10px';
    qrContainer.style.display = 'flex';
    qrContainer.style.flexDirection = 'column';
    qrContainer.style.alignItems = 'center';
    qrContainer.style.position = 'relative';

    // 添加关闭钮
    const closeButton = document.createElement('span');
    closeButton.textContent = '×';
    closeButton.style.position = 'absolute';
    closeButton.style.right = '10px';
    closeButton.style.top = '10px';
    closeButton.style.fontSize = '20px';
    closeButton.style.cursor = 'pointer';
    closeButton.onclick = () => document.body.removeChild(modal);
    qrContainer.appendChild(closeButton);

    // 加标
    const title = document.createElement('h2');
    title.textContent = getLocalizedMessage('scanQRCode');
    title.style.marginBottom = '20px';
    title.style.fontWeight = '600';
    title.style.fontSize = '0.875rem';
    qrContainer.appendChild(title);

    // 创建 QR 码容
    const qrCodeElement = document.createElement('div');
    qrContainer.appendChild(qrCodeElement);

    // 添 URL 显示
    const urlDisplay = document.createElement('div');
    urlDisplay.textContent = url;
    urlDisplay.style.marginTop = '20px';
    urlDisplay.style.wordBreak = 'break-all';
    urlDisplay.style.maxWidth = '300px';
    urlDisplay.style.textAlign = 'center';
    qrContainer.appendChild(urlDisplay);

    // 添按容器
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'space-between';
    buttonContainer.style.width = '100%';
    buttonContainer.style.marginTop = '20px';

    // 添加复制按钮
    const copyButton = document.createElement('button');
    copyButton.textContent = getLocalizedMessage('copyLink');
    copyButton.onclick = () => {
      navigator.clipboard.writeText(url).then(() => {
        copyButton.textContent = getLocalizedMessage('copied');
        setTimeout(() => copyButton.textContent = getLocalizedMessage('copyLink'), 2000);
      });
    };

    // 添加下载按钮
    const downloadButton = document.createElement('button');
    downloadButton.textContent = getLocalizedMessage('download');
    downloadButton.onclick = () => {
      // 给 QRCode 生成一些时间
      setTimeout(() => {
        const canvas = qrCodeElement.querySelector('canvas');
        if (canvas) {
          const link = document.createElement('a');
          // 使用书签名称作为文件名，并添加 .png 扩展名
          const fileName = `${bookmarkName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_qrcode.png`;
          link.download = fileName;
          link.href = canvas.toDataURL('image/png');
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }, 100); // 给予 100ms 的延迟，确保 QR 码已经生成
    };

    // 设置按钮样式和hover效果
    [copyButton, downloadButton].forEach(button => {
      button.style.padding = '5px 10px';
      button.style.border = 'none';
      button.style.borderRadius = '5px';
      button.style.cursor = 'pointer';
      button.style.backgroundColor = '#f0f0f0';
      button.style.color = '#333';
      button.style.transition = 'all 0.3s ease';

      // 添加hover效果
      button.addEventListener('mouseenter', () => {
        button.style.backgroundColor = '#e0e0e0';
        button.style.color = '#111827';
      });
      button.addEventListener('mouseleave', () => {
        button.style.backgroundColor = '#f0f0f0';
        button.style.color = '#717882';
      });
    });

    buttonContainer.appendChild(copyButton);
    buttonContainer.appendChild(downloadButton);
    qrContainer.appendChild(buttonContainer);

    modal.appendChild(qrContainer);
    document.body.appendChild(modal);

    // 使用 qrcode.js 库生成二维码
    new QRCode(qrCodeElement, {
      text: url,
      width: 200,
      height: 200
    });

    // 点击模态框外部关闭
    modal.addEventListener('click', function (event) {
      if (event.target === modal) {
        document.body.removeChild(modal);
      }
    });
  }

  const contextMenu = createContextMenu();

  document.addEventListener('contextmenu', function (event) {
    const targetCard = event.target.closest('.bookmark-card');
    if (targetCard) {
      event.preventDefault();
      // 确保在显示菜单前重置当前书签信息
      currentBookmark = {
        id: targetCard.dataset.id,
        url: targetCard.href,
        title: targetCard.querySelector('.card-title').textContent
      };
      contextMenu.style.top = `${event.clientY}px`;
      contextMenu.style.left = `${event.clientX}px`;
      contextMenu.style.display = 'block';
    } else {
      contextMenu.style.display = 'none';
    }
  });

  document.addEventListener('click', function () {
    if (contextMenu) {
      contextMenu.style.display = 'none';
      currentBookmark = null;  // Reset currentBookmark
    }
  });

  const editDialog = document.getElementById('edit-dialog');
  const editForm = document.getElementById('edit-form');
  const editNameInput = document.getElementById('edit-name');
  const editUrlInput = document.getElementById('edit-url');
  const closeButton = document.querySelector('.close-button');
  const cancelButton = document.querySelector('.cancel-button');

  function openEditDialog(bookmark) {
    const bookmarkId = bookmark.id;
    const bookmarkTitle = bookmark.title;
    const bookmarkUrl = bookmark.url;

    document.getElementById('edit-name').value = bookmarkTitle;
    document.getElementById('edit-url').value = bookmarkUrl;

    const editDialog = document.getElementById('edit-dialog');
    editDialog.style.display = 'block';

    // 设置提交事件
    document.getElementById('edit-form').onsubmit = function (event) {
      event.preventDefault();
      const newTitle = document.getElementById('edit-name').value;
      const newUrl = document.getElementById('edit-url').value;
      chrome.bookmarks.update(bookmarkId, { title: newTitle, url: newUrl }, function () {
        editDialog.style.display = 'none';

        // 更新特定的书签卡片
        updateSpecificBookmarkCard(bookmarkId, newTitle, newUrl);
      });
    };

    // 添加取消按钮的事件监听
    document.querySelector('.cancel-button').addEventListener('click', function () {
      editDialog.style.display = 'none';
    });

    // 添加关闭按钮的事件监听
    document.querySelector('.close-button').addEventListener('click', function () {
      editDialog.style.display = 'none';
    });
  }

  function updateSpecificBookmarkCard(bookmarkId, newTitle, newUrl) {
    const bookmarkCard = document.querySelector(`.bookmark-card[data-id="${bookmarkId}"]`);
    if (bookmarkCard) {
      bookmarkCard.href = newUrl;
      bookmarkCard.querySelector('.card-title').textContent = newTitle;

      // 更新 favicon 和颜色
      const img = bookmarkCard.querySelector('img');
      updateBookmarkCardColors(bookmarkCard, newUrl, img);
    }
  }

  function updateBookmarkCardColors(bookmarkCard, newUrl, img) {
    // 清旧的缓存
    localStorage.removeItem(`bookmark-colors-${bookmarkCard.dataset.id}`);
    
    // 更新 favicon URL
    img.src = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(newUrl)}&size=32&t=${Date.now()}`;
    
    img.onload = function () {
      const colors = getColors(img);
      applyColors(bookmarkCard, colors);
      localStorage.setItem(`bookmark-colors-${bookmarkCard.dataset.id}`, JSON.stringify(colors));
    };
    
    img.onerror = function () {
      const defaultColors = { primary: [200, 200, 200], secondary: [220, 220, 220] };
      applyColors(bookmarkCard, defaultColors);
      localStorage.setItem(`bookmark-colors-${bookmarkCard.dataset.id}`, JSON.stringify(defaultColors));
    };
  }

  closeButton.onclick = function () {
    editDialog.style.display = 'none';
  };

  cancelButton.onclick = function () {
    editDialog.style.display = 'none';
  };

  window.onclick = function (event) {
    if (event.target == editDialog) {
      editDialog.style.display = 'none';
    }
  };

  function findBookmarkNodeByTitle(nodes, title) {
    for (let node of nodes) {
      if (node.title === title) {
        return node;
      } else if (node.children) {
        const result = findBookmarkNodeByTitle(node.children, title);
        if (result) {
          return result;
        }
      }
    }
    return null;
  }



  // 调用 updateBookmarkCards
  updateBookmarkCards();

  function expandToBookmark(bookmarkId) {
    setTimeout(() => {
      const bookmarkElement = document.querySelector(`#categories-list li[data-id="${bookmarkId}"]`);
      if (bookmarkElement) {
        let parent = bookmarkElement.parentElement;
        while (parent && parent.id !== 'categories-list') {
          if (parent.classList.contains('folder-item')) {
            parent.classList.add('expanded');
            const sublist = parent.querySelector('ul');
            if (sublist) sublist.style.display = 'block';
          }
          parent = parent.parentElement;
        }
        bookmarkElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        bookmarkElement.style.animation = 'highlight 1s';
      }
    }, 100); // 给予一些 DOM 更新
  }

  function getFavicon(url, callback) {
    const domain = new URL(url).hostname;

    chrome.bookmarks.search({ url: url }, function (results) {
      if (results && results.length > 0) {
        const faviconURL = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`;
        const img = new Image();
        img.onload = function () {
          callback(faviconURL);
        };
        img.onerror = function () {
          fetchFaviconOnline(domain, callback);
        };
        img.src = faviconURL;
      } else {
        fetchFaviconOnline(domain, callback);
      }
    });
  }

  function fetchFaviconOnline(domain, callback) {
    const faviconUrls = [
      `https://www.google.com/s2/favicons?domain=${domain}`,
    ];

    let faviconUrl = faviconUrls[0];
    const img = new Image();
    img.onload = function () {
      cacheFavicon(domain, faviconUrl);
      callback(faviconUrl);
    };
    img.onerror = function () {
      faviconUrls.shift();
      if (faviconUrls.length > 0) {
        faviconUrl = faviconUrls[0];
        img.src = faviconUrl;
      } else {
        callback('');
      }
    };
    img.src = faviconUrl;
  }

  function cacheFavicon(domain, faviconUrl) {
    const data = {};
    data[domain] = faviconUrl;
    chrome.storage.local.set(data);
  }

  let currentCategory = null;
  // 递归获取所有书签数量的函数
  const getAllBookmarksCount = async (folderId, maxDepth = 5) => {
    let count = 0;
    let depth = 0;

    async function countBookmarks(id, currentDepth) {
      if (currentDepth > maxDepth) return 0;

      return new Promise((resolve) => {
        chrome.bookmarks.getChildren(id, async (items) => {
          let localCount = 0;

          for (const item of items) {
            if (item.url && item.url.startsWith('http')) {
              localCount++;
            } else if (currentDepth < maxDepth) {
              localCount += await countBookmarks(item.id, currentDepth + 1);
            }
          }

          resolve(localCount);
        });
      });
    }

    count = await countBookmarks(folderId, depth);
    return count;
  };
  // 1. 批量创建标签页的函数
  function createTabsInBatches(urls, groupName, batchSize = 5, delay = 100) {
    return new Promise((resolve) => {
      const tabIds = [];
      let currentBatch = 0;

      function createBatch() {
        const batch = urls.slice(currentBatch, currentBatch + batchSize);
        if (batch.length === 0) {
          // 所有标签页创建完成后，创建标签组
          if (tabIds.length > 1) {
            chrome.tabs.group({ tabIds }, (groupId) => {
              chrome.tabGroups.update(groupId, {
                title: groupName,
                color: 'cyan'
              });
              resolve({ success: true });
            });
          } else {
            resolve({ success: true });
          }
          return;
        }

        // 创建这一批的标签页
        Promise.all(batch.map(url =>
          new Promise((resolve) => {
            chrome.tabs.create({ url, active: false }, (tab) => {
              if (tab) tabIds.push(tab.id);
              resolve();
            });
          })
        )).then(() => {
          currentBatch += batchSize;
          // 添加延迟以避免过快创建标签页
          setTimeout(createBatch, delay);
        });
      }

      createBatch();
    });
  }
  function createCategoryContextMenu() {
    const menu = document.createElement('div');
    menu.className = 'custom-context-menu';
    document.body.appendChild(menu);

    // 创建基本菜单项
    const createMenuItems = (bookmarkCount) => {
      const menuItems = [
        {
          text: `${getLocalizedMessage('openAllBookmarks')} (${bookmarkCount})`,
          icon: 'open_in_new',
          action: () => {
            if (currentCategory) {
              const folderId = currentCategory.dataset.id;
              const folderTitle = currentCategory.dataset.title;

              // 递归获取所有书签 URL 的函数
              const getAllBookmarkUrls = async (folderId) => {
                return new Promise((resolve) => {
                  chrome.bookmarks.getChildren(folderId, async (items) => {
                    let urls = [];
                    for (const item of items) {
                      if (item.url) {
                        urls.push(item.url);
                      } else {
                        // 递归获取子文件夹的 URLs
                        const subUrls = await getAllBookmarkUrls(item.id);
                        urls = urls.concat(subUrls);
                      }
                    }
                    resolve(urls);
                  });
                });
              };

              // 获取并打开所有书签
              getAllBookmarkUrls(folderId).then(validUrls => {
                if (validUrls.length > 0) {
                  // 使用 background.js 中的优化函数
                  chrome.runtime.sendMessage({
                    action: 'openMultipleTabsAndGroup',
                    urls: validUrls,
                    groupName: folderTitle
                  }, (response) => {
                    if (response.success) {
                      console.log('Bookmarks opened in new tab group');
                    } else {
                      console.error('Error opening bookmarks:', response.error);
                    }
                  });
                }
              });
            }
          }
        },
        // 原有的菜单项保持不变
        { text: getLocalizedMessage('rename'), icon: 'edit' },
        { text: getLocalizedMessage('delete'), icon: 'delete' },
        { text: getLocalizedMessage('setAsHomepage'), icon: 'home' }
      ];

      // 清空现有菜单项
      menu.innerHTML = '';

      // 创建菜单项的其余代码保持不变...
      menuItems.forEach(item => {
        const menuItem = document.createElement('div');
        menuItem.className = 'custom-context-menu-item';

        const icon = document.createElement('span');
        icon.className = 'material-icons';
        icon.innerHTML = ICONS[item.icon];
        icon.style.marginRight = '8px';
        icon.style.fontSize = '18px';

        const text = document.createElement('span');
        text.textContent = item.text;

        menuItem.appendChild(icon);
        menuItem.appendChild(text);

        menuItem.addEventListener('click', function () {
          if (item.action) {
            item.action();
          } else {
            // 原有的 switch 逻辑...
            switch (item.text) {
              case getLocalizedMessage('rename'):
                openEditCategoryDialog(currentCategory);
                break;
              case getLocalizedMessage('delete'):
                const categoryId = currentCategory.dataset.id;
                const categoryTitle = currentCategory.dataset.title;
                showConfirmDialog(chrome.i18n.getMessage("confirmDeleteFolder", [`<strong>${categoryTitle}</strong>`]), () => {
                  chrome.bookmarks.removeTree(categoryId, function () {
                    currentCategory.remove();
                    Utilities.showToast(getLocalizedMessage('categoryDeleted'));
                  });
                });
                break;
              case getLocalizedMessage('setAsHomepage'):
                const homeFolderId = currentCategory.dataset.id;
                setDefaultBookmark(homeFolderId);
                break;
            }
          }
          menu.style.display = 'none';
        });

        menu.appendChild(menuItem);
      });
    };

    return {
      menu: menu,
      updateMenuItems: createMenuItems
    };
  }

  const categoryContextMenu = createCategoryContextMenu();

  document.addEventListener('contextmenu', function (event) {
    const targetCategory = event.target.closest('#categories-list li');
    if (targetCategory) {
      event.preventDefault();
      currentCategory = targetCategory;

      if (currentCategory) {
        const folderId = currentCategory.dataset.id;
        // 使用新的递归函数获取总书签数量
        getAllBookmarksCount(folderId).then(totalCount => {
          categoryContextMenu.updateMenuItems(totalCount);

          categoryContextMenu.menu.style.top = `${event.clientY}px`;
          categoryContextMenu.menu.style.left = `${event.clientX}px`;
          categoryContextMenu.menu.style.display = 'block';
        });
      }
    } else {
      categoryContextMenu.menu.style.display = 'none';
    }
  });

  document.addEventListener('click', function () {
    categoryContextMenu.menu.style.display = 'none';
  });

  const editCategoryDialog = document.getElementById('edit-category-dialog');
  const editCategoryForm = document.getElementById('edit-category-form');
  const editCategoryNameInput = document.getElementById('edit-category-name');
  const closeCategoryButton = document.querySelector('.close-category-button');
  const cancelCategoryButton = document.querySelector('.cancel-category-button');

  function openEditCategoryDialog(categoryElement) {
    const categoryId = categoryElement.dataset.id;
    const categoryTitle = categoryElement.dataset.title;

    editCategoryNameInput.value = categoryTitle;

    editCategoryDialog.style.display = 'block';

    editCategoryForm.onsubmit = function (event) {
      event.preventDefault();
      const updatedTitle = editCategoryNameInput.value;

      chrome.bookmarks.update(categoryId, {
        title: updatedTitle
      }, function (result) {
        updateCategoryUI(categoryElement, updatedTitle);
        editCategoryDialog.style.display = 'none';
      });
    };
  }

  function updateCategoryUI(categoryElement, newTitle) {
    // 更新侧边栏中的文件夹名称
    const sidebarItem = document.querySelector(`#categories-list li[data-id="${categoryElement.dataset.id}"]`);
    if (sidebarItem) {
      // 更新文本内容
      const textSpan = sidebarItem.querySelector('span:not(.material-icons)');
      if (textSpan) {
        textSpan.textContent = newTitle;
      }

      // 更新 data-title 属性
      sidebarItem.setAttribute('data-title', newTitle);

      // 更新样式
      sidebarItem.classList.add('updated-folder');
      setTimeout(() => {
        sidebarItem.classList.remove('updated-folder');
      }, 2000); // 2秒后移除高亮效果
    }

    // 更新面包屑导航
    updateFolderName(categoryElement.dataset.id);

    // 更新文件夹卡片（如果在当前视图中）
    const folderCard = document.querySelector(`.bookmark-folder[data-id="${categoryElement.dataset.id}"]`);
    if (folderCard) {
      const titleElement = folderCard.querySelector('.card-title');
      if (titleElement) {
        titleElement.textContent = newTitle;
      }
    }
  }

  closeCategoryButton.onclick = function () {
    editCategoryDialog.style.display = 'none';
  };

  cancelCategoryButton.onclick = function () {
    editCategoryDialog.style.display = 'none';
  };

  window.onclick = function (event) {
    if (event.target == editCategoryDialog) {
      editCategoryDialog.style.display = 'none';
    }
  };

  function setDefaultBookmark(bookmarkId) {
    localStorage.setItem('defaultBookmarkId', bookmarkId);
    updateDefaultBookmarkIndicator();

    // 刷新 bookmarks-container
    updateBookmarksDisplay(bookmarkId);

      // 更新侧边栏中的默认签指示器和选中状态
      updateSidebarDefaultBookmarkIndicator();

    // 通知背景脚本更新默认书签ID
    chrome.runtime.sendMessage({ action: 'setDefaultBookmarkId', defaultBookmarkId: bookmarkId }, function (response) {
      if (response && response.success) {
      }
    });
  }

  function updateDefaultBookmarkIndicator() {
    const defaultBookmarkId = localStorage.getItem('defaultBookmarkId');
    const allBookmarks = document.querySelectorAll('.bookmark-card, .bookmark-folder');
    allBookmarks.forEach(bookmark => {
      const indicator = bookmark.querySelector('.default-indicator');
      if (indicator) {
        indicator.remove();
      }
      if (bookmark.dataset.id === defaultBookmarkId) {
        const defaultIndicator = document.createElement('span');
        defaultIndicator.className = 'default-indicator material-icons';
        defaultIndicator.textContent = 'star';
        defaultIndicator.title = getLocalizedMessage('homepage');
        bookmark.appendChild(defaultIndicator);
      }
    });
  }

  function updateSidebarDefaultBookmarkIndicator() {
    const defaultBookmarkId = localStorage.getItem('defaultBookmarkId');
    selectSidebarFolder(defaultBookmarkId);
    
    const allCategories = document.querySelectorAll('#categories-list li');
    allCategories.forEach(category => {
      const indicator = category.querySelector('.default-indicator');
      if (indicator) {
        indicator.remove();
      }
      if (category.dataset.id === defaultBookmarkId) {
        const defaultIndicator = document.createElement('span');
        defaultIndicator.className = 'default-indicator material-icons';
        defaultIndicator.textContent = 'star';
        defaultIndicator.title = getLocalizedMessage('homepage');
        category.appendChild(defaultIndicator);
      }
    });
  }

  function updateBookmarksDisplay(parentId, movedItemId, newIndex) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.getChildren(parentId, (bookmarks) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        const bookmarksList = document.getElementById('bookmarks-list');
        const bookmarksContainer = document.querySelector('.bookmarks-container');

        // 先隐藏容器
        bookmarksContainer.style.opacity = '0';
        bookmarksContainer.style.transform = 'translateY(20px)';

        // 清空现有书签和占位符
        bookmarksList.innerHTML = '';

        // 更新本地缓存
        bookmarkOrderCache[parentId] = bookmarks.map(b => b.id);

        // 添加新的书签
        bookmarks.forEach((bookmark, index) => {
          const bookmarkElement = bookmark.url ? createBookmarkCard(bookmark, index) : createFolderCard(bookmark, index);
          bookmarksList.appendChild(bookmarkElement);
        });

        bookmarksList.dataset.parentId = parentId;

        if (movedItemId) {
          highlightBookmark(movedItemId);
        }

        // 更新文件夹名称
        updateFolderName(parentId);

        // 使用 requestAnimationFrame 来确保 DOM 更新后再显示容器
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            bookmarksContainer.style.opacity = '1';
            bookmarksContainer.style.transform = 'translateY(0)';
          });
        });

        resolve();
      });
    });
  }

  const tabsContainer = document.getElementById('tabs-container');
  const tabs = document.querySelectorAll('.tab');
  const defaultSearchEngine = localStorage.getItem('selectedSearchEngine') || 'Google';

  // 在文件的适当位置（可能在 DOMContentLoaded 事件监听器内）添加这个标志
  let isChangingSearchEngine = false;

  // 将 getSearchUrl 函数移到文件前面，在事件监听器之前定义
  function getSearchUrl(engine, query) {
      const encodedQuery = encodeURIComponent(query);
      const searchUrls = {
          google: `https://www.google.com/search?q=${encodedQuery}`,
          bing: `https://www.bing.com/search?q=${encodedQuery}`,
          baidu: `https://www.baidu.com/s?wd=${encodedQuery}`,
          doubao: `https://www.doubao.com/search?q=${encodedQuery}`,
          kimi: `https://kimi.moonshot.cn/?q=${encodedQuery}`,
          metaso: `https://metaso.cn/#/search?q=${encodedQuery}`,
          felo: `https://felo.me/?q=${encodedQuery}`,
          chatgpt: `https://chat.openai.com/?q=${encodedQuery}`
      };
      
      return searchUrls[engine.toLowerCase()] || searchUrls.google;
  }



  tabs.forEach(tab => {
    tab.setAttribute('tabindex', '0');

    tab.addEventListener('click', function () {
        const selectedEngine = this.getAttribute('data-engine');
        const searchInput = document.querySelector('.search-input');
        const searchQuery = searchInput.value.trim();
        
        // 移除临时切换图标的代码
        // 只保留标签激活状态的切换
        tabs.forEach(t => t.classList.remove('active'));
        this.classList.add('active');

        // 如果搜索框有内容，立即执行搜索
        if (searchQuery) {
            const searchUrl = getSearchUrl(selectedEngine, searchQuery);
            window.open(searchUrl, '_blank');
            hideSuggestions();
        }
    });
  });

  new Sortable(tabsContainer, {
    animation: 150,
    onEnd: function (evt) {
      const orderedEngines = Array.from(tabsContainer.children).map(tab => tab.getAttribute('data-engine'));
      localStorage.setItem('orderedSearchEngines', JSON.stringify(orderedEngines));
    }
  });

  const savedOrder = JSON.parse(localStorage.getItem('orderedSearchEngines'));
  if (savedOrder) {
    savedOrder.forEach(engineName => {
      const tab = Array.from(tabs).find(tab => tab.getAttribute('data-engine') === engineName);
      if (tab) {
        tabsContainer.appendChild(tab);
      }
    });
  }

  const searchForm = document.getElementById('search-form');
  const searchInput = document.querySelector('.search-input');
  const searchEngineIcon = document.getElementById('search-engine-icon');

  searchInput.addEventListener('focus', function () {
    searchForm.classList.add('focused');
    if (searchInput.value.trim() === '') {
      showDefaultSuggestions();
    } else {
      const suggestions = getSuggestions(searchInput.value.trim());
      showSuggestions(suggestions);
    }
  });

  searchInput.addEventListener('blur', () => {
    const searchForm = document.querySelector('.search-form');
    searchForm.classList.remove('focused');
    // 使用 setTimeout 来延迟隐藏建议列表，允许点击建议
    setTimeout(() => {
      if (!searchForm.contains(document.activeElement)) {
        hideSuggestions();
      }
    }, 200);
  });

  if (!searchForm || !searchInput || !tabsContainer || !searchEngineIcon) {
    return;
  }

  updateSubmitButtonState();



  function updateSubmitButtonState() {
    if (searchInput.value.trim() === '') {
      tabsContainer.style.display = 'none';
    } else {
      // 只有当搜索建议列表不为空时才显示 tabs-container
      if (searchSuggestions.children.length > 0) {
        tabsContainer.style.display = 'flex';
      } else {
        tabsContainer.style.display = 'none';
      }
    }
  }

  let isSearching = false;
  let searchQueue = [];

  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  const debouncedPerformSearch = debounce(performSearch, 300);

  // Modify the search form submit event listener
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault(); // Prevent default form submission
    performSearch(searchInput.value.trim());
  });

  function queueSearch() {
    const query = searchInput.value.trim();
    if (query === '') {
      return;
    }
    searchQueue.push(query);
    processSearchQueue();
  }

  function processSearchQueue() {
    if (isSearching || searchQueue.length === 0) {
      return;
    }
    
    const query = searchQueue.shift();
    debouncedPerformSearch(query);
  }
  // 修改 performSearch 函数
  function performSearch(query) {
    if (!query || typeof query !== 'string' || query.trim() === '') {
      return;
    }

    isSearching = true;

    // 获取当前激活的搜索引擎用于本次搜索
    const activeTab = document.querySelector('.tab.active');
    const currentEngine = activeTab ? activeTab.getAttribute('data-engine') : defaultSearchEngine;
    console.log('[Search] Current engine for search:', currentEngine);

    // 获取真正的默认搜索引擎
    const defaultEngine = localStorage.getItem('selectedSearchEngine') || 'google';
    let url = getSearchUrl(currentEngine, query);

    // 在打开新窗口之前先恢复默认搜索引擎
    requestAnimationFrame(() => {
      // 1. 恢复 tabs-container 中的默认选中状态
      const tabs = document.querySelectorAll('.tab');
      console.log('[Search] Found tabs:', tabs.length);

      // 清除所有临时标记
      tabs.forEach(tab => {
        delete tab.dataset.temporary;
        if (tab.getAttribute('data-engine').toLowerCase() === defaultEngine.toLowerCase()) {
          console.log('[Search] Setting active tab:', defaultEngine);
          tab.classList.add('active');
        } else {
          tab.classList.remove('active');
        }
      });

      // 打开搜索结果
      console.log('[Search] Opening URL:', url);
      window.open(url, '_blank');
      hideSuggestions();
    });

    setTimeout(() => {
      isSearching = false;
      processSearchQueue();
    }, 1000);
  }

  // 新增恢复默认搜索引擎的函数
  function restoreDefaultSearchEngine() {
    const defaultEngine = localStorage.getItem('selectedSearchEngine') || 'google';

    // 更新标签状态
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
      if (tab.getAttribute('data-engine') === defaultEngine) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // 更新搜索引擎图标
    updateSearchEngineIcon(defaultEngine);
  }


  function getSearchUrl(engine, query) {
    switch (engine.toLowerCase()) {
      case 'kimi':
      case 'kimi':
        return `https://kimi.moonshot.cn/?q=${encodeURIComponent(query)}`;
      case 'doubao':
      case '豆包':
        return `https://www.doubao.com/chat/?q=${encodeURIComponent(query)}`;
      case 'chatgpt':
        return `https://chatgpt.com/?q=${encodeURIComponent(query)}`;
      case 'felo':
        return `https://felo.ai/search?q=${query}`;
      case 'metaso':
      case '秘塔':
        return `https://metaso.cn/?q=${query}`;
      case 'google':
      case '谷歌':
        return `https://www.google.com/search?q=${query}`;
      case 'bing':
      case '必应':
        return `https://www.bing.com/search?q=${query}`;
      case 'baidu':
      case '百度':
        return `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`;
      default:
        return `https://www.bing.com/search?q=${query}`;
    }
  }

  // 动态调整 textarea 度的函数
  function adjustTextareaHeight() {
    searchInput.style.height = 'auto'; // 重置高度
    const maxHeight = 3 * 21; // 假设每行高度为 24px，最多显示 3 行
    searchInput.style.height = Math.min(searchInput.scrollHeight, maxHeight) + 'px';
  }

  // 在输入事件中调用调整高度的函数
  searchInput.addEventListener('input', adjustTextareaHeight);

  // 初始化时调整高度
  adjustTextareaHeight();

  const searchSuggestions = document.getElementById('search-suggestions');

  // 防抖函
  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
  async function getRecentHistory(limit = 100, maxPerDomain = 5) {
    return new Promise((resolve) => {
      chrome.history.search({ text: '', maxResults: limit * 20 }, (historyItems) => {
        const now = Date.now();
        const domainCounts = {};
        const uniqueItems = new Map();

        const recentHistory = historyItems
          // 映射并添加额外信息
          .map(item => {
            const url = new URL(item.url);
            const domain = url.hostname;
            return {
              text: item.title,
              url: item.url,
              domain: domain,
              type: 'history',
              relevance: 1,
              timestamp: item.lastVisitTime
            };
          })
          // 按时间排序（最近的优先）
          .sort((a, b) => b.timestamp - a.timestamp)
          // 去重（基于URL和标题）并限制每个域名的数量
          .filter(item => {
            const key = `${item.url}|${item.text}`;
            if (uniqueItems.has(key)) return false;
            
            domainCounts[item.domain] = (domainCounts[item.domain] || 0) + 1;
            if (domainCounts[item.domain] > maxPerDomain) return false;
            
            uniqueItems.set(key, item);
            return true;
          })
          // 应用时间衰减因子
          .map(item => {
            const daysSinceLastVisit = (now - item.timestamp) / (1000 * 60 * 60 * 24);
            item.relevance *= Math.exp(-daysSinceLastVisit / RELEVANCE_CONFIG.timeDecayHalfLife);
            return item;
          })
          // 再次排序，这次基于相关性（考虑了时间衰减）
          .sort((a, b) => b.relevance - a.relevance)
          // 限制结果数量
          .slice(0, limit);

        resolve(recentHistory);
      });
    });
  }
  // 在文件顶部定义 RELEVANCE_CONFIG
  const RELEVANCE_CONFIG = {
    titleExactMatchWeight: 6,
    urlExactMatchWeight: 1.5,
    titlePartialMatchWeight: 1.2,
    urlPartialMatchWeight: 0.3,
    timeDecayHalfLife: 60,
    fuzzyMatchThreshold: 0.6,
    fuzzyMatchWeight: 1.5,
    bookmarkRelevanceBoost: 1.2
  };
  function searchHistory(query, maxResults = 200) {
    return new Promise((resolve) => {
      const startTime = new Date().getTime() - (30 * 24 * 60 * 60 * 1000); // 搜索最近30天的历史
      chrome.history.search(
        { 
          text: query, 
          startTime: startTime,
          maxResults: maxResults 
        }, 
        (results) => {
          
          // 对历史记录进行去重
          const uniqueResults = Array.from(new Set(results.map(r => r.url)))
            .map(url => results.find(r => r.url === url));
          resolve(uniqueResults);
        }
      );
    });
  }
  // 获取搜索建议
  async function getSuggestions(query) {
    const maxHistoryResults = 200;
    const maxBookmarkResults = 50;
    const maxTotalSuggestions = 50;

    const suggestions = [{ text: query, type: 'search', relevance: Infinity }];

    // 从历史记录获取建议
    const historyItems = await searchHistory(query, maxHistoryResults);
    const historySuggestions = historyItems.map(item => ({
      text: item.title,
      url: item.url,
      type: 'history',
      relevance: calculateRelevance(query, item.title, item.url),
      timestamp: item.lastVisitTime
    }));

    // 从书签获取建议
    const bookmarkItems = await new Promise(resolve => {
      chrome.bookmarks.search(query, resolve);
    });
    const bookmarkSuggestions = bookmarkItems.slice(0, maxBookmarkResults).map(item => ({
      text: item.title,
      url: item.url,
      type: 'bookmark',
      relevance: calculateRelevance(query, item.title, item.url) * RELEVANCE_CONFIG.bookmarkRelevanceBoost
    }));

    // 获取 Bing 建议
    const bingSuggestions = await getBingSuggestions(query);

    // 合并所有建议
    suggestions.push(
      ...historySuggestions,
      ...bookmarkSuggestions,
      ...bingSuggestions
    );
    // 对结果进行排序和去重
    const uniqueSuggestions = Array.from(new Set(suggestions.map(s => s.url)))
      .map(url => suggestions.find(s => s.url === url))
      .sort((a, b) => b.relevance - a.relevance);
    // 平衡和交替显示结果
    const balancedResults = await balanceResults(uniqueSuggestions, maxTotalSuggestions);
    balancedResults.slice(0, 5).forEach((suggestion, index) => {
    });

    return balancedResults;
  }

  function calculateRelevance(query, title, url) {
    // 基础设置
    const weights = {
      // 1. 提高完全匹配的权重，让精确结果更容易被找到
      exactTitleMatch: 200,    // 提高标题完全匹配权重
      exactUrlMatch: 150,      // 提高 URL 完全匹配权重

      // 2. 调整开头匹配权重，因为用户通常从开头输入
      titleStartsWith: 180,    // 提高标题开头匹配权重
      urlStartsWith: 150,      // 提高 URL 开头匹配权重

      // 3. 包含匹配权重适当调��，避免干扰更精确的结果
      titleIncludes: 100,
      urlIncludes: 80,

      // 4. 提高分词匹配的权重，改善多关键词搜索体验
      wordMatch: 70,           // 提高分词匹配基础权重
      partialWordMatch: 40,    // 提高部分词匹配权重

      // 5. 保持模糊匹配权重较低，作为补充
      fuzzyMatch: 30
    };

    // 数据预处理
    const lowerQuery = query.toLowerCase().trim();
    const lowerTitle = (title || '').toLowerCase().trim();
    const lowerUrl = (url || '').toLowerCase().trim();
    const queryWords = lowerQuery.split(/\s+/);  // 将查询分词

    let score = 0;

    // 1. 完全匹配检查
    if (lowerTitle === lowerQuery) {
      score += weights.exactTitleMatch;
    }
    if (lowerUrl === lowerQuery) {
      score += weights.exactUrlMatch;
    }

    // 2. 开头匹配检查
    if (lowerTitle.startsWith(lowerQuery)) {
      score += weights.titleStartsWith;
    }
    if (lowerUrl.startsWith(lowerQuery)) {
      score += weights.urlStartsWith;
    }

    // 3. 包含匹配检查
    if (lowerTitle.includes(lowerQuery)) {
      score += weights.titleIncludes;
    }
    if (lowerUrl.includes(lowerQuery)) {
      score += weights.urlIncludes;
    }

    // 4. 分词匹配
    queryWords.forEach(word => {
      if (word.length > 1) {
        // 完整词匹配给予更高权重
        if (lowerTitle.includes(word)) {
          score += weights.wordMatch;
          // 词在开头给予额外加分
          if (lowerTitle.startsWith(word)) {
            score += weights.wordMatch * 0.3;
          }
        }
        if (lowerUrl.includes(word)) {
          score += weights.wordMatch * 0.6;  // URL 分词匹配权重适当提高
        }

        // 7. 添加部分词匹配逻辑
        const partialMatches = findPartialMatches(word, lowerTitle);
        if (partialMatches > 0) {
          score += weights.partialWordMatch * partialMatches * 0.5;
        }
      }
    });

    // 5. 模糊匹配（编辑距离）
    if (title) {
      const fuzzyScore = calculateFuzzyMatch(lowerQuery, lowerTitle);
      if (fuzzyScore > 0.85) {  // 提高相似度阈值
        score += weights.fuzzyMatch * Math.pow(fuzzyScore, 2); // 使用平方增加高相似度的权重
      }
    }


    // 6. 长度惩罚因子（避免过长的结果）
    const lengthPenalty = Math.max(1, Math.log2(lowerTitle.length / lowerQuery.length));
    score = score / lengthPenalty;

    // 7. 添加时间衰减因子（如果有时间戳）
    if (title && title.timestamp) {
      const daysOld = (Date.now() - title.timestamp) / (1000 * 60 * 60 * 24);
      const timeDecay = Math.exp(-daysOld / 60);  // 延长半衰期到 60 天
      score *= (0.7 + 0.3 * timeDecay);  // 保留基础分数的 70%
    }

    return Math.round(score * 100) / 100;
  }

  // 计算模糊匹配分数
  function calculateFuzzyMatch(query, text) {
    if (query.length === 0 || text.length === 0) return 0;
    if (query === text) return 1;

    const maxLength = Math.max(query.length, text.length);
    const distance = levenshteinDistance(query, text);
    return (maxLength - distance) / maxLength;
  }
  // 辅助函数：查找部分词匹配数量
  function findPartialMatches(word, text) {
    let count = 0;
    let pos = 0;
    while ((pos = text.indexOf(word.substring(0, Math.ceil(word.length * 0.7)), pos)) !== -1) {
      count++;
      pos += 1;
    }
    return count;
  }

  // Levenshtein 距离计算
  function levenshteinDistance(a, b) {
    const matrix = Array(b.length + 1).fill().map(() => Array(a.length + 1).fill(0));

    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,                   // 删除
          matrix[j - 1][i] + 1,                   // 插入
          matrix[j - 1][i - 1] + substitutionCost // 替换
        );
      }
    }
    return matrix[b.length][a.length];
  }

  function updateSidebarDefaultBookmarkIndicator() {
    const defaultBookmarkId = localStorage.getItem('defaultBookmarkId');
    selectSidebarFolder(defaultBookmarkId);
    
    const allCategories = document.querySelectorAll('#categories-list li');
    allCategories.forEach(category => {
      const indicator = category.querySelector('.default-indicator');
      if (indicator) {
        indicator.remove();
      }
      if (category.dataset.id === defaultBookmarkId) {
        const defaultIndicator = document.createElement('span');
        defaultIndicator.className = 'default-indicator material-icons';
        defaultIndicator.textContent = 'star';
        defaultIndicator.title = getLocalizedMessage('homepage');
        category.appendChild(defaultIndicator);
      }
    });
  }

  function updateBookmarksDisplay(parentId, movedItemId, newIndex) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.getChildren(parentId, (bookmarks) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        const bookmarksList = document.getElementById('bookmarks-list');
        const bookmarksContainer = document.querySelector('.bookmarks-container');

        // 先隐藏容器
        bookmarksContainer.style.opacity = '0';
        bookmarksContainer.style.transform = 'translateY(20px)';

        // 清空现有书签和占位符
        bookmarksList.innerHTML = '';

        // 更新本地缓存
        bookmarkOrderCache[parentId] = bookmarks.map(b => b.id);

        // 添加新的书签
        bookmarks.forEach((bookmark, index) => {
          const bookmarkElement = bookmark.url ? createBookmarkCard(bookmark, index) : createFolderCard(bookmark, index);
          bookmarksList.appendChild(bookmarkElement);
        });

        bookmarksList.dataset.parentId = parentId;

        if (movedItemId) {
          highlightBookmark(movedItemId);
        }

        // 更新文件夹名称
        updateFolderName(parentId);

        // 使用 requestAnimationFrame 来确保 DOM 更新后再显示容器
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            bookmarksContainer.style.opacity = '1';
            bookmarksContainer.style.transform = 'translateY(0)';
          });
        });

        resolve();
      });
    });
  }



  new Sortable(tabsContainer, {
    animation: 150,
    onEnd: function (evt) {
      const orderedEngines = Array.from(tabsContainer.children).map(tab => tab.getAttribute('data-engine'));
      localStorage.setItem('orderedSearchEngines', JSON.stringify(orderedEngines));
    }
  });


  searchInput.addEventListener('focus', function () {
    searchForm.classList.add('focused');
  });

  searchInput.addEventListener('blur', function () {
    searchForm.classList.remove('focused');
  });

  if (!searchForm || !searchInput || !tabsContainer || !searchEngineIcon) {
    return;
  }



  function updateSubmitButtonState() {
    if (searchInput.value.trim() === '') {
      tabsContainer.style.display = 'none';
    } else {
      // 只有当搜索建议列表不为空时才显示 tabs-container
      if (searchSuggestions.children.length > 0) {
        tabsContainer.style.display = 'flex';
      } else {
        tabsContainer.style.display = 'none';
      }
    }
  }



  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }


  function queueSearch() {
    const query = searchInput.value.trim();
    if (query === '') {
      return;
    }
    searchQueue.push(query);
    processSearchQueue();
  }

  function processSearchQueue() {
    if (isSearching || searchQueue.length === 0) {
      return;
    }
    
    const query = searchQueue.shift();
    debouncedPerformSearch(query);
  }

  function setDefaultSearchEngine(engine) {
    console.log('[Settings] Setting new default engine:', engine);
    defaultSearchEngine = engine;
    localStorage.setItem('selectedSearchEngine', engine);
  }

  function getSearchUrl(engine, query) {
    switch (engine.toLowerCase()) {
      case 'kimi':
      case 'kimi':
        return `https://kimi.moonshot.cn/?q=${encodeURIComponent(query)}`;
      case 'doubao':
      case '豆包':
        return `https://www.doubao.com/chat/?q=${encodeURIComponent(query)}`;
      case 'chatgpt':
        return `https://chatgpt.com/?q=${encodeURIComponent(query)}`;
      case 'felo':
        return `https://felo.ai/search?q=${query}`;
      case 'metaso':
      case '秘塔':
        return `https://metaso.cn/?q=${query}`;
      case 'google':
      case '谷歌':
        return `https://www.google.com/search?q=${query}`;
      case 'bing':
      case '必应':
        return `https://www.bing.com/search?q=${query}`;
      case 'baidu':
      case '百度':
        return `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`;
      default:
        return `https://www.bing.com/search?q=${query}`;
    }
  }

  // 动态调整 textarea 度的函数
  function adjustTextareaHeight() {
    searchInput.style.height = 'auto'; // 重置高度
    const maxHeight = 3 * 32; // 假设每行高度为 24px，最多显示 3 行
    searchInput.style.height = Math.min(searchInput.scrollHeight, maxHeight) + 'px';
  }

  // 在输入事件中调用调整高度的函数
  searchInput.addEventListener('input', adjustTextareaHeight);

  // 初始化时调整高度
  adjustTextareaHeight();


  // 防抖函
  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
  // 添加这个函数定义
  async function getBingSuggestions(query) {
    try {
      const response = await fetch(`https://api.bing.com/osjson.aspx?query=${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data[1].map(suggestion => ({
        text: suggestion,
        type: 'bing_suggestion',
        relevance: 1
      }));
    } catch (error) {
      return []; // 返回空数组，以便在出错时程序可以继续运行
    }
  }
  async function getRecentHistory(limit = 100, maxPerDomain = 5) {
    return new Promise((resolve) => {
      chrome.history.search({ text: '', maxResults: limit * 20 }, (historyItems) => {
        const now = Date.now();
        const domainCounts = {};
        const uniqueItems = new Map();

        const recentHistory = historyItems
          // 映射并添加额外信息
          .map(item => {
            const url = new URL(item.url);
            const domain = url.hostname;
            return {
              text: item.title,
              url: item.url,
              domain: domain,
              type: 'history',
              relevance: 1,
              timestamp: item.lastVisitTime
            };
          })
          // 按时间排序（最近的优先）
          .sort((a, b) => b.timestamp - a.timestamp)
          // 去重（基于URL和标题）并限制每个域名的数量
          .filter(item => {
            const key = `${item.url}|${item.text}`;
            if (uniqueItems.has(key)) return false;
            
            domainCounts[item.domain] = (domainCounts[item.domain] || 0) + 1;
            if (domainCounts[item.domain] > maxPerDomain) return false;
            
            uniqueItems.set(key, item);
            return true;
          })
          // 应用时间衰减因子
          .map(item => {
            const daysSinceLastVisit = (now - item.timestamp) / (1000 * 60 * 60 * 24);
            item.relevance *= Math.exp(-daysSinceLastVisit / RELEVANCE_CONFIG.timeDecayHalfLife);
            return item;
          })
          // 再次排序，这次基于相关性（考虑了时间衰减）
          .sort((a, b) => b.relevance - a.relevance)
          // 限制结果数量
          .slice(0, limit);

        resolve(recentHistory);
      });
    });
  }

  function searchHistory(query, maxResults = 200) {
    return new Promise((resolve) => {
      const startTime = new Date().getTime() - (30 * 24 * 60 * 60 * 1000); // 搜索最近30天的历史
      chrome.history.search(
        { 
          text: query, 
          startTime: startTime,
          maxResults: maxResults 
        }, 
        (results) => {
          
          // 对历史记录进行去重
          const uniqueResults = Array.from(new Set(results.map(r => r.url)))
            .map(url => results.find(r => r.url === url));
          resolve(uniqueResults);
        }
      );
    });
  }
  // 获取搜索建议
  async function getSuggestions(query) {
    const maxHistoryResults = 200;
    const maxBookmarkResults = 50;
    const maxTotalSuggestions = 50;

    const suggestions = [{ text: query, type: 'search', relevance: Infinity }];

    // 从历史记录获取建议
    const historyItems = await searchHistory(query, maxHistoryResults);
    const historySuggestions = historyItems.map(item => ({
      text: item.title,
      url: item.url,
      type: 'history',
      relevance: calculateRelevance(query, item.title, item.url),
      timestamp: item.lastVisitTime
    }));

    // 从书签获取建议
    const bookmarkItems = await new Promise(resolve => {
      chrome.bookmarks.search(query, resolve);
    });
    const bookmarkSuggestions = bookmarkItems.slice(0, maxBookmarkResults).map(item => ({
      text: item.title,
      url: item.url,
      type: 'bookmark',
      relevance: calculateRelevance(query, item.title, item.url) * RELEVANCE_CONFIG.bookmarkRelevanceBoost
    }));



    // 合并所有建议
    suggestions.push(
      ...historySuggestions,
      ...bookmarkSuggestions,
 
    );
    // 对结果进行排序和去重
    const uniqueSuggestions = Array.from(new Set(suggestions.map(s => s.url)))
      .map(url => suggestions.find(s => s.url === url))
      .sort((a, b) => b.relevance - a.relevance);
    // 平衡和交替显示结果
    const balancedResults = await balanceResults(uniqueSuggestions, maxTotalSuggestions);
    balancedResults.slice(0, 5).forEach((suggestion, index) => {
    });

    return balancedResults;
  }

  function calculateRelevance(query, title, url) {
    // 基础设置
    const weights = {
      exactTitleMatch: 100,    // 标题完全匹配权重
      exactUrlMatch: 80,       // URL完全匹配权重
      titleStartsWith: 70,     // 标题开头匹配权重
      urlStartsWith: 60,       // URL开头匹配权重
      titleIncludes: 50,       // 标题包含匹配权重
      urlIncludes: 40,         // URL包含匹配权重
      wordMatch: 30,           // 分词匹配权重
      fuzzyMatch: 20           // 模糊匹配权重
    };

    // 数据预处理
    const lowerQuery = query.toLowerCase().trim();
    const lowerTitle = (title || '').toLowerCase().trim();
    const lowerUrl = (url || '').toLowerCase().trim();
    const queryWords = lowerQuery.split(/\s+/);  // 将查询分词

    let score = 0;

    // 1. 完全匹配检查
    if (lowerTitle === lowerQuery) {
      score += weights.exactTitleMatch;
    }
    if (lowerUrl === lowerQuery) {
      score += weights.exactUrlMatch;
    }

    // 2. 开头匹配检查
    if (lowerTitle.startsWith(lowerQuery)) {
      score += weights.titleStartsWith;
    }
    if (lowerUrl.startsWith(lowerQuery)) {
      score += weights.urlStartsWith;
    }

    // 3. 包含匹配检查
    if (lowerTitle.includes(lowerQuery)) {
      score += weights.titleIncludes;
    }
    if (lowerUrl.includes(lowerQuery)) {
      score += weights.urlIncludes;
    }

    // 4. 分词匹配
    queryWords.forEach(word => {
      if (word.length > 1) {  // 忽略单字符词
        if (lowerTitle.includes(word)) {
          score += weights.wordMatch;
        }
        if (lowerUrl.includes(word)) {
          score += weights.wordMatch / 2;  // URL分词匹配权重较低
        }
      }
    });

    // 5. 模糊匹配（编辑距离）
    if (title) {
      const fuzzyScore = calculateFuzzyMatch(lowerQuery, lowerTitle);
      if (fuzzyScore > 0.8) {  // 相似度阈值
        score += weights.fuzzyMatch * fuzzyScore;
      }
    }

    // 6. 长度惩罚因子（避免过长的结果）
    const lengthPenalty = Math.max(1, Math.log(lowerTitle.length / lowerQuery.length));
    score = score / lengthPenalty;

    // 7. 添加时间衰减因子（如果有时间戳）
    if (title && title.timestamp) {
      const daysOld = (Date.now() - title.timestamp) / (1000 * 60 * 60 * 24);
      const timeDecay = Math.exp(-daysOld / 30);  // 30天的半衰期
      score *= timeDecay;
    }

    return Math.round(score * 100) / 100;  // 保留两位小数
  }

  // 计算模糊匹配分数
  function calculateFuzzyMatch(query, text) {
    if (query.length === 0 || text.length === 0) return 0;
    if (query === text) return 1;

    const maxLength = Math.max(query.length, text.length);
    const distance = levenshteinDistance(query, text);
    return (maxLength - distance) / maxLength;
  }

  // Levenshtein 距离计算
  function levenshteinDistance(a, b) {
    const matrix = Array(b.length + 1).fill().map(() => Array(a.length + 1).fill(0));

    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,                   // 删除
          matrix[j - 1][i] + 1,                   // 插入
          matrix[j - 1][i - 1] + substitutionCost // 替换
        );
      }
    }
    return matrix[b.length][a.length];
  }

  // Levenshtein 距离函数（如果之前没有定义的话）
  function levenshteinDistance(a, b) {
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  async function balanceResults(suggestions, maxResults) {
    const currentSuggestion = suggestions.filter(s => s.type === 'search');
    let bookmarks = suggestions.filter(s => s.type === 'bookmark');
    let histories = suggestions.filter(s => s.type === 'history');
    let bingSuggestions = suggestions.filter(s => s.type === 'bing_suggestion');

    // 应用时间衰减因子到历史记录
    const now = Date.now();
    histories = histories.map(h => {
      const daysSinceLastVisit = (now - h.timestamp) / (1000 * 60 * 60 * 24);
      if (daysSinceLastVisit < 7) { // 如果是最近7天内的记录
        h.relevance *= 1.5; // 为最近的记录提供额外的提升
      }
      h.relevance *= Math.exp(-daysSinceLastVisit / RELEVANCE_CONFIG.timeDecayHalfLife);
      return h;
    });

    // 为书签提供轻微的相关性提
    bookmarks = bookmarks.map(b => {
      b.relevance *= RELEVANCE_CONFIG.bookmarkRelevanceBoost;
      return b;
    });

    // 重新排序
    bookmarks.sort((a, b) => b.relevance - a.relevance);
    histories.sort((a, b) => b.relevance - a.relevance);
    bingSuggestions.sort((a, b) => b.relevance - a.relevance);

    const results = [...currentSuggestion];
    const maxEachType = Math.floor((maxResults - 1) / 4); // 现在我们有4种类型

    // 交替添加不同类型的建议
    for (let i = 0; i < maxEachType * 4; i++) {
      if (i % 4 === 0 && bookmarks.length > 0) {
        results.push(bookmarks.shift());
      } else if (i % 4 === 1 && histories.length > 0) {
        results.push(histories.shift());
      } else if (i % 4 === 2 && bingSuggestions.length > 0) {
        results.push(bingSuggestions.shift());
      } else if (histories.length > 0) {
        results.push(histories.shift());
      }
    }

    // 如果还有空间，添加剩余的最相关项
    while (results.length < maxResults && (bookmarks.length > 0 || histories.length > 0 || bingSuggestions.length > 0)) {
      if (bookmarks.length === 0) {
        if (histories.length === 0) {
          results.push(bingSuggestions.shift());
        } else if (bingSuggestions.length === 0) {
          results.push(histories.shift());
        } else {
          results.push(histories[0].relevance > bingSuggestions[0].relevance ? histories.shift() : bingSuggestions.shift());
        }
      } else if (histories.length === 0) {
        if (bookmarks.length === 0) {
          results.push(bingSuggestions.shift());
        } else if (bingSuggestions.length === 0) {
          results.push(bookmarks.shift());
        } else {
          results.push(bookmarks[0].relevance > bingSuggestions[0].relevance ? bookmarks.shift() : bingSuggestions.shift());
        }
      } else if (bingSuggestions.length === 0) {
        results.push(bookmarks[0].relevance > histories[0].relevance ? bookmarks.shift() : histories.shift());
      } else {
        const maxRelevance = Math.max(bookmarks[0].relevance, histories[0].relevance, bingSuggestions[0].relevance);
        if (maxRelevance === bookmarks[0].relevance) {
          results.push(bookmarks.shift());
        } else if (maxRelevance === histories[0].relevance) {
          results.push(histories.shift());
        } else {
          results.push(bingSuggestions.shift());
        }
      }
    }

    // 计算用户相关性
    const suggestionsWithUserRelevance = await calculateUserRelevance(results);

    // 重新排序，使用 userRelevance 而不是 relevance
    suggestionsWithUserRelevance.sort((a, b) => b.userRelevance - a.userRelevance);

    return suggestionsWithUserRelevance;
  }

  const USER_BEHAVIOR_KEY = 'userSearchBehavior';

  // 在文件顶部定义 MAX_BEHAVIOR_ENTRIES
  const MAX_BEHAVIOR_ENTRIES = 1000; // 你可以根据需要调整这个值

  // 获取用户行为数据
  async function getUserBehavior() {
    return new Promise((resolve) => {
      chrome.storage.local.get(USER_BEHAVIOR_KEY, (result) => {
        const behavior = result[USER_BEHAVIOR_KEY] || {};
        resolve(behavior); // 直接返回行为数据，不进行清理
      });
    });
  }

  // 保存用户行为数据
  async function saveUserBehavior(key, increment = 1) {
    const behavior = await getUserBehavior();
    const now = Date.now();

    if (!behavior[key]) {
      behavior[key] = { count: 0, lastUsed: now };
    }

    behavior[key].count += increment; // 增加计数
    behavior[key].lastUsed = now; // 更新最后用时间

    // 检查条目数并清理
    if (Object.keys(behavior).length > MAX_BEHAVIOR_ENTRIES) {
      const sortedEntries = Object.entries(behavior)
        .sort(([, a], [, b]) => a.lastUsed - b.lastUsed); // 按最后使用时间排序
      sortedEntries.slice(0, sortedEntries.length - MAX_BEHAVIOR_ENTRIES).forEach(([key]) => {
        delete behavior[key]; // 删除最旧的条目
      });
    }

    return new Promise((resolve) => {
      chrome.storage.local.set({ [USER_BEHAVIOR_KEY]: behavior }, resolve); // 直接保存行为数据
    });
  }

  // 计算用户相关性
  async function calculateUserRelevance(suggestions) {
    const behavior = await getUserBehavior();
    const now = Date.now();

    return suggestions.map(suggestion => {
      const key = suggestion.url || suggestion.text;
      const behaviorData = behavior[key];

      if (!behaviorData) return { ...suggestion, userRelevance: suggestion.relevance };

      const daysSinceLastUse = (now - behaviorData.lastUsed) / (1000 * 60 * 60 * 24);
      const recencyFactor = Math.exp(-daysSinceLastUse / 30); // 30天的半衰期
      const behaviorScore = behaviorData.count * recencyFactor;

      return {
        ...suggestion,
        userRelevance: suggestion.relevance * (1 + behaviorScore * 0.1) // 增加最多10%的权重
      };
    });
  }

  let allSuggestions = [];
  let displayedSuggestions = 0;
  const suggestionsPerLoad = 10; // 每次加载10个建议

  let isScrollListenerAttached = false;

  function showSuggestions(suggestions) {
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      hideSuggestions();
      return;
    }

    allSuggestions = suggestions;
    displayedSuggestions = 0;
    searchSuggestions.innerHTML = '';
  
    const searchForm = document.querySelector('.search-form');
    searchForm.classList.add('focused-with-suggestions');

    const suggestionsWrapper = document.querySelector('.search-suggestions-wrapper');
    if (suggestionsWrapper) {
      suggestionsWrapper.style.display = 'block';
    }
    searchSuggestions.style.display = 'block';

    // 显示 line-container
    const lineContainer = document.getElementById('line-container');
    lineContainer.style.display = 'block'; // 显示线条

    // Set a fixed height for the suggestions container
    searchSuggestions.style.maxHeight = '390px'; // Adjust this value as needed
    searchSuggestions.style.overflowY = 'auto';

    loadMoreSuggestions();

    if (!isScrollListenerAttached) {
      searchSuggestions.addEventListener('scroll', throttledHandleScroll);
      isScrollListenerAttached = true;
    }
    setTimeout(() => {
    }, 0);
  }

  function loadMoreSuggestions() {
    if (!Array.isArray(allSuggestions) || allSuggestions.length === 0) {
      return;
    }

    const remainingSuggestions = allSuggestions.length - displayedSuggestions;
    const suggestionsToAdd = Math.min(remainingSuggestions, 10);

    if (suggestionsToAdd <= 0) {
      return;
    }

    const fragment = document.createDocumentFragment();
    for (let i = displayedSuggestions; i < displayedSuggestions + suggestionsToAdd; i++) {
      const li = createSuggestionElement(allSuggestions[i]);
      fragment.appendChild(li);
    }

    searchSuggestions.appendChild(fragment);
    displayedSuggestions += suggestionsToAdd;

  }

  function throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    }
  }

  const throttledHandleScroll = throttle(function() {
    const scrollPosition = searchSuggestions.scrollTop + searchSuggestions.clientHeight;
    const scrollHeight = searchSuggestions.scrollHeight;
    if (scrollPosition >= scrollHeight - 20 && displayedSuggestions < allSuggestions.length) {
      loadMoreSuggestions();
    }
  }, 200);  // 限制为每200毫秒最多执行一次

  function showNoMoreSuggestions() {
    const existingNoMore = searchSuggestions.querySelector('.no-more-suggestions');
    if (!existingNoMore) {
      const noMoreElement = document.createElement('li');
      noMoreElement.className = 'no-more-suggestions';
      noMoreElement.style.height = '38px'; // 设置一个固定高度，与他建议项保持一致
      noMoreElement.style.visibility = 'hidden'; // 使元素不可见，但保留空间
      searchSuggestions.appendChild(noMoreElement);
    }
  }

  // 修改创建建议元素的函数
  function createSuggestionElement(suggestion) {
    const li = document.createElement('li');
    const displayUrl = suggestion.url ? formatUrl(suggestion.url) : '';
    li.setAttribute('data-type', suggestion.type);
    if (suggestion.url) {
      li.setAttribute('data-url', suggestion.url);
    }
    const searchSvgIcon = `<svg class="suggestion-icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
  <path d="M466.624 890.432a423.296 423.296 0 0 1-423.936-423.04C42.688 233.728 231.936 42.624 466.56 42.624a423.68 423.68 0 0 1 423.936 424.64 437.952 437.952 0 0 1-56.32 213.12 47.872 47.872 0 0 1-64.128 17.28 48 48 0 0 1-17.216-64.256c29.76-50.176 43.84-106.56 43.84-166.144-1.6-183.36-148.608-330.624-330.112-330.624a330.432 330.432 0 0 0-330.112 330.624 329.408 329.408 0 0 0 330.112 330.688c57.92 0 115.776-15.68 165.824-43.904a47.872 47.872 0 0 1 64.128 17.28 48 48 0 0 1-17.152 64.192 443.584 443.584 0 0 1-212.8 54.848z" fill="#334155"></path>
  <path d="M466.624 890.432a423.296 423.296 0 0 1-423.936-423.04c0-75.264 20.288-148.928 56.32-213.12a47.872 47.872 0 0 1 64.128-17.28 48 48 0 0 1 17.216 64.256 342.08 342.08 0 0 0-43.84 166.08c0 181.76 147.072 330.688 330.112 330.688a329.408 329.408 0 0 0 330.112-330.688A330.432 330.432 0 0 0 466.56 136.704c-57.856 0-115.776 15.68-165.824 43.84a47.872 47.872 0 0 1-64.128-17.216 48 48 0 0 1 17.216-64.256A436.032 436.032 0 0 1 466.56 42.688c233.088 0 422.4 189.568 422.4 424.64a422.016 422.016 0 0 1-422.4 423.104z" fill="#334155"></path>
  <path d="M934.4 981.312a44.992 44.992 0 0 1-32.832-14.08l-198.72-199.04c-18.752-18.816-18.752-48.576 0-65.792 18.752-18.816 48.512-18.816 65.728 0l198.656 199.04c18.816 18.752 18.816 48.576 0 65.792a47.68 47.68 0 0 1-32.832 14.08z" fill="#334155"></path>
</svg>`;
    // 限制建议文本的长度
    const maxTextLength = 20; // 你可以根据需要调整这个值
    const truncatedText = suggestion.text.length > maxTextLength 
      ? suggestion.text.substring(0, maxTextLength) + '...' 
      : suggestion.text;

    li.innerHTML = `
    ${suggestion.type === 'search' ? searchSvgIcon : '<span class="material-icons suggestion-icon"></span>'}
    <div class="suggestion-content">
      <span class="suggestion-text" title="${suggestion.text}">${truncatedText}</span>
      ${displayUrl ? `<span class="suggestion-dash">-</span><span class="suggestion-url">${displayUrl}</span>` : ''}
    </div>
    <span class="suggestion-type">${suggestion.type}</span>
  `;

    if (suggestion.url && suggestion.type !== 'search') {
      getFavicon(suggestion.url, (faviconUrl) => {
        const iconSpan = li.querySelector('.suggestion-icon');
        iconSpan.innerHTML = `<img src="${faviconUrl}" alt="" class="favicon">`;
      });
    }

    li.addEventListener('click', async () => {
      if (suggestion.url) {
        window.open(suggestion.url, '_blank');
        await saveUserBehavior(suggestion.url);
      } else {
        searchInput.value = suggestion.text;
        searchInput.focus();
        queueSearch();
        await saveUserBehavior(suggestion.text);
      }
      hideSuggestions();
    });

    return li;
  }

  function formatUrl(url) {
    try {
      const urlObj = new URL(url);
      let domain = urlObj.hostname;

      // 移除 'www.' 前缀（如果存在）
      domain = domain.replace(/^www\./, '');

      // 如果路径不只是 '/'
      let path = urlObj.pathname;
      if (path && path !== '/') {
        // 截断长路径
        path = path.length > 10 ? path.substring(0, 10) + '...' : path;
        domain += path;
      }

      return domain;
    } catch (e) {
      // 如果 URL 解析失败，返回空字符串
      return '';
    }
  }


  // Add this function to fetch favicons
  function getFavicon(url, callback) {
    const faviconURL = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`;
    const img = new Image();
    img.onload = function () {
      callback(faviconURL);
    };
    img.onerror = function () {
      callback(''); // Return an empty string if favicon is not found
    };
    img.src = faviconURL;
  }

  // Add this function to fetch favicon online as a fallback
  function fetchFaviconOnline(url, callback) {
    const domain = new URL(url).hostname;
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    const img = new Image();
    img.onload = function () {
      cacheFavicon(domain, faviconUrl);
      callback(faviconUrl);
    };
    img.onerror = function () {
      callback('');
    };
    img.src = faviconUrl;
  }

  // Add this function to cache favicons
  function cacheFavicon(domain, faviconUrl) {
    const data = {};
    data[domain] = faviconUrl;
    chrome.storage.local.set(data);
  }

  async function showDefaultSuggestions() {
    const recentHistory = await getRecentHistory(20);
    const suggestions = recentHistory.map(item => ({
      text: item.text,
      url: item.url,
      type: 'history',
      relevance: item.relevance
    }));

    showSuggestions(suggestions);
  }

  // 处理输入事件
  const handleInput = debounce(async () => {
    const query = searchInput.value.trim();
    showLoadingIndicator();
    if (query) {
      const suggestions = await getSuggestions(query);
      hideLoadingIndicator();
      showSuggestions(suggestions);
    } else {
      hideLoadingIndicator();
      showDefaultSuggestions();
    }
    updateSubmitButtonState();
  }, 300);

  searchInput.addEventListener('input', () => {
    handleInput();
    updateSubmitButtonState();
    if (searchInput.value.trim() === '') {
      showDefaultSuggestions();
    }
  });

  // 修改搜索输入框的事件监听器
  searchInput.addEventListener('focus', () => {
    const searchForm = document.querySelector('.search-form');
    searchForm.classList.add('focused');
    if (searchInput.value.trim() === '') {
      showDefaultSuggestions();
    } else {
      const suggestions = getSuggestions(searchInput.value.trim());
      showSuggestions(suggestions);
    }
  });

  searchInput.addEventListener('blur', (e) => {
    const searchForm = document.querySelector('.search-form');
    searchForm.classList.remove('focused');
    // 使用 setTimeout 来延迟隐藏建议列表，允许点击建议
    setTimeout(() => {
      if (!searchForm.contains(document.activeElement)) {
        hideSuggestions();
      }
    }, 200);
  });



  // 处理键盘导航
  searchInput.addEventListener('keydown', (e) => {
    const items = searchSuggestions.querySelectorAll('li');
    let index = Array.from(items).findIndex(item => item.classList.contains('keyboard-selected'));

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (index < items.length - 1) index++;
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (index > 0) index--;
        break;
      case 'Enter':
        e.preventDefault();
        if (e.metaKey || e.ctrlKey) {
          // 处理 Cmd/Ctrl + Enter
          const query = searchInput.value.trim();
          if (query) {
            openAllSearchEnginesExceptCurrent(query);
          }
        } else if (index !== -1) {
          e.stopPropagation(); // 阻止事件冒泡
          const selectedItem = items[index];
          const suggestionType = selectedItem.getAttribute('data-type');
          if (suggestionType === 'history' || suggestionType === 'bookmark') {
            const url = selectedItem.getAttribute('data-url');
            if (url) {
              window.open(url, '_blank');
              hideSuggestions();
              return;
            }
          }
          selectedItem.click();
        } else {
          performSearch(searchInput.value.trim());
        }
        return;
      default:
        return;
    }

    items.forEach(item => item.classList.remove('keyboard-selected'));
    if (index !== -1) {
      items[index].classList.add('keyboard-selected');
      // 只在选择搜索建议时更新输入框的值
      const selectedItem = items[index];
      const suggestionType = selectedItem.getAttribute('data-type');
      if (suggestionType === 'search') {
        searchInput.value = selectedItem.querySelector('.suggestion-text').textContent;
      }
    }
  })

  // 添加防抖函数
  function debounce(func, wait) {
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



  function hideSuggestions() {
    if (isChangingSearchEngine) {
      return; // 如果正在切换搜索引擎，不隐藏建议列表
    }
    const searchForm = document.querySelector('.search-form');
    searchForm.classList.remove('focused-with-suggestions');

    const suggestionsWrapper = document.querySelector('.search-suggestions-wrapper');
    if (suggestionsWrapper) {
      suggestionsWrapper.style.display = 'none';
    }
    if (searchSuggestions) {
      searchSuggestions.style.display = 'none';
      searchSuggestions.innerHTML = ''; // Clear the suggestions
    }

    // 隐藏 line-container
    const lineContainer = document.getElementById('line-container');
    lineContainer.style.display = 'none'; // 隐藏线条

    if (isScrollListenerAttached) {
      searchSuggestions.removeEventListener('scroll', throttledHandleScroll);
      isScrollListenerAttached = false;
    }

    // Reset suggestions-related variables
    allSuggestions = [];
    displayedSuggestions = 0;
  }

  function showLoadingIndicator() {
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.innerHTML = `
    <svg class="loading-spinner" viewBox="0 0 50 50">
      <circle class="spinner-path" cx="25" cy="25" r="20" fill="none" stroke-width="4"></circle>
    </svg>
  `;
    searchSuggestions.appendChild(loadingIndicator);
  }

  function hideLoadingIndicator() {
    const loadingIndicator = searchSuggestions.querySelector('.loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.remove();
    }
  }


  // 修改这个函数
  function openAllSearchEnginesExceptCurrent(query) {
    const currentEngine = localStorage.getItem('selectedSearchEngine') || 'google';
    const engines = ['google', 'bing', 'baidu', 'kimi', 'doubao', 'chatgpt', 'felo', 'metaso'];

    const urls = engines
      .filter(engine => engine.toLowerCase() !== currentEngine.toLowerCase())
      .map(engine => getSearchUrl(engine, query));

    if (urls.length > 0) {
      // 设置一个标志，表示这是通过 Cmd/Ctrl + Enter 触发的搜索
      window.lastSearchTrigger = 'cmdCtrlEnter';

      chrome.runtime.sendMessage({
        action: 'openMultipleTabsAndGroup',
        urls: urls,
        groupName: query
      }, function (response) {
        if (response && response.success) {
        } else {
          console.error('打开多个标签页或创建标签组失败:', response ? response.error : '未知错误');
        }
      });
    } else {
      console.log('没有其他搜索引擎可以打开');
    }
  }
});

// 修改 createSearchEngineDropdown 函数
function createSearchEngineDropdown() {
  const searchForm = document.querySelector('.search-form');
  const iconContainer = document.querySelector('.search-icon-container');
  const tabsContainer = document.getElementById('tabs-container');

  // 创建下拉菜单容器
  const dropdownContainer = document.createElement('div');
  dropdownContainer.className = 'search-engine-dropdown';
  dropdownContainer.style.display = 'none';

  // 定义搜索引擎列表
  const engines = [
    { name: 'google', icon: '../images/google-logo.svg', label: getLocalizedMessage('googleLabel') },
    { name: 'bing', icon: '../images/bing-logo.png', label: getLocalizedMessage('bingLabel') },
    { name: 'baidu', icon: '../images/baidu-logo.svg', label: getLocalizedMessage('baiduLabel') },
    { name: 'kimi', icon: '../images/kimi-logo.svg', label: getLocalizedMessage('kimiLabel') },
    { name: 'doubao', icon: '../images/doubao-logo.png', label: getLocalizedMessage('doubaoLabel') },
    { name: 'chatgpt', icon: '../images/chatgpt-logo.svg', label: getLocalizedMessage('chatgptLabel') },
    { name: 'felo', icon: '../images/felo-logo.svg', label: getLocalizedMessage('feloLabel') },
    { name: 'metaso', icon: '../images/metaso-logo.png', label: getLocalizedMessage('metasoLabel') }
  ];

  // 创建下拉菜单选项
  engines.forEach(engine => {
    const option = document.createElement('div');
    option.className = 'search-engine-option';
    option.innerHTML = `
      <img src="${engine.icon}" alt="${engine.label}" class="search-engine-icon">
      <span>${engine.label}</span>
    `;

    option.addEventListener('click', (e) => {
      e.stopPropagation();
      
      // 更新默认搜索引擎
      localStorage.setItem('selectedSearchEngine', engine.name);
      
      // 更新搜索引擎图标
      const searchEngineIcon = document.getElementById('search-engine-icon');
      if (searchEngineIcon) {
        searchEngineIcon.src = engine.icon;
        searchEngineIcon.alt = `${engine.label} Search`;
      }

      // 恢复标签栏到默认搜索引擎状态
      const defaultEngine = engine.name.toLowerCase();
      const tabs = document.querySelectorAll('.tab');
      tabs.forEach(tab => {
        const tabEngine = tab.getAttribute('data-engine').toLowerCase();
        if (tabEngine === defaultEngine) {
          tab.classList.add('active');
        } else {
          tab.classList.remove('active');
        }
      });

      // 记录状态变化
      console.log('[Dropdown] Set default engine:', engine.name);
      console.log('[Dropdown] Updated localStorage:', localStorage.getItem('selectedSearchEngine'));
      
      // 隐藏下拉菜单
      dropdownContainer.style.display = 'none';

      // 触发自定义事件通知其他组件默认搜索引擎已更改
      const event = new CustomEvent('defaultSearchEngineChanged', {
        detail: { engine: engine.name }
      });
      document.dispatchEvent(event);
    });

    dropdownContainer.appendChild(option);
  });

  // 点击图标显示/隐藏下拉菜单
  iconContainer.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVisible = dropdownContainer.style.display === 'block';
    dropdownContainer.style.display = isVisible ? 'none' : 'block';
  });

  // 点击其他区域隐藏下拉菜单
  document.addEventListener('click', () => {
    dropdownContainer.style.display = 'none';
  });

  // 将下拉菜单添加到搜索表单中
  searchForm.appendChild(dropdownContainer);
}
function logSearchEngineState() {
  const defaultEngine = localStorage.getItem('selectedSearchEngine');
  const activeTab = document.querySelector('.tab.active');
  const currentEngine = activeTab ? activeTab.getAttribute('data-engine') : null;

  console.log('[State] Default engine:', defaultEngine);
  console.log('[State] Current active engine:', currentEngine);
}
// 显示搜索引擎更新提示
function showSearchEngineUpdateTip() {
  // 初始化时隐藏设置提示
  const settingsTip = document.querySelector('.settings-update-tip');
  if (settingsTip) {
    settingsTip.style.display = 'none';
  }

  const searchTipShown = localStorage.getItem('searchEngineUpdateTipShown') === 'true';
  if (searchTipShown) {
    // 如果搜索提示已关闭，则显示设置提示
    showSettingsUpdateTip();
    // 隐藏搜索提示
    const searchTip = document.querySelector('.search-engine-update-tip');
    if (searchTip) {
      searchTip.style.display = 'none';
    }
    return;
  }

  const tipContainer = document.querySelector('.search-engine-update-tip');
  if (tipContainer) {
    tipContainer.style.display = 'block';

    const closeButton = tipContainer.querySelector('.tip-close');
    closeButton.addEventListener('click', function () {
      tipContainer.classList.add('tip-fade-out');
      setTimeout(() => {
        tipContainer.style.display = 'none';
        // 搜索提示关闭后，显示设置提示
        showSettingsUpdateTip();
      }, 300);
      localStorage.setItem('searchEngineUpdateTipShown', 'true');
    });
  }
}

// 显示设置功能更新提示
function showSettingsUpdateTip() {
  const settingsTipShown = localStorage.getItem('settingsUpdateTipShown') === 'true';
  if (settingsTipShown) {
    const tip = document.querySelector('.settings-update-tip');
    if (tip) {
      tip.style.display = 'none';
    }
    return;
  }

  const tipContainer = document.querySelector('.settings-update-tip');
  if (tipContainer) {
    tipContainer.style.display = 'block';

    const closeButton = tipContainer.querySelector('.tip-close');
    closeButton.addEventListener('click', function () {
      tipContainer.classList.add('tip-fade-out');
      setTimeout(() => {
        tipContainer.style.display = 'none';
      }, 300);
      localStorage.setItem('settingsUpdateTipShown', 'true');
    });
  }
}

// 初始化时只调用搜索引擎更新提示
document.addEventListener('DOMContentLoaded', showSearchEngineUpdateTip);

  // 获取版本号并设置
  function setVersionNumber() {
      const versionElement = document.querySelector('.about-version');
      if (versionElement) {
          const manifest = chrome.runtime.getManifest();
          const versionText = chrome.i18n.getMessage('version', [manifest.version]);
          versionElement.textContent = versionText;
      }
  }

  // 在适当时机调用此函数
  document.addEventListener('DOMContentLoaded', setVersionNumber);

  // 获取跟随系统主题的开关元素
  const followSystemThemeCheckbox = document.getElementById('follow-system-theme');

  // 加载设置
  followSystemThemeCheckbox.checked = followSystem;

  // 保存设置
  followSystemThemeCheckbox.addEventListener('change', function() {
    followSystem = this.checked;
    localStorage.setItem('followSystemTheme', followSystem);
    
    // 立即应用新的主题设置
    if (followSystem) {
      updateThemeBasedOnSystem();
    } else {
      // 如果关闭跟随系统，保持当前主题
      const currentTheme = document.documentElement.getAttribute('data-theme');
      document.documentElement.setAttribute('data-theme', currentTheme);
      localStorage.setItem('theme', currentTheme);
      updateThemeIcon(currentTheme === 'dark');
    }
  });



