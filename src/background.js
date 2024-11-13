// 当扩展安装或更新时触发
chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.tabs.create({ url: "chrome://newtab" });

    // 初始化 defaultBookmarkId
    chrome.storage.local.set({ defaultBookmarkId: null }, function () {
      if (chrome.runtime.lastError) {
        console.error('Error initializing defaultBookmarkId:', chrome.runtime.lastError);
      } else {
        console.log('Initialized defaultBookmarkId to null');
      }
    });
  }
});

// 定义 defaultBookmarkId 变量
let defaultBookmarkId = null;

// 从存储中获取 defaultBookmarkId
function loadDefaultBookmarkId() {
  chrome.storage.local.get(['defaultBookmarkId'], function (result) {
    if (chrome.runtime.lastError) {
      console.error('Error loading defaultBookmarkId from storage:', chrome.runtime.lastError);
    } else {
      defaultBookmarkId = result.defaultBookmarkId || null;
      console.log('Loaded defaultBookmarkId from storage:', defaultBookmarkId);
    }
  });
}

// 初始加载
loadDefaultBookmarkId();

// 监听存储变化
chrome.storage.onChanged.addListener(function (changes, area) {
  if (area === 'local' && changes.defaultBookmarkId) {
    defaultBookmarkId = changes.defaultBookmarkId.newValue;
    console.log('Updated defaultBookmarkId from storage change:', defaultBookmarkId);
  }
});

// 保留这个新的消息监听器，并添加其他操作

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background script received a message:", request);
  switch (request.action) {
    case 'fetchBookmarks':
      chrome.bookmarks.getTree((bookmarkTreeNodes) => {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          sendResponse({ error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ bookmarks: bookmarkTreeNodes });
        }
      });
      return true;  // Indicate that the response will be sent asynchronously

    case 'getDefaultBookmarkId':
      console.log('Sending defaultBookmarkId:', defaultBookmarkId);
      sendResponse({ defaultBookmarkId });
      break;

    case 'setDefaultBookmarkId':
      defaultBookmarkId = request.defaultBookmarkId;
      chrome.storage.local.set({ defaultBookmarkId: defaultBookmarkId }, function () {
        if (chrome.runtime.lastError) {
          console.error('Error setting defaultBookmarkId:', chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          console.log('Updated defaultBookmarkId to:', defaultBookmarkId);
          sendResponse({ success: true });
        }
      });
      return true;  // Indicate that the response will be sent asynchronously

    case 'openInternalPage':
      handleOpenInternalPage(request, sendResponse);
      return true;

    case 'openMultipleTabsAndGroup':
      handleOpenMultipleTabsAndGroup(request, sendResponse);
      return true;

    case 'updateFloatingBallSetting':
      chrome.tabs.query({}, function(tabs) {
        tabs.forEach(function(tab) {
          chrome.tabs.sendMessage(tab.id, {action: 'updateFloatingBall', enabled: request.enabled});
        });
      });
      // 保存设置到 storage
      chrome.storage.sync.set({enableFloatingBall: request.enabled}, function() {
        console.log('Floating ball setting saved:', request.enabled);
      });
      sendResponse({success: true});
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
        if (chrome.runtime.lastError) {
          console.error(`创建标签页失败: ${chrome.runtime.lastError.message}`);
          resolve(); // 继续处理其他标签页
        } else {
          tabIds.push(tab.id);
          resolve();
        }
      });
    });
  });

  Promise.all(createTabPromises).then(() => {
    if (tabIds.length > 1) {
      chrome.tabs.group({ tabIds: tabIds }, function (groupId) {
        if (chrome.runtime.lastError) {
          console.error(`创建标签组失败: ${chrome.runtime.lastError.message}`);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
          return;
        }
        if (chrome.tabGroups) {
          chrome.tabGroups.update(groupId, {
            title: groupName,
            color: 'cyan'
          }, function () {
            if (chrome.runtime.lastError) {
              console.error(`更新标签组名称和颜色失败: ${chrome.runtime.lastError.message}`);
              sendResponse({ success: true, warning: chrome.runtime.lastError.message });
            } else {
              console.log(`标签组名称设置为: ${groupName}，颜色设置为青色`);
              sendResponse({ success: true });
            }
          });
        } else {
          console.error('tabGroups API 不可用');
          sendResponse({ success: true, warning: 'tabGroups API 不可用，无法设置组名和颜色' });
        }
      });
    } else {
      console.log('URL 数量不大于 1，直接打开标签页，不创建标签组');
      sendResponse({ success: true, message: 'URL 数量不大于 1，直接打开标签页，不创建标签组' });
    }
  });
}

function handleOpenInternalPage(request, sendResponse) {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    if (tabs[0]) {
      chrome.tabs.update(tabs[0].id, {url: request.url}, function(tab) {
        if (chrome.runtime.lastError) {
          console.error('Error updating tab:', chrome.runtime.lastError);
          sendResponse({success: false, error: 'Error updating tab: ' + chrome.runtime.lastError.message});
        } else {
          console.log('Successfully opened internal page:', request.url);
          sendResponse({success: true, message: 'Current tab updated'});
        }
      });
    } else {
      console.error('No active tab found');
      sendResponse({success: false, error: 'No active tab found'});
    }
  });
  return true; // 保持消息通道开放
}



