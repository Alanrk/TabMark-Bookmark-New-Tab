// 导航处理脚本 - 用于处理iframe中的导航栏

// 保存当前URL，用于检测导航变化
let currentUrl = window.location.href;

// 当文档加载完成时检测是否是侧边栏iframe
document.addEventListener('DOMContentLoaded', function() {
  // 检查URL参数是否包含侧边栏标记
  const urlParams = new URLSearchParams(window.location.search);
  const isSidePanel = urlParams.get('is_sidepanel') === 'true' || 
                      urlParams.get('sidepanel_view') === 'true';
  
  console.log('[Navigation Handler] Page loaded, is side panel:', isSidePanel);
  
  // 检查是否在iframe中
  const isInIframe = window !== window.top;
  
  // 如果是在侧边栏iframe中
  if (isSidePanel && isInIframe) {
    console.log('[Navigation Handler] This page is loaded in a side panel iframe');
    
    // 获取存储的导航数据
    chrome.storage.local.get('sidePanelNavData', function(data) {
      if (data && data.sidePanelNavData) {
        const { history, currentIndex } = data.sidePanelNavData;
        injectNavBarInIframe(history, currentIndex, window.location.href);
      } else {
        // 如果没有找到数据，使用默认值
        injectNavBarInIframe([], 0, window.location.href);
      }
    });
    
    // 添加键盘快捷键监听
    document.addEventListener('keydown', function(e) {
      // Alt+Home 或 Alt+H 键回到主页
      if ((e.altKey && e.key === 'Home') || (e.altKey && e.key === 'h')) {
        e.preventDefault();
        console.log('[Navigation Handler] Keyboard shortcut for home detected');
        
        // 直接调用Chrome API返回主页
        try {
          chrome.runtime.sendMessage({ 
            action: 'navigateHome',
            source: 'keyboard-shortcut',
            timestamp: Date.now()
          });
        } catch(err) {
          console.error('[Navigation Handler] Failed to trigger home navigation via keyboard:', err);
        }
      }
      // Alt+Left箭头 - 后退
      if (e.altKey && e.key === 'ArrowLeft') {
        window.parent.postMessage({ action: 'navigateBack' }, '*');
      }
      // Alt+Right箭头 - 前进
      else if (e.altKey && e.key === 'ArrowRight') {
        window.parent.postMessage({ action: 'navigateForward' }, '*');
      }
    });
    
    // 监听页面内的链接点击
    document.addEventListener('click', function(e) {
      // 查找是否点击的是链接
      let linkElement = e.target;
      while (linkElement && linkElement.tagName !== 'A') {
        linkElement = linkElement.parentElement;
      }
      
      // 如果点击的是链接
      if (linkElement && linkElement.tagName === 'A') {
        const href = linkElement.getAttribute('href');
        if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
          // 记录点击链接的事件，用于后续通知父窗口更新历史记录
          console.log('[Navigation Handler] Link clicked:', href);
          
          // 对于相对路径，转换为绝对路径
          const absoluteUrl = new URL(href, window.location.href).href;
          
          // 如果是新窗口或新标签页打开，仍然让浏览器处理
          if (linkElement.target === '_blank' || e.ctrlKey || e.metaKey) {
            return;
          }
          
          // 否则拦截点击，通知父窗口进行导航
          e.preventDefault();
          
          // 添加sidepanel_view参数
          const urlObj = new URL(absoluteUrl);
          urlObj.searchParams.set('sidepanel_view', 'true');
          const urlWithParam = urlObj.toString();
          
          // 通知父窗口更新历史记录并导航
          window.parent.postMessage({
            action: 'navigateToUrl',
            url: urlWithParam
          }, '*');
          
          // 直接在当前窗口导航
          window.location.href = urlWithParam;
        }
      }
    });
    
    // 监听URL变化 (SPA应用和pushState变化)
    let lastUrl = window.location.href;
    // 创建监听器检查URL变化
    const urlChangeChecker = setInterval(() => {
      if (lastUrl !== window.location.href) {
        console.log('[Navigation Handler] URL changed from:', lastUrl, 'to:', window.location.href);
        // 通知父窗口更新历史记录
        window.parent.postMessage({
          action: 'updateHistory',
          url: window.location.href
        }, '*');
        lastUrl = window.location.href;
      }
    }, 500);
    
    // 页面卸载时清除检查器
    window.addEventListener('unload', () => {
      clearInterval(urlChangeChecker);
    });
  } else {
    console.log('[Navigation Handler] Not in side panel iframe, not injecting navigation bar');
  }
});

