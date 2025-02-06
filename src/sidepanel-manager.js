class SidePanelManager {
  constructor() {
    this.history = [];
    this.currentIndex = -1;
    this.isNavigating = false;
    
    this.init();
  }

  init() {
    if (!isSidePanel()) return;
    
    // 添加导航栏
    this.addNavigationBar();
    // 初始化事件监听
    this.initEventListeners();
  }

  addNavigationBar() {
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
    `;
    
    document.body.insertBefore(navBar, document.body.firstChild);
  }

  initEventListeners() {
    // 导航按钮事件
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

    // 监听消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === "updateUrl") {
        this.updateUrlBar(message.url);
        this.addToHistory(message.url);
      }
    });
  }

  loadUrl(url) {
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    
    // 创建 iframe 来加载内容
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      const iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.className = 'sidepanel-content';
      
      // 清空现有内容
      mainContent.innerHTML = '';
      mainContent.appendChild(iframe);
      
      // 更新 URL 显示和历史记录
      this.updateUrlBar(url);
      this.addToHistory(url);
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
  }

  updateNavigationButtons() {
    document.getElementById('back-btn').disabled = this.currentIndex <= 0;
    document.getElementById('forward-btn').disabled = this.currentIndex >= this.history.length - 1;
  }

  updateUrlBar(url) {
    document.getElementById('url-input').value = url;
  }
} 