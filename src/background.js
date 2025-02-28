// 当扩展安装或更新时触发
chrome.runtime.onInstalled.addListener((details) => {
  console.log("Extension installed or updated:", details.reason);
  
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.tabs.create({ url: "chrome://newtab" });
    chrome.storage.local.set({ defaultBookmarkId: null });
    chrome.storage.sync.set({ openInNewTab: true }); // 默认在新标签页打开
  }

  // 检查命令是否正确注册
  chrome.commands.getAll((commands) => {
    console.log("Registered commands:", commands);
    
    // 查找侧边栏命令
    const sidePanelCommand = commands.find(cmd => cmd.name === "open_side_panel");
    if (sidePanelCommand) {
      console.log("Side panel command registered with shortcut:", sidePanelCommand.shortcut);
    } else {
      console.warn("Side panel command not found! Available commands:", commands.map(cmd => cmd.name).join(", "));
      
      // 检查是否有其他可能的侧边栏命令
      const alternativeCommand = commands.find(cmd => 
        cmd.name === "_execute_action_with_ui" || 
        cmd.name.includes("side") || 
        cmd.name.includes("panel")
      );
      
      if (alternativeCommand) {
        console.log("Found alternative command that might be for side panel:", alternativeCommand);
      }
    }
  });
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
      openSidePanel();
      sendResponse({ success: true });
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

    case 'updateBookmarkDisplay':
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          try {
            chrome.tabs.sendMessage(tab.id, {
              action: 'updateBookmarkDisplay',
              folderId: request.folderId
            });
          } catch (error) {
            console.error('Error sending message to tab:', error);
          }
        });
      });
      sendResponse({ success: true });
      return true;

    case 'getBookmarkFolder':
      chrome.bookmarks.get(request.folderId, (folder) => {
        if (chrome.runtime.lastError) {
          sendResponse({ 
            success: false, 
            error: chrome.runtime.lastError.message 
          });
          return;
        }
        
        // 如果是文件夹，获取其子项
        if (!folder[0].url) {
          chrome.bookmarks.getChildren(request.folderId, (children) => {
            if (chrome.runtime.lastError) {
              sendResponse({ 
                success: true, 
                folder: folder[0],
                error: chrome.runtime.lastError.message 
              });
            } else {
              sendResponse({ 
                success: true, 
                folder: folder[0],
                children: children 
              });
            }
          });
          return true; // 保持消息通道开放以进行异步响应
        } else {
          // 如果是书签，直接返回
          sendResponse({ 
            success: true, 
            folder: folder[0] 
          });
        }
      });
      return true; // 保持消息通道开放以进行异步响应

    case 'checkSidePanelStatus':
      sendResponse({ isOpen: sidePanelState.isOpen });
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

// 在打开和关闭侧边栏时更新状态
let sidePanelState = { isOpen: false };

// 修改打开侧边栏的代码，移除定时器逻辑
function openSidePanel() {
  try {
    // 首先获取当前活动标签页
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs && tabs.length > 0) {
        const tabId = tabs[0].id;
        
        // 使用获取到的 tabId 打开侧边栏
        chrome.sidePanel.open({ tabId: tabId }).then(() => {
          console.log("Side panel opened successfully with tabId:", tabId);
          sidePanelState.isOpen = true;
          // 移除了定时器逻辑
        }).catch((error) => {
          console.error("Failed to open side panel with tabId:", error);
          
          // 尝试使用 windowId
          chrome.windows.getCurrent(function(window) {
            if (window) {
              chrome.sidePanel.open({ windowId: window.id }).then(() => {
                console.log("Side panel opened successfully with windowId:", window.id);
                sidePanelState.isOpen = true;
                // 移除了定时器逻辑
              }).catch((windowError) => {
                console.error("Failed to open side panel with windowId:", windowError);
              });
            }
          });
        });
      } else {
        console.error("No active tabs found");
      }
    });
  } catch (error) {
    console.error("Error opening side panel:", error);
  }
}

// 修改命令监听器使用自定义命令
chrome.commands.onCommand.addListener((command) => {
  console.log(`Command received: ${command}`);
  
  if (command === "open_side_panel") {
    console.log("Attempting to open side panel with custom shortcut");
    openSidePanel(); // 使用上面修改过的函数
  }
});

// 添加扩展图标点击事件处理
chrome.action.onClicked.addListener((tab) => {
  console.log("Extension icon clicked");
  // 这里可以自定义点击扩展图标时的行为
  // 例如，打开选项页面或执行其他操作
});

// 在 background.js 顶部添加这些变量
let lastOpenedUrl = '';
let lastOpenTime = 0;

