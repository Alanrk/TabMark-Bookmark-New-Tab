// 当扩展安装或更新时触发
chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.tabs.create({ url: "chrome://newtab" });
    chrome.storage.local.set({ defaultBookmarkId: null });
  }
});

// 定义 defaultBookmarkId 变量
let defaultBookmarkId = null;

// 从存储中获取 defaultBookmarkId
function loadDefaultBookmarkId() {
  chrome.storage.local.get(['defaultBookmarkId'], function (result) {
    defaultBookmarkId = result.defaultBookmarkId || null;
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

// 保留这个新的消息监听器，并添加其他操作

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
      // 向所有标签页发送更新消息
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
      // 保存设置
      chrome.storage.sync.set({ enableFloatingBall: request.enabled });
      sendResponse({ success: true });
      return true;

    case 'reloadExtension':
      chrome.runtime.reload();
      return true;

    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }

  return false; // 对于同步响应的情况
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



