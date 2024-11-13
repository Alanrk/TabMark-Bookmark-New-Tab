(function () {
  function getSelectedText() {
    return window.getSelection().toString().trim();
  }

  function getSearchQuery() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('q') || urlParams.get('p') || urlParams.get('text') || urlParams.get('wd') || '';
  }

  function fetchBookmarks() {
    return new Promise((resolve, reject) => {
      if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'fetchBookmarks' }, (response) => {
          if (response && response.bookmarks) {
            resolve(response.bookmarks);
          } else {
            reject(new Error(response.error || 'Failed to fetch bookmarks'));
          }
        });
      } else {
        reject(new Error('chrome.runtime.sendMessage is not available'));
      }
    });
  }

  function faviconURL(bookmarkUrl) {
    const url = new URL(chrome.runtime.getURL("/_favicon/"));
    url.searchParams.set("pageUrl", bookmarkUrl);
    url.searchParams.set("size", "32");
    return url.toString();
  }

  function createBookmarkElement(bookmark) {
    const bookmarkElement = document.createElement('li');
    bookmarkElement.className = 'bookmark-item';
    const faviconUrl = faviconURL(bookmark.url);
    bookmarkElement.innerHTML = `
      <a href="${bookmark.url}" target="_blank" class="bookmark-link">
        <img src="${faviconUrl}" alt="favicon" class="bookmark-icon">
        <span class="bookmark-title">${bookmark.title}</span>
      </a>
    `;

    bookmarkElement.addEventListener('click', () => {
      window.open(bookmark.url, '_blank');
    });

    return bookmarkElement;
  }

  function displayBookmarksRecursive(bookmarkNode, container) {
    if (bookmarkNode.children) {
      bookmarkNode.children.forEach((child) => {
        if (child.url) {
          container.appendChild(createBookmarkElement(child));
        } else if (child.children) {
          displayBookmarksRecursive(child, container);
        }
      });
    }
  }

  async function displayBookmarks() {
    try {
      const bookmarks = await fetchBookmarks();
      const bookmarkListContainer = shadow.getElementById('bookmark-list');
      bookmarkListContainer.innerHTML = '';

      let defaultBookmarkId = await getDefaultBookmarkId();
      let defaultBookmarkNode = null;

      if (defaultBookmarkId) {
        defaultBookmarkNode = findBookmarkNodeById(bookmarks[0], defaultBookmarkId);
      }

      if (!defaultBookmarkNode) {
        const parentIdOneBookmarks = findBookmarksByParentId(bookmarks[0], '1');
        const filteredBookmarks = parentIdOneBookmarks.filter(bookmark => bookmark.url);

        if (filteredBookmarks.length > 0) {
          filteredBookmarks.forEach(bookmark => {
            bookmarkListContainer.appendChild(createBookmarkElement(bookmark));
          });
        } else {
          defaultBookmarkNode = bookmarks[0];
          displayBookmarksRecursive(defaultBookmarkNode, bookmarkListContainer);
        }
      } else {
        if (defaultBookmarkNode.url) {
          bookmarkListContainer.appendChild(createBookmarkElement(defaultBookmarkNode));
        } else {
          displayBookmarksRecursive(defaultBookmarkNode, bookmarkListContainer);
        }
      }
    } catch (error) {
      console.error('Failed to fetch bookmarks:', error);
    }
  }

  function findBookmarkNodeById(node, id) {
    if (node.id === id) {
      return node;
    }
    if (node.children) {
      for (let child of node.children) {
        let result = findBookmarkNodeById(child, id);
        if (result) {
          return result;
        }
      }
    }
    return null;
  }

  function findBookmarksByParentId(node, parentId) {
    let result = [];
    if (node.id === parentId) {
      return node.children || [];
    }
    if (node.children) {
      for (let child of node.children) {
        result = result.concat(findBookmarksByParentId(child, parentId));
      }
    }
    return result;
  }

  function getDefaultBookmarkId() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'getDefaultBookmarkId' }, (response) => {
        if (response && response.defaultBookmarkId !== undefined) {
          resolve(response.defaultBookmarkId);
        } else {
          reject(new Error('无法获取默认书签 ID'));
        }
      });
    });
  }

  let cachedSelectedText = "";

  const extensionContainer = document.createElement('div');
  document.body.appendChild(extensionContainer);

  const shadow = extensionContainer.attachShadow({ mode: 'open' });

  const floatingButton = document.createElement('div');
  floatingButton.id = 'floating-button';
  floatingButton.innerHTML = '<img src="' + chrome.runtime.getURL('../images/icon-48.png') + '" alt="icon" class="floating-button-icon">';

  const sidebarContainer = document.createElement('div');
  sidebarContainer.id = 'sidebar-container';
  sidebarContainer.classList.add('collapsed');

  shadow.appendChild(floatingButton);
  shadow.appendChild(sidebarContainer);

  function getCurrentSearchEngine() {
    const hostname = window.location.hostname;
    if (hostname.includes('google.com')) {
      return 'google';
    } else if (hostname.includes('bing.com')) {
      return 'bing';
    } else if (hostname.includes('kimi.moonshot.cn')) {
      return 'kimi';
    } else if (hostname.includes('felo.ai')) {
      return 'felo';
    } else if (hostname.includes('metaso.cn')) {
      return 'metaso';
    } else if (hostname.includes('doubao.com')) {
      return 'doubao';
    } else {
      return 'bing';
    }
  }

  const defaultSearchEngine = getCurrentSearchEngine();

  const searchSwitcher = document.createElement('aside');
  searchSwitcher.id = 'search-switcher';
  searchSwitcher.innerHTML = `
<ul>
  <li data-url="https://www.google.com/search?q=" data-shortcut="1" ${defaultSearchEngine === 'google' ? 'class="selected"' : ''}>
    <img src="${chrome.runtime.getURL('../images/google-logo.svg')}" alt="Google" class="search-icon">
    <span>Google <span class="shortcut-key">Alt+1</span></span>
  </li>
  <li data-url="https://www.bing.com/search?q=" data-shortcut="2" ${defaultSearchEngine === 'bing' ? 'class="selected"' : ''}>
    <img src="${chrome.runtime.getURL('../images/bing-logo.png')}" alt="Bing" class="search-icon">
    <span>Bing <span class="shortcut-key">Alt+2</span></span>
  </li>
  <li data-url="https://kimi.moonshot.cn/?q=" data-shortcut="3" ${defaultSearchEngine === 'kimi' ? 'class="selected"' : ''}>
    <img src="${chrome.runtime.getURL('../images/kimi-logo.svg')}" alt="Kimi" class="search-icon">
    <span>Kimi <span class="shortcut-key">Alt+3</span></span>
  </li>
  <li data-url="https://felo.ai/search?q=" data-shortcut="4" ${defaultSearchEngine === 'felo' ? 'class="selected"' : ''}>
    <img src="${chrome.runtime.getURL('../images/felo-logo.svg')}" alt="Felo" class="search-icon">
    <span>Felo <span class="shortcut-key">Alt+4</span></span>
  </li>
  <li data-url="https://metaso.cn/?q=" data-shortcut="5" ${defaultSearchEngine === 'metaso' ? 'class="selected"' : ''}>
    <img src="${chrome.runtime.getURL('../images/sider-icon/metaso-logo.png')}" alt="Metaso" class="search-icon">
    <span>Metaso <span class="shortcut-key">Alt+5</span></span>
  </li>
  <li data-url="https://www.doubao.com/chat/?q=" data-shortcut="6" ${defaultSearchEngine === 'doubao' ? 'class="selected"' : ''}>
    <img src="${chrome.runtime.getURL('../images/sider-icon/doubao-logo.png')}" alt="Doubao" class="search-icon">
    <span>豆包 <span class="shortcut-key">Alt+6</span></span>
  </li>
  <li data-url="https://chatgpt.com/?q=" data-shortcut="7" ${defaultSearchEngine === 'ChatGPT' ? 'class="selected"' : ''}>
    <img src="${chrome.runtime.getURL('../images/sider-icon/chatgpt-logo.svg')}" alt="ChatGPT" class="search-icon">
    <span>ChatGPT <span class="shortcut-key">Alt+7</span></span>
  </li>
</ul>
<ul id="bookmark-list"></ul>
  `;

  sidebarContainer.appendChild(searchSwitcher);

  floatingButton.addEventListener('mouseenter', () => {
    sidebarContainer.classList.remove('collapsed');
    displayBookmarks();
  });

  sidebarContainer.addEventListener('mouseleave', () => {
    sidebarContainer.classList.add('collapsed');
  });

  function getSearchText() {
    return cachedSelectedText || getSearchQuery() || getSelectedText() || '';
  }

  function openSearch(item) {
    const searchText = getSearchText();
    const baseUrl = item.getAttribute('data-url');
    if (baseUrl) {
      const searchUrl = baseUrl + encodeURIComponent(searchText.trim());
      window.open(searchUrl, '_blank');

      searchSwitcher.querySelectorAll('li').forEach(li => li.classList.remove('selected'));
      item.classList.add('selected');
      localStorage.setItem('selectedSearchEngine', item.textContent.trim().split(' ')[0]);
    }
  }

  function openAllSearches() {
    const searchText = getSearchText();
    if (searchText) {
      searchSwitcher.querySelectorAll('li').forEach(item => {
        const baseUrl = item.getAttribute('data-url');
        if (baseUrl) {
          const searchUrl = baseUrl + encodeURIComponent(searchText.trim());
          window.open(searchUrl, '_blank');
        }
      });
    }
  }

  searchSwitcher.querySelectorAll('li').forEach(item => {
    item.addEventListener('mousedown', () => {
      cachedSelectedText = getSelectedText();
    });

    item.addEventListener('click', (event) => {
      openSearch(event.target.closest('li'));
    });
  });

  window.addEventListener('keydown', (event) => {
    cachedSelectedText = getSelectedText();

    if ((event.altKey && event.key === 'Enter') || (event.metaKey && event.key === 'Enter')) {
      event.preventDefault();
      openAllSearches();
      return;
    }

    if (event.altKey) {
      const code = event.code;

      switch (code) {
        case 'Digit1':
        case 'Digit2':
        case 'Digit3':
        case 'Digit4':
        case 'Digit5':
        case 'Digit6':
        case 'Digit7':
          event.preventDefault();
          const item = searchSwitcher.querySelector(`li[data-shortcut="${code.slice(-1)}"]`);
          if (item) {
            openSearch(item);
          }
          break;
      }
    }
  });

  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = `
    #sidebar-container {
      position: fixed;
      top: 0;
      right: 0;
      width: 240px;
      height: 100vh;
      background-color: #ffffff;
      box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
      transition: transform 0.3s ease;
      transform: translateX(100%);
      z-index: 2147483647;
      padding: 8px;
    }

    #sidebar-container.collapsed {
      transform: translateX(100%);
    }

    #sidebar-container:not(.collapsed) {
      transform: translateX(0);
    }

    #floating-button {
      position: fixed;
      width: 40px;
      height: 40px;
      top: 20%;
      right: 0;
      background-color: #ffffff;
      border-radius: 20px 0 0 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 2147483647;
      font-size: 16px;
      color: #374151;
      user-select: none;
      box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
      display: flex;
      justify-content: center;
      align-items: center;
    }

    img.floating-button-icon {
      width: 24px;
      margin: 0 0 0 4px !important;
    }

    #floating-button:hover {
      background-color: #e2e8f0;
      width: 60px;
    }

    aside {
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      width: 100%;
      background-color: #ffffff;
      overflow: auto;
      padding: 20px 0 0px 0;
    }

    aside ul {
      list-style-type: none;
      padding: 0;
      width: 100%;
      margin: 0;
    }

    aside ul li {
      display: flex;
      position: relative; 
      font-size: 14px;
      font-weight: 600;
      color: #1a202c;
      line-height: 20px;
      padding: 8px 16px;
      margin: 4px 8px !important;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      cursor: pointer;
      border-radius: 8px;
      transition: background-color 0.3s, color 0.3s;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji' !important;
    }

    aside ul li:hover {
      background-color: #f0f0f0;
      margin: 4px 8px;
      color: #4285f4;
    }

    aside ul li.selected {
      background-color: #e2e8f0;
      font-weight: bold;
      color: #4285f4;
    }

    aside ul li.selected span {
      font-weight: bold;
    }

    .search-icon {
      height: 16px;
      margin: 0px 8px 0px 0px;
    }
    .shortcut-key {
      color: #717882;
      font-size: 12px;
      margin-left: 10px;
      position: absolute;
      left: 70%;
    }

    .bookmark-item {
      display: flex;
      align-items: center;
      margin: 4px 8px !important;
      padding: 8px 16px;
      cursor: pointer;
      transition: background-color 0.3s, color 0.3s;
    }

    .bookmark-item:hover {
      background-color: #f0f0f0;
      margin: 4px 8px;
      color: #4285f4;
    }

    .bookmark-item:hover .bookmark-title {
      color: #4285f4 !important;
    }

    .bookmark-icon {
      width: 16px;
      height: 16px;
      margin: 0 8px 0 0 !important;
    }

    .bookmark-link {
      display: flex;
      align-items: center;
      width: 100%;
      text-decoration: none;
      color: inherit;
    }

    .bookmark-title {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-decoration: none !important;
      font-size: 14px;
      font-weight: 600;
      color: #1a202c !important;
      line-height: 20px;
    }

    .bookmark-link:hover {
      text-decoration: none !important;
    }

    #bookmark-list {
      padding: 16px 0 60px 0 !important;
    }

    a.bookmark-link {
      text-decoration: none;
    }

    .hidden {
      display: none !important;
    }
  `;
  shadow.appendChild(styleSheet);

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'loadDefaultBookmark') {
      displayBookmarks();
    }
  });

  displayBookmarks();

  class AutoInputManager {
    constructor(siteConfigs) {
      this.siteConfigs = siteConfigs;
      this.currentConfig = null;
    }

    async sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    async waitForElement(selector) {
      return new Promise((resolve) => {
        if (document.querySelector(selector)) {
          return resolve(document.querySelector(selector));
        }

        const observer = new MutationObserver((mutations) => {
          if (document.querySelector(selector)) {
            observer.disconnect();
            resolve(document.querySelector(selector));
          }
        });

        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      });
    }

    async simulateUserInput(inputField, text, isHTML = false) {
      inputField.innerHTML = '';
      inputField.focus();

      let commandSucceeded = false;
      if (!isHTML) {
        try {
          commandSucceeded = document.execCommand('insertText', false, text);
        } catch (e) { }
      }

      if (!commandSucceeded || isHTML) {
        if (inputField.tagName.toLowerCase() === 'textarea' || inputField.tagName.toLowerCase() === 'input') {
          if (typeof inputField.setSelectionRange === 'function') {
            inputField.setSelectionRange(inputField.value.length, inputField.value.length);
          }
          if (typeof inputField.insertText === 'function' && !isHTML) {
            inputField.insertText(text);
          } else {
            inputField.value = text;
            inputField.dispatchEvent(new Event('input', { bubbles: true }));
          }
        } else {
          if (isHTML) {
            inputField.innerHTML = text;
          } else {
            inputField.textContent = text;
          }

          const eventType = isHTML ? 'innerHTML' : 'insertText';
          inputField.dispatchEvent(new InputEvent('input', {
            inputType: eventType,
            data: text,
            bubbles: true,
            cancelable: true,
          }));
        }
      }

      await this.sleep(this.currentConfig.retryDelay);
      await this.checkAndClick(inputField, text, 0);
    }

    async checkAndClick(inputField, expectedText, retryCount) {
      let inputContent;
      if (inputField.tagName.toLowerCase() === 'textarea' || inputField.tagName.toLowerCase() === 'input') {
        inputContent = inputField.value.trim();
      } else {
        inputContent = inputField.textContent.trim();
      }

      if (inputContent === expectedText) {
        await this.simulateButtonClick();
      } else if (retryCount < this.currentConfig.maxRetries) {
        await this.sleep(this.currentConfig.retryDelay);
        await this.simulateUserInput(inputField, expectedText);
      } else {
        if (inputField.tagName.toLowerCase() === 'textarea' || inputField.tagName.toLowerCase() === 'input') {
          inputField.value = expectedText;
          inputField.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          inputField.textContent = expectedText;
          inputField.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            cancelable: true,
          }));
        }
        await this.sleep(this.currentConfig.retryDelay);
        await this.simulateButtonClick();
      }
    }

    async simulateButtonClick() {
      const sendButton = await this.waitForElement(this.currentConfig.sendButtonSelector);
      if (sendButton) {
        sendButton.click();
      }
    }

    getUrlParameter(name) {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get(name);
    }

    async start() {
      const currentUrl = new URL(window.location.href);

      this.currentConfig = this.siteConfigs.find(config => {
        const patternUrl = new URL(config.urlPattern);
        return this.compareUrls(currentUrl, patternUrl);
      });
      if (!this.currentConfig) {
        return;
      }

      const inputField = await this.waitForElement(this.currentConfig.inputFieldSelector);

      const searchTerm = this.getUrlParameter(this.currentConfig.urlParamName);
      if (searchTerm) {
        await this.sleep(this.currentConfig.retryDelay);
        await this.simulateUserInput(inputField, searchTerm);
      }
    }

    compareUrls(currentUrl, patternUrl) {
      if (currentUrl.protocol !== patternUrl.protocol) return false;
      if (currentUrl.hostname !== patternUrl.hostname) return false;

      const currentPath = currentUrl.pathname.replace(/\/$/, '');
      const patternPath = patternUrl.pathname.replace(/\/$/, '');

      return currentPath === patternPath || currentPath.startsWith(patternPath + '/');
    }
  }

  const siteConfigs = [
    {
      urlPattern: 'https://kimi.moonshot.cn/',
      inputFieldSelector: '[role="textbox"]',
      sendButtonSelector: 'button[data-testid="msh-chatinput-send-button"]',
      urlParamName: 'q',
      maxRetries: 3,
      retryDelay: 1000
    },
    {
      urlPattern: 'https://chatgpt.com/',
      inputFieldSelector: 'textarea[data-id="root"]',
      sendButtonSelector: 'button[data-testid="send_button"]',
      urlParamName: 'q',
      maxRetries: 5,
      retryDelay: 1500
    },
    {
      urlPattern: 'https://www.doubao.com/chat/',
      inputFieldSelector: 'textarea[data-testid="chat_input_input"]',
      sendButtonSelector: 'button[data-testid="chat_input_send_button"]',
      urlParamName: 'q',
      maxRetries: 5,
      retryDelay: 1500
    },
  ];

  const autoInput = new AutoInputManager(siteConfigs);
  autoInput.start();

 

  function log(message) {
    console.log(`[Content Script] ${message}`);
  }




  log('Content script initialized');

  // 替换现有的 updateFloatingBallVisibility 函数
  function updateFloatingBallVisibility(enabled) {
    isFloatingBallEnabled = enabled;
    if (floatingButton) {
      floatingButton.style.display = isFloatingBallEnabled ? 'flex' : 'none';
    }
  }

  // 替换现有的 chrome.storage.sync.get 调用
  chrome.storage.sync.get(['enableFloatingBall'], function(result) {
    updateFloatingBallVisibility(result.enableFloatingBall !== false);
  });

  // 替换现有的消息监听器
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateFloatingBall') {
      updateFloatingBallVisibility(request.enabled);
      sendResponse({success: true});
    }
    return true; // 保持消息通道开放
  });

})();
