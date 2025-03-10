// 当扩展安装或更新时触发
chrome.runtime.onInstalled.addListener((details) => {
  console.log("Extension installed or updated:", details.reason);
  
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.tabs.create({ url: "chrome://newtab" });
    chrome.storage.local.set({ defaultBookmarkId: null });
    chrome.storage.sync.set({ 
      openInNewTab: true, // 默认在新标签页打开
      sidepanelOpenInNewTab: true, // 默认在新标签页打开
      sidepanelOpenInSidepanel: false // 默认不在侧边栏内打开
    });
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
  
  // 注册侧边栏导航内容脚本
  registerSidePanelNavigationScript();
});

// 注册侧边栏导航内容脚本
function registerSidePanelNavigationScript() {
  // 我们不再使用 chrome.scripting.registerContentScripts
  // 因为在 manifest.json 中已经静态注册了内容脚本
  console.log('Using static content script registration from manifest.json');
  // 不需要动态注册，因为在 manifest.json 中已经有这个内容脚本:
  // {
  //   "matches": ["<all_urls>"],
  //   "js": ["src/sidepanel-navigation.js"],
  //   "run_at": "document_end"
  // }
}

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
  
  // 处理侧边栏导航消息
  if (request.action === 'navigateHome') {
    const homePath = 'src/sidepanel.html';
    
    // 返回到侧边栏主页
    chrome.sidePanel.setOptions({
      path: homePath
    }).then(() => {
      console.log('Successfully navigated to sidepanel home');
      
      // 获取当前的历史记录状态
      chrome.storage.local.get(['sidePanelHistory', 'sidePanelCurrentIndex'], (result) => {
        let history = result.sidePanelHistory || [];
        let currentIndex = result.sidePanelCurrentIndex || -1;
        
        console.log('Current history before home navigation:', {
          historyLength: history.length,
          currentIndex: currentIndex,
          history: history.length > 0 ? history.map(u => u.substring(0, 30) + '...') : []
        });
        
        // 如果历史记录为空，初始化它
        if (history.length === 0) {
          history = [homePath];
          currentIndex = 0;
          console.log('Home: Initialized empty history');
        } else {
          // 正常导航情况
          // 如果在历史记录中间导航，需要截断历史记录
          if (currentIndex < history.length - 1) {
            history = history.slice(0, currentIndex + 1);
            console.log('Home: Truncated forward history from', history.length, 'to', currentIndex + 1);
          }
          
          // 检查历史记录中最后一个条目是否已经是主页
          if (history[history.length - 1] !== homePath) {
            // 添加主页到历史记录末尾
            currentIndex++;
            history.push(homePath);
            console.log('Home: Added home page to history at index', currentIndex);
          } else {
            console.log('Home: Last entry is already the home page, not adding duplicate');
          }
        }
        
        // 更新历史记录
        chrome.storage.local.set({
          sidePanelHistory: history,
          sidePanelCurrentIndex: currentIndex
        }, () => {
          console.log('Updated history state for home navigation:', {
            historyLength: history.length,
            currentIndex: currentIndex,
            history: history.map(u => u.substring(0, 30) + '...'),
            canGoBack: currentIndex > 0,
            canGoForward: currentIndex < history.length - 1
          });
          
          // 通知内容脚本更新导航状态
          if (sender.tab && sender.tab.id) {
            try {
              chrome.tabs.sendMessage(sender.tab.id, {
                action: 'updateNavigationState',
                canGoBack: currentIndex > 0,
                canGoForward: currentIndex < history.length - 1,
                url: homePath,
                historyLength: history.length,
                currentIndex: currentIndex
              });
            } catch (error) {
              console.error('Error sending message to tab:', error);
            }
          }
          
          sendResponse({ 
            success: true,
            canGoBack: currentIndex > 0,
            canGoForward: currentIndex < history.length - 1
          });
        });
      });
    }).catch(error => {
      console.error('Error navigating to sidepanel home:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // 保持消息通道开放以进行异步响应
  }
  
  if (request.action === 'navigateBack' || request.action === 'navigateForward') {
    // 获取历史记录状态
    chrome.storage.local.get(['sidePanelHistory', 'sidePanelCurrentIndex'], (result) => {
      if (!result.sidePanelHistory || result.sidePanelCurrentIndex === undefined) {
        console.error('No history state found for navigation');
        sendResponse({ success: false, error: 'No history state found' });
        return;
      }
      
      const history = result.sidePanelHistory;
      let currentIndex = result.sidePanelCurrentIndex;
      
      console.log('Current navigation state before operation:', {
        action: request.action,
        historyLength: history.length,
        currentIndex: currentIndex,
        canGoBack: currentIndex > 0,
        canGoForward: currentIndex < history.length - 1,
        history: history.map(u => u.substring(0, 30) + '...')
      });
      
      // 根据导航方向更新索引
      if (request.action === 'navigateBack' && currentIndex > 0) {
        currentIndex--;
      } else if (request.action === 'navigateForward' && currentIndex < history.length - 1) {
        currentIndex++;
      } else {
        console.log('Cannot navigate in requested direction');
        sendResponse({ 
          success: false, 
          error: 'Cannot navigate in requested direction',
          canGoBack: currentIndex > 0,
          canGoForward: currentIndex < history.length - 1,
          currentIndex: currentIndex,
          historyLength: history.length
        });
        return;
      }
      
      const targetUrl = history[currentIndex];
      console.log(`Navigating ${request.action === 'navigateBack' ? 'back' : 'forward'} to:`, targetUrl, 'Index:', currentIndex);
      
      // 更新存储中的当前索引
      chrome.storage.local.set({ sidePanelCurrentIndex: currentIndex }, () => {
        // 更新侧边栏URL
        chrome.sidePanel.setOptions({
          path: targetUrl
        }).then(() => {
          console.log('Successfully navigated to:', targetUrl);
          console.log('Updated navigation state:', {
            historyLength: history.length,
            currentIndex: currentIndex,
            canGoBack: currentIndex > 0,
            canGoForward: currentIndex < history.length - 1
          });
          
          // 通知内容脚本更新导航状态
          if (sender.tab && sender.tab.id) {
            try {
              chrome.tabs.sendMessage(sender.tab.id, {
                action: 'updateNavigationState',
                canGoBack: currentIndex > 0,
                canGoForward: currentIndex < history.length - 1,
                url: targetUrl,
                historyLength: history.length,
                currentIndex: currentIndex
              });
            } catch (err) {
              console.log('Error sending message to tab:', err);
            }
          }
          
          sendResponse({ 
            success: true,
            currentIndex: currentIndex,
            canGoBack: currentIndex > 0,
            canGoForward: currentIndex < history.length - 1,
            url: targetUrl,
            historyLength: history.length
          });
        }).catch(error => {
          console.error('Error navigating:', error);
          sendResponse({ success: false, error: error.message });
        });
      });
    });
    
    return true; // 保持消息通道开放以进行异步响应
  }
  
  // 处理获取导航状态的请求
  if (request.action === 'getNavigationState') {
    // 获取历史记录状态
    chrome.storage.local.get(['sidePanelHistory', 'sidePanelCurrentIndex'], (result) => {
      if (!result.sidePanelHistory || result.sidePanelCurrentIndex === undefined) {
        console.log('No history state found for navigation status check, initializing empty state');
        // 初始化历史记录
        const initialHistory = ['src/sidepanel.html'];
        const initialIndex = 0;
        
        chrome.storage.local.set({
          sidePanelHistory: initialHistory,
          sidePanelCurrentIndex: initialIndex
        }, () => {
          sendResponse({ 
            success: true, 
            canGoBack: false,
            canGoForward: false,
            initialized: true,
            historyLength: 1,
            currentIndex: 0
          });
        });
        return;
      }
      
      const history = result.sidePanelHistory;
      const currentIndex = result.sidePanelCurrentIndex;
      const url = request.url || (history[currentIndex] || '');
      const canGoBack = currentIndex > 0;
      const canGoForward = currentIndex < history.length - 1;
      
      console.log('Navigation state requested:', {
        historyLength: history.length,
        currentIndex: currentIndex,
        canGoBack: canGoBack,
        canGoForward: canGoForward,
        history: history.map(u => u.substring(0, 30) + '...')
      });
      
      // 通知内容脚本更新导航状态
      if (sender.tab && sender.tab.id) {
        try {
          chrome.tabs.sendMessage(sender.tab.id, {
            action: 'updateNavigationState',
            canGoBack: canGoBack,
            canGoForward: canGoForward,
            url: url,
            historyLength: history.length,
            currentIndex: currentIndex
          }).catch(error => {
            console.log('Failed to send updateNavigationState message:', error);
          });
        } catch (err) {
          console.error('Error sending message to tab:', err);
        }
      }
      
      sendResponse({ 
        success: true,
        currentIndex: currentIndex,
        canGoBack: canGoBack,
        canGoForward: canGoForward,
        url: url,
        historyLength: history.length
      });
    });
    
    return true; // 保持消息通道开放以进行异步响应
  }
  
  // 处理侧边栏内部链接点击并记录到历史
  if (request.action === 'recordAndNavigate') {
    const url = request.url;
    console.log('Recording and navigating to URL in side panel:', url);
    
    // 获取当前历史记录状态
    chrome.storage.local.get(['sidePanelHistory', 'sidePanelCurrentIndex'], (result) => {
      let history = result.sidePanelHistory || [];
      let currentIndex = result.sidePanelCurrentIndex || -1;
      
      // 记录当前状态用于调试
      console.log('Before update - History state:', {
        historyLength: history.length,
        currentIndex: currentIndex,
        history: history.length > 0 ? history.map(u => u.substring(0, 30) + '...') : []
      });
      
      // 处理初始情况
      if (history.length === 0) {
        // 如果历史记录为空，先添加一个主页记录
        history.push('src/sidepanel.html');
        currentIndex = 0;
        console.log('Initialized empty history with homepage');
      }
      
      // 计算新的索引位置
      if (currentIndex < history.length - 1) {
        // 如果在历史记录中间导航，则需要截断历史记录
        currentIndex++;
        console.log(`Navigating from middle of history: Increasing currentIndex to ${currentIndex} and truncating`);
        history = history.slice(0, currentIndex);
      } else {
        // 正常添加到历史记录末尾
        currentIndex++;
        console.log(`Adding to end of history: new currentIndex = ${currentIndex}`);
      }
      
      // 添加新URL到历史记录
      history.push(url);
      
      console.log('Updated history state:', {
        historyLength: history.length,
        currentIndex: currentIndex,
        history: history.map(u => u.substring(0, 30) + '...') // 日志中只显示URL的前30个字符
      });
      
      // 更新存储中的历史记录状态
      chrome.storage.local.set({
        sidePanelHistory: history,
        sidePanelCurrentIndex: currentIndex
      }, () => {
        // 重新获取存储的状态，确保它已正确更新
        chrome.storage.local.get(['sidePanelHistory', 'sidePanelCurrentIndex'], (verifyResult) => {
          console.log('Verified storage update:', {
            historyLength: verifyResult.sidePanelHistory.length,
            currentIndex: verifyResult.sidePanelCurrentIndex,
            history: verifyResult.sidePanelHistory.map(u => u.substring(0, 30) + '...')
          });
          
          // 使用Chrome侧边栏API更新URL
          chrome.sidePanel.setOptions({
            path: url
          }).then(() => {
            console.log('Successfully navigated to intercepted link:', url);
            console.log('Current history after navigation:', {
              historyLength: history.length,
              currentIndex: currentIndex,
              canGoBack: currentIndex > 0,
              canGoForward: currentIndex < history.length - 1
            });
            
            // 通知内容脚本更新导航状态
            if (sender.tab && sender.tab.id) {
              try {
                chrome.tabs.sendMessage(sender.tab.id, {
                  action: 'updateNavigationState',
                  canGoBack: currentIndex > 0,
                  canGoForward: currentIndex < history.length - 1,
                  url: url,
                  historyLength: history.length,
                  currentIndex: currentIndex
                });
              } catch (error) {
                console.error('Error sending message to tab:', error);
              }
            }
            
            sendResponse({ 
              success: true,
              currentIndex: currentIndex,
              canGoBack: currentIndex > 0,
              canGoForward: currentIndex < history.length - 1,
              historyLength: history.length
            });
          }).catch(error => {
            console.error('Error navigating to intercepted link:', error);
            sendResponse({ success: false, error: error.message });
          });
        });
      });
    });
    
    return true; // 保持消息通道开放以进行异步响应
  }
  
  // 处理从侧边栏打开URL的请求
  if (request.action === 'openUrlInSidePanel') {
    const url = request.url;
    console.log('Opening URL in side panel:', url);
    
    // 检查是否需要更新历史记录
    if (request.updateHistory !== false) {
      // 获取当前历史记录状态
      chrome.storage.local.get(['sidePanelHistory', 'sidePanelCurrentIndex'], (result) => {
        let history = result.sidePanelHistory || [];
        let currentIndex = result.sidePanelCurrentIndex || -1;
        
        // 记录当前状态用于调试
        console.log('Before update (direct URL) - History state:', {
          historyLength: history.length,
          currentIndex: currentIndex,
          history: history.length > 0 ? history.map(u => u.substring(0, 30) + '...') : []
        });
        
        // 处理初始情况
        if (history.length === 0) {
          // 如果历史记录为空，添加主页作为第一个条目
          history.push('src/sidepanel.html');
          currentIndex = 0;
          console.log('Direct URL: Initialized empty history with homepage');
        }
        
        // 计算新的索引位置
        if (currentIndex < history.length - 1) {
          // 如果在历史记录中间导航，则需要截断历史记录
          currentIndex++;
          console.log(`Direct URL: Navigating from middle of history: Increasing currentIndex to ${currentIndex} and truncating`);
          history = history.slice(0, currentIndex);
        } else {
          // 正常添加到历史记录末尾
          currentIndex++;
          console.log(`Direct URL: Adding to end of history: new currentIndex = ${currentIndex}`);
        }
        
        // 添加新URL到历史记录
        history.push(url);
        
        console.log('Updated history state for direct URL open:', {
          historyLength: history.length,
          currentIndex: currentIndex,
          history: history.map(u => u.substring(0, 30) + '...') // 日志中只显示URL的前30个字符
        });
        
        // 更新存储中的历史记录状态
        chrome.storage.local.set({
          sidePanelHistory: history,
          sidePanelCurrentIndex: currentIndex
        }, () => {
          // 重新获取存储的状态，确保它已正确更新
          chrome.storage.local.get(['sidePanelHistory', 'sidePanelCurrentIndex'], (verifyResult) => {
            console.log('Verified direct URL storage update:', {
              historyLength: verifyResult.sidePanelHistory.length,
              currentIndex: verifyResult.sidePanelCurrentIndex,
              history: verifyResult.sidePanelHistory.map(u => u.substring(0, 30) + '...')
            });
            
            // 使用Chrome侧边栏API更新URL
            navigateToUrl(url, sender, sendResponse, request.isNavigating);
          });
        });
      });
    } else {
      // 不更新历史记录，直接导航
      navigateToUrl(url, sender, sendResponse, request.isNavigating);
    }
    
    return true; // 保持消息通道开放以进行异步响应
  }
  
  // 辅助函数：使用Chrome侧边栏API导航到URL
  function navigateToUrl(url, sender, sendResponse, isNavigating = false) {
    console.log('Navigating to URL in side panel:', url, 'Is navigating:', isNavigating);
    
    // 向当前标签发送消息，表明即将在侧边栏打开页面
    if (!isNavigating) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs.length > 0) {
          try {
            // Add check for tab existence and catch the error
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'sidepanelNavigation',
              isSidePanel: true,
              url: url,
              phase: 'before_navigation'
            }, (response) => {
              // Handle potential errors with chrome.runtime.lastError
              if (chrome.runtime.lastError) {
                console.log('Message sending failed (expected): ', chrome.runtime.lastError.message);
                // We can still proceed as this error is often expected
              } else {
                console.log('发送侧边栏预加载标记成功:', response);
              }
            });
          } catch (e) {
            console.error('发送侧边栏预加载标记失败:', e);
            // Continue with navigation even if message fails
          }
        }
      });
    }
    
    // 确保URL包含sidepanel_view标记，除非是侧边栏主页
    if (!url.includes('sidepanel.html') && !url.includes('sidepanel_view=')) {
      url = url + (url.includes('?') ? '&' : '?') + 'sidepanel_view=true';
      console.log('Added sidepanel_view parameter to URL:', url);
    }
    
    // 首先将状态保存到Chrome存储中
    chrome.storage.session.set({ 
      'sidepanel_view': true,
      'sidepanel_last_url': url,
      'sidepanel_timestamp': Date.now()
    }, () => {
      console.log('已保存侧边栏状态到chrome.storage.session');
    });
    
    chrome.sidePanel.setOptions({
      path: url
    }).then(() => {
      console.log('Successfully opened URL in side panel:', url);
      
      // 获取最新的历史状态以更新导航按钮
      chrome.storage.local.get(['sidePanelHistory', 'sidePanelCurrentIndex'], (result) => {
        if (result.sidePanelHistory && result.sidePanelCurrentIndex !== undefined) {
          const history = result.sidePanelHistory;
          const currentIndex = result.sidePanelCurrentIndex;
          
          console.log('Current history state after navigation:', {
            historyLength: history.length,
            currentIndex: currentIndex,
            canGoBack: currentIndex > 0,
            canGoForward: currentIndex < history.length - 1,
            history: history.map(u => u.substring(0, 30) + '...')
          });
          
          // 通知内容脚本更新导航状态 - 添加错误处理
          if (sender && sender.tab && sender.tab.id) {
            try {
              chrome.tabs.sendMessage(sender.tab.id, {
                action: 'updateNavigationState',
                canGoBack: currentIndex > 0,
                canGoForward: currentIndex < history.length - 1
              }, (response) => {
                // Handle potential errors with chrome.runtime.lastError
                if (chrome.runtime.lastError) {
                  console.log('Navigation state update failed (expected): ', chrome.runtime.lastError.message);
                  // This is often expected, as content scripts may not be ready
                }
              });
            } catch (e) {
              console.error('Error sending navigation update:', e);
            }
          }
          
          // 在页面加载后向其发送侧边栏状态标记 
          setTimeout(() => {
            // 获取当前侧边栏打开的标签页
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
              if (tabs && tabs.length > 0) {
                try {
                  // 尝试多次发送消息以确保接收 - 添加错误处理
                  for (let i = 0; i < 3; i++) {
                    setTimeout(() => {
                      chrome.tabs.sendMessage(tabs[0].id, {
                        action: 'sidepanelNavigation',
                        isSidePanel: true,
                        url: url,
                        phase: 'after_navigation',
                        attempt: i + 1
                      }, (response) => {
                        // Handle potential errors with chrome.runtime.lastError
                        if (chrome.runtime.lastError) {
                          console.log(`发送侧边栏标记失败 (尝试 ${i+1}): `, chrome.runtime.lastError.message);
                        } else {
                          console.log(`发送侧边栏标记成功 (尝试 ${i+1}):`, response);
                        }
                      });
                    }, i * 1000); // 分散发送时间
                  }
                } catch (e) {
                  console.error('发送侧边栏标记失败:', e);
                }
              }
            });
          }, 1500); // 更长的延迟以确保页面已加载
        }
        
        if (sendResponse) {
          sendResponse({ success: true });
        }
      });
    }).catch((error) => {
      console.error('Error opening URL in side panel:', error);
      if (sendResponse) {
        sendResponse({ success: false, error: error.toString() });
      }
    });
  }
  
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
      toggleSidePanel();
      sendResponse({ success: true });
      return true;
      
    case 'updateSidePanelHistory':
      // 处理来自侧边栏内部导航的历史更新请求
      console.log('Handling updateSidePanelHistory:', request.url, 'source:', request.source);
      
      // 获取当前历史记录状态
      chrome.storage.local.get(['sidePanelHistory', 'sidePanelCurrentIndex'], (result) => {
        let history = result.sidePanelHistory || [];
        let currentIndex = result.sidePanelCurrentIndex || -1;
        
        // 记录当前状态用于调试
        console.log('Before in-page navigation update - History state:', {
          historyLength: history.length,
          currentIndex: currentIndex,
          history: history.length > 0 ? history.map(u => u.substring(0, 30) + '...') : []
        });
        
        // 处理初始情况
        if (history.length === 0) {
          // 如果历史记录为空，添加主页作为第一个条目
          history.push('src/sidepanel.html');
          currentIndex = 0;
        }
        
        // 计算新的索引位置
        if (currentIndex < history.length - 1) {
          // 如果在历史记录中间导航，则需要截断历史记录
          currentIndex++;
          history = history.slice(0, currentIndex);
        } else {
          // 正常添加到历史记录末尾
          currentIndex++;
        }
        
        // 添加新URL到历史记录
        history.push(request.url);
        
        // 计算可以前进和后退的能力
        const canGoBack = currentIndex > 0;
        const canGoForward = currentIndex < history.length - 1;
        
        console.log('Updated history state for in-page navigation:', {
          historyLength: history.length,
          currentIndex: currentIndex,
          canGoBack: canGoBack,
          canGoForward: canGoForward,
          history: history.map(u => u.substring(0, 30) + '...') 
        });
        
        // 更新存储中的历史记录状态
        chrome.storage.local.set({
          sidePanelHistory: history,
          sidePanelCurrentIndex: currentIndex
        }, () => {
          // 向当前活动标签页发送更新消息，而不是所有标签页
          chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs && tabs.length > 0) {
              // 使用sendMessage的回调函数处理错误，而不是使用try-catch
              chrome.tabs.sendMessage(
                tabs[0].id, 
                {
                  action: 'updateNavigationState',
                  canGoBack: canGoBack,
                  canGoForward: canGoForward,
                  url: request.url,
                  historyLength: history.length,
                  currentIndex: currentIndex
                },
                (response) => {
                  if (chrome.runtime.lastError) {
                    // 记录错误但不抛出异常
                    console.log('Message delivery failed (expected for new tabs):', chrome.runtime.lastError.message);
                  } else if (response) {
                    console.log('Navigation state update delivered successfully');
                  }
                }
              );
            }
          });
          
          if (sendResponse) {
            sendResponse({
              success: true,
              canGoBack: canGoBack,
              canGoForward: canGoForward
            });
          }
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

// 修改打开侧边栏的代码
function toggleSidePanel() {
  // 获取当前标签页
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      console.error("No active tabs found");
      return;
    }

    const tabId = tabs[0].id;

    // 如果侧边栏已经打开，则关闭它
    if (sidePanelState.isOpen) {
      chrome.sidePanel.setOptions({
        enabled: false
      });
      sidePanelState.isOpen = false;
      console.log("Side panel closed");
      return;
    }

    // 尝试打开侧边栏
    chrome.sidePanel.setOptions({
      enabled: true,
      path: 'src/sidepanel.html'
    });
    
    // 打开侧边栏
    chrome.sidePanel.open({
      tabId: tabId
    }).then(() => {
      console.log("Side panel opened successfully");
      sidePanelState.isOpen = true;
      
      // 将侧边栏状态保存到storage中，使其在不同页面间共享
      chrome.storage.session.set({ 'sidepanel_active': true }, () => {
        if (chrome.runtime.lastError) {
          console.error('保存侧边栏状态出错:', chrome.runtime.lastError);
        } else {
          console.log('侧边栏状态已保存到session storage');
        }
      });
      
      // 设置延迟，等待侧边栏加载完成后发送消息
      setTimeout(() => {
        try {
          chrome.tabs.sendMessage(tabId, {
            action: 'sidepanelNavigation',
            isSidePanel: true
          }, (response) => {
            // Handle potential errors with chrome.runtime.lastError
            if (chrome.runtime.lastError) {
              console.log('侧边栏打开标记发送失败 (expected):', chrome.runtime.lastError.message);
              // This error is expected if content script is not ready, we can ignore it
            } else {
              console.log('侧边栏打开标记发送成功:', response);
            }
          });
        } catch (e) {
          console.error('发送侧边栏打开标记失败:', e);
          // Continue even if message fails - this doesn't affect functionality
        }
      }, 1000);
    }).catch((error) => {
      console.error("Failed to open side panel:", error);
    });
  });
}

// 修改命令监听器使用切换功能
chrome.commands.onCommand.addListener((command) => {
  console.log(`Command received: ${command}`);
  
  if (command === "open_side_panel") {
    console.log("Toggling side panel with shortcut");
    toggleSidePanel();
  }
});

// 添加扩展图标点击事件处理
chrome.action.onClicked.addListener((tab) => {
  console.log("Extension icon clicked");
  // 点击扩展图标时切换侧边栏
  toggleSidePanel();
});

// 在 background.js 顶部添加这些变量
let lastOpenedUrl = '';
let lastOpenTime = 0;