// 监听postMessage消息
window.addEventListener('message', function(event) {
  console.log('[Navigation Handler] Received message:', event.data);
  
  if (!event.data || typeof event.data !== 'object') return;
  
  const { action } = event.data;
  
  // 如果是导航操作，转发到父窗口
  if (action === 'navigateHome' || action === 'navigateBack' || action === 'navigateForward') {
    if (window !== window.top) {
      // 在iframe中，发送消息到父窗口
      window.parent.postMessage(event.data, '*');
    }
  } else if (action === 'injectNavBarInIframe') {
    // 接收来自sidepanel-manager.js的消息，在iframe中注入导航栏
    const { history, currentIndex, url } = event.data;
    injectNavBarInIframe(history, currentIndex, url);
  }
});

// 在iframe中注入导航栏
function injectNavBarInIframe(history, currentIndex, url) {
  console.log('[Navigation Handler] Injecting navigation bar in iframe');
  
  // 检查是否已经存在导航栏
  if (document.querySelector('.iframe-sidepanel-nav-bar') || 
      document.querySelector('.sidepanel-nav-bar') || 
      document.querySelector('.simple-nav-bar')) {
    console.log('[Navigation Handler] Navigation bar already exists');
    return;
  }
  
  // 创建样式
  const style = document.createElement('style');
  style.textContent = `
    .iframe-sidepanel-nav-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 40px;
      background-color: #f8f9fa;
      border-bottom: 1px solid #dee2e6;
      display: flex;
      align-items: center;
      padding: 0 10px;
      z-index: 9999;
      font-family: Arial, sans-serif;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .iframe-sidepanel-nav-bar button {
      background: none;
      border: none;
      cursor: pointer;
      padding: 5px 8px;
      margin-right: 5px;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #555;
    }
    
    .iframe-sidepanel-nav-bar button span {
      font-size: 14px;
      margin-left: 4px;
    }
    
    .iframe-sidepanel-nav-bar button:hover {
      background-color: #e9ecef;
    }
    
    .iframe-sidepanel-nav-bar button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .iframe-sidepanel-nav-bar .url-display {
      flex-grow: 1;
      margin: 0 10px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 12px;
      color: #666;
    }
    
    body {
      margin-top: 40px !important;
      padding-top: 10px;
    }
    
    @media (prefers-color-scheme: dark) {
      .iframe-sidepanel-nav-bar {
        background-color: #292a2d;
        border-bottom-color: #3c4043;
        color: #e8eaed;
      }
      
      .iframe-sidepanel-nav-bar button {
        color: #e8eaed;
      }
      
      .iframe-sidepanel-nav-bar button:hover {
        background-color: #3c4043;
      }
      
      .iframe-sidepanel-nav-bar .url-display {
        color: #e8eaed;
      }
    }
  `;
  
  // 创建导航栏
  const navBar = document.createElement('div');
  navBar.className = 'iframe-sidepanel-nav-bar';
  
  // 添加返回主页按钮
  const homeButton = document.createElement('button');
  homeButton.id = 'iframe-home-button'; // 添加ID便于选择
  homeButton.title = '返回书签列表'; // 添加title属性用于选择器匹配
  homeButton.innerHTML = '<span>返回书签列表</span>';
  
  // 直接使用Chrome API实现导航回主页
  const navigateToHome = () => {
    console.log('[Navigation Handler] Executing direct home navigation');
    
    // 尝试多种方法返回主页
    let succeeded = false;
    
    // 1. 尝试直接设置URL
    try {
      console.log('[Navigation Handler] Attempting direct URL navigation');
      // 获取扩展根URL
      const extensionUrl = chrome.runtime.getURL('src/sidepanel.html');
      
      // 由于iframe中可能受到限制，通知父窗口执行导航
      window.parent.postMessage({ 
        action: 'directNavigate',
        url: extensionUrl 
      }, '*');
      
      // 也尝试自己导航（可能会被阻止）
      try {
        window.top.location.href = extensionUrl;
        succeeded = true;
      } catch (e) {
        console.log('[Navigation Handler] Could not navigate top window, continuing with other methods');
      }
      
      return true;
    } catch (e) {
      console.error('[Navigation Handler] Direct URL navigation failed:', e);
    }
    
    // 2. 优先使用Chrome API
    if (!succeeded && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        chrome.runtime.sendMessage({ 
          action: 'navigateHome',
          source: 'iframe-direct',
          timestamp: Date.now()
        }, (response) => {
          console.log('[Navigation Handler] Direct home navigation response:', response);
        });
        return true;
      } catch (e) {
        console.error('[Navigation Handler] Chrome API navigation failed:', e);
      }
    }
    
    // 3. 备用方法：通过父窗口通信
    if (!succeeded) {
      try {
        window.parent.postMessage({ 
          action: 'navigateHome',
          source: 'iframe-backup',
          timestamp: Date.now() 
        }, '*');
        console.log('[Navigation Handler] Sent home navigation message to parent');
        return true;
      } catch (e) {
        console.error('[Navigation Handler] Parent window messaging failed:', e);
        return false;
      }
    }
  };
  
  // 添加点击和其他事件
  homeButton.addEventListener('click', (e) => {
    e.preventDefault();
    console.log('[Navigation Handler] Home button clicked in iframe');
    navigateToHome();
  });
  
  // 添加双击事件作为备份
  homeButton.addEventListener('dblclick', (e) => {
    e.preventDefault();
    console.log('[Navigation Handler] Home button double-clicked in iframe');
    navigateToHome();
  });
  
  // 添加前进后退按钮
  const backButton = document.createElement('button');
  backButton.innerHTML = '<span>后退</span>';
  backButton.disabled = !history || currentIndex <= 0;
  backButton.addEventListener('click', () => {
    // 向父窗口发送消息，请求后退
    window.parent.postMessage({ action: 'navigateBack' }, '*');
  });
  
  const forwardButton = document.createElement('button');
  forwardButton.innerHTML = '<span>前进</span>';
  forwardButton.disabled = !history || currentIndex >= history.length - 1;
  forwardButton.addEventListener('click', () => {
    // 向父窗口发送消息，请求前进
    window.parent.postMessage({ action: 'navigateForward' }, '*');
  });
  
  // 添加刷新按钮
  const refreshButton = document.createElement('button');
  refreshButton.innerHTML = '<span>刷新</span>';
  refreshButton.addEventListener('click', () => {
    window.location.reload();
  });
  
  // 添加在新标签页中打开按钮
  const openInTabButton = document.createElement('button');
  openInTabButton.innerHTML = '<span>新标签页</span>';
  openInTabButton.addEventListener('click', () => {
    // 向父窗口发送消息，请求在新标签页中打开
    window.parent.postMessage({ action: 'openInNewTab' }, '*');
  });
  
  // 添加URL显示
  const urlDisplay = document.createElement('div');
  urlDisplay.className = 'url-display';
  urlDisplay.textContent = url || window.location.href.split('?')[0]; // 移除URL参数
  
  // 将元素添加到导航栏
  navBar.appendChild(homeButton);
  navBar.appendChild(backButton);
  navBar.appendChild(forwardButton);
  navBar.appendChild(refreshButton);
  navBar.appendChild(openInTabButton);
  navBar.appendChild(urlDisplay);
  
  // 将样式和导航栏添加到文档
  document.head.appendChild(style);
  document.body.insertBefore(navBar, document.body.firstChild);
  
  console.log('[Navigation Handler] Navigation bar injected successfully');
  
  // 添加导航按钮事件监听
  const iframeHomeButton = document.querySelector('.iframe-sidepanel-nav-bar button[title="返回书签列表"]');
  const iframeBackButton = document.querySelector('.iframe-sidepanel-nav-bar button[title="返回上一页"]');
  const iframeForwardButton = document.querySelector('.iframe-sidepanel-nav-bar button[title="前进到下一页"]');
  
  if (iframeHomeButton) {
    iframeHomeButton.addEventListener('click', () => {
      console.log('[Navigation Handler] Home button clicked in iframe');
      // 发送消息到父窗口
      window.parent.postMessage({ action: 'navigateHome' }, '*');
      // 同时尝试通过chrome API发送
      try {
        chrome.runtime.sendMessage({ action: 'navigateHome' });
      } catch (e) {
        console.log('[Navigation Handler] Failed to send message via chrome API:', e);
      }
    });
  }
  
  if (iframeBackButton) {
    iframeBackButton.addEventListener('click', () => {
      console.log('[Navigation Handler] Back button clicked in iframe');
      window.parent.postMessage({ action: 'navigateBack' }, '*');
      try {
        chrome.runtime.sendMessage({ action: 'navigateBack' });
      } catch (e) {
        console.log('[Navigation Handler] Failed to send message via chrome API:', e);
      }
    });
  }
  
  if (iframeForwardButton) {
    iframeForwardButton.addEventListener('click', () => {
      console.log('[Navigation Handler] Forward button clicked in iframe');
      window.parent.postMessage({ action: 'navigateForward' }, '*');
      try {
        chrome.runtime.sendMessage({ action: 'navigateForward' });
      } catch (e) {
        console.log('[Navigation Handler] Failed to send message via chrome API:', e);
      }
    });
  }
} 