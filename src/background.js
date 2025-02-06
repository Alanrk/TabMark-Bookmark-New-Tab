// 当扩展安装或更新时触发
chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.tabs.create({ url: "chrome://newtab" });
    chrome.storage.local.set({ defaultBookmarkId: null });
    chrome.storage.sync.set({ openInNewTab: true }); // 默认在新标签页打开
  }
});

// 定义 defaultBookmarkId 变量
let defaultBookmarkId = null;

// 从存储中获取 defaultBookmarkId
function loadDefaultBookmarkId() {
  chrome.storage.local.get(['defaultBookmarkId'], function (result) {
    if (chrome.runtime.lastError) {
      console.error('Error loading defaultBookmarkId:', chrome.runtime.lastError);
      return;
    }
    defaultBookmarkId = result?.defaultBookmarkId ?? null;
  });
}

// 初始加载
loadDefaultBookmarkId();

// 监听存储变化
chrome.storage.onChanged.addListener(function (changes, area) {
  if (area === 'local' && changes.defaultBookmarkId) {
    defaultBookmarkId = changes.defaultBookmarkId.newValue;
  }
});

// 修改防重复机制
const openingTabs = new Set();
const DEBOUNCE_TIME = 1000;

function createTab(url, options = {}) {
  return new Promise((resolve, reject) => {
    // 检查是否正在打开相同的 URL
    if (openingTabs.has(url)) {
      console.log('Preventing duplicate tab open for URL:', url);
      reject(new Error('Duplicate request'));
      return;
    }

    // 添加到正在打开的集合中
    openingTabs.add(url);

    // 创建新标签页
    chrome.tabs.create({ 
      url: url,
      active: true,
      ...options
    }, (tab) => {
      if (chrome.runtime.lastError) {
        openingTabs.delete(url); // 发生错误时立即移除
        reject(chrome.runtime.lastError);
      } else {
        resolve(tab);
      }

      // 设置延时移除URL
      setTimeout(() => {
        openingTabs.delete(url);
      }, DEBOUNCE_TIME);
    });
  });
}

// 合并所有消息监听逻辑到一个监听器中
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message in background:', request);
  
  switch (request.action) {
    case 'fetchBookmarks':
      chrome.bookmarks.getTree(async (bookmarkTreeNodes) => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: chrome.runtime.lastError.message });
        } else {
          try {
            const folders = await new Promise((resolve) => {
              chrome.bookmarks.getTree((tree) => {
                resolve(tree);
              });
            });
            
            const processedBookmarks = [];
            
            function processBookmarkNode(node) {
              if (node.url) {
                processedBookmarks.push(node);
              }
              if (node.children) {
                node.children.forEach(processBookmarkNode);
              }
            }
            
            folders.forEach(folder => {
              processBookmarkNode(folder);
            });
            
            sendResponse({ 
              bookmarks: bookmarkTreeNodes,
              processedBookmarks: processedBookmarks,
              success: true 
            });
          } catch (error) {
            sendResponse({ error: error.message });
          }
        }
      });
      return true;

    case 'getDefaultBookmarkId':
      sendResponse({ defaultBookmarkId });
      break;

    case 'setDefaultBookmarkId':
      defaultBookmarkId = request.defaultBookmarkId;
      chrome.storage.local.set({ defaultBookmarkId: defaultBookmarkId }, function () {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true });
        }
      });
      return true;

    case 'openMultipleTabsAndGroup':
      handleOpenMultipleTabsAndGroup(request, sendResponse);
      return true;

    case 'updateFloatingBallSetting':
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          try {
            chrome.tabs.sendMessage(tab.id, {
              action: 'updateFloatingBall',
              enabled: request.enabled
            });
          } catch (error) {
            console.error('Error sending message to tab:', error);
          }
        });
      });
      chrome.storage.sync.set({ enableFloatingBall: request.enabled });
      sendResponse({ success: true });
      return true;

    case 'openSidePanel':
      // 获取当前窗口和标签页
      chrome.windows.getCurrent({}, function(window) {
        chrome.sidePanel.open({
          windowId: window.id
        }).then(() => {
          sendResponse({ success: true });
        }).catch((error) => {
          sendResponse({ success: false, error: error.message });
        });
      });
      return true;

    case 'reloadExtension':
      chrome.runtime.reload();
      return true;

    case 'openInSidePanel':
      if (openingTabs.has(request.url)) {
        console.log('URL is already being opened:', request.url);
        sendResponse({ success: false, error: 'URL is already being opened' });
        return true;
      }

      // 添加到正在打开的集合中
      openingTabs.add(request.url);

      chrome.tabs.create({ 
        url: request.url,
        active: true 
      }, (tab) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to create tab:', chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          console.log('Successfully created new tab:', tab);
          sendResponse({ success: true, tabId: tab.id });
        }

        // 设置延时移除URL
        setTimeout(() => {
          openingTabs.delete(request.url);
        }, DEBOUNCE_TIME);
      });
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown action' });
      return false;
  }
});

function handleOpenMultipleTabsAndGroup(request, sendResponse) {
  const { urls, groupName } = request;
  const tabIds = [];

  const createTabPromises = urls.map(url => {
    return new Promise((resolve) => {
      chrome.tabs.create({ url: url, active: false }, function (tab) {
        if (!chrome.runtime.lastError) {
          tabIds.push(tab.id);
        }
        resolve();
      });
    });
  });

  Promise.all(createTabPromises).then(() => {
    if (tabIds.length > 1) {
      chrome.tabs.group({ tabIds: tabIds }, function (groupId) {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        if (chrome.tabGroups) {
          chrome.tabGroups.update(groupId, {
            title: groupName,
            color: 'cyan'
          }, function () {
            if (chrome.runtime.lastError) {
              sendResponse({ success: true, warning: chrome.runtime.lastError.message });
            } else {
              sendResponse({ success: true });
            }
          });
        } else {
          sendResponse({ success: true, warning: 'tabGroups API 不可用，无法设置组名和颜色' });
        }
      });
    } else {
      sendResponse({ success: true, message: 'URL 数量不大于 1，直接打开标签页，不创建标签组' });
    }
  });
}

// 修改快捷键监听器
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "_execute_side_panel") {
    try {
      // 获取当前窗口
      const window = await chrome.windows.getCurrent();
      
      // 打开侧边栏
      await chrome.sidePanel.open({
        windowId: window.id
      });
    } catch (error) {
      console.error('Failed to open side panel:', error);
      
      // 如果失败，尝试延迟重试
      setTimeout(async () => {
        try {
          const window = await chrome.windows.getCurrent();
          await chrome.sidePanel.open({
            windowId: window.id
          });
        } catch (retryError) {
          console.error('Retry failed:', retryError);
        }
      }, 500);
    }
  }
});

// 在 background.js 顶部添加这些变量
let lastOpenedUrl = '';
let lastOpenTime = 0;

