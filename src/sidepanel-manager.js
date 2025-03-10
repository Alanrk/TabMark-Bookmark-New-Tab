// 定义全局SidePanelManager类
class SidePanelManager {
  constructor() {
    this.history = [];
    this.currentIndex = -1;
    this.isNavigating = false;
    
    this.init();
  }

  init() {
    if (!this.isSidePanel()) return;
    
    // 不再在初始化时直接添加导航栏
    // this.addNavigationBar();
    
    // 初始化事件监听
    this.initEventListeners();
    
    // 监听来自内容脚本的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === "navigateBack") {
        this.navigateBack();
        sendResponse({ success: true });
      } else if (message.action === "navigateForward") {
        this.navigateForward();
        sendResponse({ success: true });
      } else if (message.action === "navigateHome") {
        this.navigateHome();
        sendResponse({ success: true });
      } else if (message.action === "getCurrentHistory") {
        sendResponse({ 
          history: this.history,
          currentIndex: this.currentIndex
        });
      }
      return true; // 保持消息通道开放以进行异步响应
    });
  }

  // 判断当前是否在侧边栏模式
  isSidePanel() {
    return window.location.pathname.endsWith('sidepanel.html');
  }

  addNavigationBar() {
    // 检查是否已存在导航栏，避免重复添加
    if (document.querySelector('.side-panel-nav')) return;
    
    const navBar = document.createElement('div');
    navBar.className = 'side-panel-nav';
    navBar.innerHTML = `
      <div class="nav-controls">
        <button id="back-btn" disabled>
          <span class="material-icons">arrow_back</span>
        </button>
        <button id="forward-btn" disabled>
          <span class="material-icons">arrow_forward</span>
        </button>
        <button id="refresh-btn">
          <span class="material-icons">refresh</span>
        </button>
        <button id="open-in-tab-btn">
          <span class="material-icons">open_in_new</span>
        </button>
      </div>
      <div class="url-container">
        <input type="text" id="url-input" class="url-input">
      </div>
      <div class="toggle-compact-btn">
        <span class="material-icons">expand_more</span>
      </div>
    `;
    
    document.body.insertBefore(navBar, document.body.firstChild);
    
    // 初始化导航按钮事件
    document.getElementById('back-btn').addEventListener('click', () => this.goBack());
    document.getElementById('forward-btn').addEventListener('click', () => this.goForward());
    document.getElementById('refresh-btn').addEventListener('click', () => this.refresh());
    document.getElementById('open-in-tab-btn').addEventListener('click', () => this.openInNewTab());
    
    // URL 输入框事件
    const urlInput = document.getElementById('url-input');
    urlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.loadUrl(urlInput.value);
      }
    });
    
    // 添加紧凑模式切换事件
    const toggleCompact = document.querySelector('.toggle-compact-btn');
    if (toggleCompact) {
      toggleCompact.addEventListener('click', () => {
        navBar.classList.toggle('compact-mode');
        document.body.classList.toggle('nav-compact-mode');
        // 切换图标方向
        const icon = toggleCompact.querySelector('.material-icons');
        icon.textContent = navBar.classList.contains('compact-mode') ? 'expand_less' : 'expand_more';
        
        // 保存用户偏好
        chrome.storage.local.set({
          'sidepanel_nav_compact_mode': navBar.classList.contains('compact-mode')
        });
      });
    }
    
    // 从存储中恢复用户的紧凑模式偏好
    chrome.storage.local.get(['sidepanel_nav_compact_mode'], (result) => {
      if (result.sidepanel_nav_compact_mode) {
        navBar.classList.add('compact-mode');
        document.body.classList.add('nav-compact-mode');
        // 更新图标
        const icon = toggleCompact.querySelector('.material-icons');
        if (icon) icon.textContent = 'expand_less';
      }
    });
  }

  initEventListeners() {
    // 监听消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === "updateUrl") {
        this.updateUrlBar(message.url);
        this.addToHistory(message.url);
      }
    });
    
    // 添加对window message事件的监听，处理来自iframe的消息
    window.addEventListener('message', (event) => {
      console.log('[SidePanelManager] Received message from iframe:', event.data);
      
      if (!event.data || typeof event.data !== 'object') return;
      
      const { action } = event.data;
      
      switch (action) {
        case 'navigateBack':
          console.log('[SidePanelManager] Processing navigateBack from iframe');
          this.navigateBack();
          break;
          
        case 'navigateForward':
          console.log('[SidePanelManager] Processing navigateForward from iframe');
          this.navigateForward();
          break;
          
        case 'navigateHome':
          console.log('[SidePanelManager] Processing navigateHome from iframe');
          this.navigateHome();
          break;
          
        case 'openInNewTab':
          console.log('[SidePanelManager] Processing openInNewTab from iframe');
          this.openInNewTab();
          break;
          
        case 'navigateToUrl':
          console.log('[SidePanelManager] Processing navigateToUrl from iframe:', event.data.url);
          // 使用loadUrl方法加载URL并更新历史记录
          this.loadUrl(event.data.url);
          break;
          
        case 'updateHistory':
          console.log('[SidePanelManager] Processing updateHistory from iframe:', event.data.url);
          // 更新历史记录但不重新加载页面
          this.addToHistory(event.data.url);
          this.updateUrlBar(event.data.url);
          break;
      }
    });
  }

  // 使用chrome.sidePanel.setOptions API加载URL
  loadUrl(url) {
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    
    // 显示加载动画
    this.showLoadingSpinner();
    
    // 添加标记参数，表明这是在侧边栏中打开的页面
    if (!url.includes('sidepanel_view=')) {
      url = url + (url.includes('?') ? '&' : '?') + 'sidepanel_view=true';
    }
    
    console.log('[SidePanelManager] Loading URL with setOptions:', url);
    
    // 使用消息传递给背景脚本处理
    chrome.runtime.sendMessage({ 
      action: 'openUrlInSidePanel', 
      url: url 
    }, (response) => {
      if (response && response.success) {
        console.log('[SidePanelManager] Successfully opened URL in side panel');
        // 在成功加载后隐藏加载动画
        setTimeout(() => this.hideLoadingSpinner(), 500);
      } else {
        console.error('[SidePanelManager] Error opening URL in side panel:', response ? response.error : 'Unknown error');
        // 出错时回退到iframe方式
        this.loadUrlWithIframe(url);
      }
    });
  }
  
  // 保留原来的iframe方式作为备选
  loadUrlWithIframe(url) {
    console.log('[SidePanelManager] Falling back to iframe mode for URL:', url);
    
    // 显示加载动画
    this.showLoadingSpinner();
    
    // 确保URL包含标记参数
    if (!url.includes('sidepanel_view=')) {
      url = url + (url.includes('?') ? '&' : '?') + 'sidepanel_view=true';
    }
    
    // 添加导航栏，只在加载内容时添加
    this.addNavigationBar();
    
    // 查找或创建侧边栏内容容器
    let sidePanelContent = document.getElementById('side-panel-content');
    let sidePanelIframe = document.getElementById('side-panel-iframe');
    
    if (!sidePanelContent) {
      console.log('[SidePanelManager] Creating side panel content container');
      sidePanelContent = document.createElement('div');
      sidePanelContent.id = 'side-panel-content';
      sidePanelContent.className = 'side-panel-content';
      document.body.appendChild(sidePanelContent);
    }
    
    if (!sidePanelIframe) {
      console.log('[SidePanelManager] Creating side panel iframe');
      sidePanelIframe = document.createElement('iframe');
      sidePanelIframe.id = 'side-panel-iframe';
      sidePanelIframe.className = 'side-panel-iframe';
      sidePanelContent.appendChild(sidePanelIframe);
    }
    
    // 显示侧边栏内容
    sidePanelContent.style.display = 'block';
    
    // 设置iframe的src
    sidePanelIframe.src = url;
    
    // 为每次加载注册一次性load事件，确保在已有iframe时也能发送历史数据
    const loadHandler = () => {
      this.hideLoadingSpinner();
      
      // 向iframe发送历史记录数据，用于更新导航栏状态
      try {
        sidePanelIframe.contentWindow.postMessage({
          action: 'injectNavBarInIframe',
          history: this.history,
          currentIndex: this.currentIndex,
          url: url
        }, '*');
      } catch (e) {
        console.error('[SidePanelManager] Error sending history data to iframe on load:', e);
      }
      
      // 移除事件监听器，避免重复
      sidePanelIframe.removeEventListener('load', loadHandler);
    };
    
    sidePanelIframe.addEventListener('load', loadHandler);
    
    // 添加返回按钮
    this.addBackButton();
    
    // 更新URL显示和历史记录
    this.updateUrlBar(url);
  }
  
  // 显示加载动画
  showLoadingSpinner(position = 'top-right') {
    let loadingIndicator = document.getElementById('side-panel-loading-indicator');
    
    // 如果加载指示器不存在，创建一个
    if (!loadingIndicator) {
      loadingIndicator = document.createElement('div');
      loadingIndicator.id = 'side-panel-loading-indicator';
      loadingIndicator.className = 'loading-indicator';
      
      // 创建简洁的加载动画
      const spinner = document.createElement('div');
      spinner.className = 'loading-spinner';
      loadingIndicator.appendChild(spinner);
      
      document.body.appendChild(loadingIndicator);
    }
    
    // 清除所有可能的位置类
    loadingIndicator.classList.remove('center', 'top-center', 'bottom-right', 'nav-adjacent');
    
    // 添加所请求的位置类 (如果不是默认的top-right位置)
    if (position !== 'top-right') {
      loadingIndicator.classList.add(position);
    }
    
    // 显示加载指示器
    loadingIndicator.style.display = 'block';
  }
  
  // 隐藏加载动画
  hideLoadingSpinner() {
    const loadingIndicator = document.getElementById('side-panel-loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }
  }
  
  // 导航回书签列表主页
  navigateHome() {
    console.log('[SidePanelManager] Navigating to home page');
    
    // 使用Chrome侧边栏API返回到侧边栏主页
    chrome.sidePanel.setOptions({
      enabled: true,
      path: 'src/sidepanel.html'
    }).then(() => {
      console.log('[SidePanelManager] Successfully navigated to home page');
    }).catch(error => {
      console.error('[SidePanelManager] Error navigating to home page:', error);
    });
  }
  
  // 导航到历史记录中的上一个URL
  navigateBack() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      const previousUrl = this.history[this.currentIndex];
      console.log('[SidePanelManager] Navigating back to:', previousUrl);
      
      // 标记为导航中，避免重复添加历史记录
      this.isNavigating = true;
      
      // 使用Chrome侧边栏API导航到上一个URL
      chrome.sidePanel.setOptions({
        path: previousUrl
      }).then(() => {
        console.log('[SidePanelManager] Successfully navigated back');
        
        // 更新存储中的历史状态
        chrome.storage.local.set({
          sidePanelNavData: {
            history: this.history,
            currentIndex: this.currentIndex
          }
        });
        
        // 向iframe发送消息更新导航栏状态
        const iframe = document.getElementById('side-panel-iframe');
        if (iframe && iframe.contentWindow) {
          try {
            iframe.contentWindow.postMessage({
              action: 'injectNavBarInIframe',
              history: this.history,
              currentIndex: this.currentIndex,
              url: previousUrl
            }, '*');
          } catch (e) {
            console.error('[SidePanelManager] Error sending message to iframe:', e);
          }
        }
      }).catch(error => {
        console.error('[SidePanelManager] Error navigating back:', error);
        this.isNavigating = false;
      });
    } else {
      console.log('[SidePanelManager] Cannot navigate back, already at oldest history entry');
    }
  }
  
  // 导航到历史记录中的下一个URL
  navigateForward() {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      const nextUrl = this.history[this.currentIndex];
      console.log('[SidePanelManager] Navigating forward to:', nextUrl);
      
      // 标记为导航中，避免重复添加历史记录
      this.isNavigating = true;
      
      // 使用Chrome侧边栏API导航到下一个URL
      chrome.sidePanel.setOptions({
        path: nextUrl
      }).then(() => {
        console.log('[SidePanelManager] Successfully navigated forward');
        
        // 更新存储中的历史状态
        chrome.storage.local.set({
          sidePanelNavData: {
            history: this.history,
            currentIndex: this.currentIndex
          }
        });
        
        // 向iframe发送消息更新导航栏状态
        const iframe = document.getElementById('side-panel-iframe');
        if (iframe && iframe.contentWindow) {
          try {
            iframe.contentWindow.postMessage({
              action: 'injectNavBarInIframe',
              history: this.history,
              currentIndex: this.currentIndex,
              url: nextUrl
            }, '*');
          } catch (e) {
            console.error('[SidePanelManager] Error sending message to iframe:', e);
          }
        }
      }).catch(error => {
        console.error('[SidePanelManager] Error navigating forward:', error);
        this.isNavigating = false;
      });
    } else {
      console.log('[SidePanelManager] Cannot navigate forward, already at newest history entry');
    }
  }

  // 添加返回按钮
  addBackButton() {
    let backButton = document.querySelector('.back-to-links');
    
    if (!backButton) {
      backButton = document.createElement('div');
      backButton.className = 'back-to-links';
      backButton.innerHTML = '<span class="material-icons">arrow_back</span>';
      document.body.appendChild(backButton);
      
      // 添加点击事件
      backButton.addEventListener('click', () => {
        this.closeIframe();
      });
    }
    
    // 显示返回按钮
    backButton.style.display = 'flex';
  }
  
  // 关闭iframe
  closeIframe() {
    const sidePanelContent = document.getElementById('side-panel-content');
    const backButton = document.querySelector('.back-to-links');
    const navBar = document.querySelector('.side-panel-nav');
    
    if (sidePanelContent) {
      sidePanelContent.style.display = 'none';
    }
    
    if (backButton) {
      backButton.style.display = 'none';
    }
    
    // 同时移除导航栏
    if (navBar) {
      navBar.remove();
    }
  }

  goBack() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.loadUrl(this.history[this.currentIndex]);
      this.updateNavigationButtons();
    }
  }

  goForward() {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      this.loadUrl(this.history[this.currentIndex]);
      this.updateNavigationButtons();
    }
  }

  refresh() {
    if (this.currentIndex >= 0) {
      this.loadUrl(this.history[this.currentIndex]);
    }
  }

  openInNewTab() {
    if (this.currentIndex >= 0) {
      chrome.tabs.create({ url: this.history[this.currentIndex] });
    }
  }

  addToHistory(url) {
    if (this.isNavigating) {
      this.isNavigating = false;
      return;
    }
    
    this.currentIndex++;
    this.history = this.history.slice(0, this.currentIndex);
    this.history.push(url);
    this.updateNavigationButtons();
    
    // 将历史记录保存到本地存储，供iframe中的导航栏使用
    chrome.storage.local.set({
      sidePanelNavData: {
        history: this.history,
        currentIndex: this.currentIndex
      }
    });
    
    // 如果有iframe，向iframe发送消息更新导航栏状态
    const iframe = document.getElementById('side-panel-iframe');
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage({
          action: 'injectNavBarInIframe',
          history: this.history,
          currentIndex: this.currentIndex,
          url: url
        }, '*');
      } catch (e) {
        console.error('[SidePanelManager] Error sending message to iframe:', e);
      }
    }
  }

  updateNavigationButtons() {
    // 更新主界面的按钮状态
    const backBtn = document.getElementById('back-btn');
    const forwardBtn = document.getElementById('forward-btn');
    
    if (backBtn) backBtn.disabled = this.currentIndex <= 0;
    if (forwardBtn) forwardBtn.disabled = this.currentIndex >= this.history.length - 1;
    
    // 将历史记录状态保存到本地存储
    chrome.storage.local.set({
      sidePanelNavData: {
        history: this.history,
        currentIndex: this.currentIndex
      }
    }, () => {
      console.log('[SidePanelManager] Saved navigation state to storage:', 
                  {history: this.history, currentIndex: this.currentIndex});
    });
    
    // 更新iframe中的导航按钮状态
    const iframe = document.getElementById('side-panel-iframe');
    if (iframe && iframe.contentWindow) {
      try {
        iframe.contentWindow.postMessage({
          action: 'injectNavBarInIframe',
          history: this.history,
          currentIndex: this.currentIndex,
          url: this.history[this.currentIndex] || document.getElementById('url-input')?.value
        }, '*');
      } catch (e) {
        console.error('[SidePanelManager] Error sending navigation update to iframe:', e);
      }
    }
  }

  updateUrlBar(url) {
    document.getElementById('url-input').value = url;
  }
}

// 创建全局实例
window.addEventListener('DOMContentLoaded', () => {
  // 创建全局实例
  window.sidePanelManager = new SidePanelManager();
  
  // 将SidePanelManager类暴露到全局作用域
  window.SidePanelManager = SidePanelManager;
}); 