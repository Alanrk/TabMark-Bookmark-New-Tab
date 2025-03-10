// 侧边栏导航脚本
(function() {
  console.log('[SidePanel Navigation] 脚本开始加载');
  
  // 检查Chrome API是否可用
  const isChromeExtension = typeof chrome !== 'undefined' && 
                            typeof chrome.runtime !== 'undefined' && 
                            typeof chrome.storage !== 'undefined';
  
  // 检查当前页面是否是侧边栏页面
  const isSidePanelPage = window.location.pathname.endsWith('sidepanel.html');
  
  // 检查URL参数中是否包含侧边栏标记
  const urlParams = new URLSearchParams(window.location.search);
  const hasSidePanelParam = urlParams.get('sidepanel_view') === 'true' || urlParams.get('is_sidepanel') === 'true';
  
  // 检查当前页面是否是主页面（newtab）
  const isNewTabPage = window.location.pathname.endsWith('index.html') || 
                      window.location.pathname.endsWith('newtab.html') ||
                      window.location.href.includes('chrome://newtab') ||
                      document.querySelector('#sidebar-container') !== null;
  
  // 只有当URL中包含侧边栏参数时才继续，或者如果这是新标签页/侧边栏主页则不添加导航栏
  if (isSidePanelPage || isNewTabPage || !hasSidePanelParam) {
    console.log('[SidePanel Navigation] Not adding navigation bar: isSidePanelPage=', isSidePanelPage, 
                'isNewTabPage=', isNewTabPage, 'hasSidePanelParam=', hasSidePanelParam);
    return;
  }
  
  // 全局变量用于状态跟踪和调试
  let inSidePanel = false;  // 当前是否在侧边栏中的最终结果
  let detectionMethods = [];  // 检测方法结果跟踪
  let detectionAttempts = 0;  // 检测尝试次数
  let navigationBarAdded = false; // 是否已添加导航栏
  
  // 在页面加载完成后，再次检查是否需要添加导航栏
  window.addEventListener('load', function() {
    // 如果已经添加了导航栏，则不需要再次检查
    if (navigationBarAdded) return;
    
    // 检查URL参数中是否包含侧边栏标记
    const urlParams = new URLSearchParams(window.location.search);
    const hasSidePanelParam = urlParams.get('sidepanel_view') === 'true' || 
                            urlParams.get('is_sidepanel') === 'true';
    
    // 如果URL中包含侧边栏参数，但导航栏还没有添加，则添加导航栏
    if (hasSidePanelParam && !document.querySelector('.sidepanel-nav-bar')) {
      console.log('[SidePanel Navigation] 页面加载完成后检测到侧边栏参数，添加导航栏');
      inSidePanel = true;
      initOrRefreshNavigationBar();
      navigationBarAdded = true;
      
      // 将侧边栏标记添加到body类
      document.body.classList.add('is-sidepanel');
    }
  });
  
  // 添加全局事件监听器 - 这是直接注入脚本发出的信号
  document.addEventListener('sidepanel_loaded', (event) => {
    console.log('[SidePanel Navigation] 接收到自定义事件:', event.detail);
    inSidePanel = true;
    
    if (!navigationBarAdded) {
      initOrRefreshNavigationBar();
      navigationBarAdded = true;
    }
  });
  
  // Chrome消息监听器 - 来自background.js的消息
  if (isChromeExtension) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('[SidePanel Navigation] 收到Chrome消息:', message);
      
      try {
        if (message && message.action === 'sidepanelNavigation' && message.isSidePanel === true) {
          console.log('[SidePanel Navigation] 收到侧边栏标记消息:', message);
          
          // 保存标记到存储以供后续使用
          try {
            sessionStorage.setItem('sidepanel_view', 'true');
            localStorage.setItem('sidepanel_view', 'true');
          } catch (e) {
            console.log('[SidePanel Navigation] 存储标记时出错:', e);
          }
          
          inSidePanel = true;
          
          if (!navigationBarAdded) {
            initOrRefreshNavigationBar();
            navigationBarAdded = true;
          }
          
          // Always send a response to prevent "Receiving end does not exist" errors
          if (sendResponse) {
            sendResponse({ success: true, message: 'Sidepanel navigation message received' });
          }
          return true;
        }
      } catch (e) {
        console.error('[SidePanel Navigation] 处理消息时出错:', e);
        if (sendResponse) {
          sendResponse({ success: false, error: e.message });
        }
        return true;
      }
    });
  }
  
  // 添加全局链接点击事件监听，显示加载指示器
  document.addEventListener('click', function(event) {
    // 查找被点击的链接或其父元素中的链接
    let linkElement = event.target.closest('a');
    
    // 如果点击的是链接并且不是新窗口打开
    if (linkElement && 
        linkElement.href && 
        (!linkElement.target || linkElement.target !== '_blank') && 
        !event.ctrlKey && 
        !event.metaKey) {
      
      // 显示加载指示器
      showLoadingSpinner();
      
      // 添加sidepanel_view参数到链接URL
      try {
        // 解析链接URL
        const linkUrl = new URL(linkElement.href);
        
        // 仅当链接URL不含sidepanel_view参数时添加
        if (!linkUrl.searchParams.has('sidepanel_view')) {
          linkUrl.searchParams.set('sidepanel_view', 'true');
          linkElement.href = linkUrl.toString();
          console.log('[SidePanel Navigation] 添加侧边栏参数到链接:', linkElement.href);
        }
      } catch (e) {
        console.error('[SidePanel Navigation] 修改链接URL时出错:', e);
      }
      
      // 记录内部导航历史
      if (inSidePanel && isChromeExtension) {
        // 截获链接点击，将其添加到导航历史
        try {
          // 获取目标URL (现在已包含sidepanel_view参数)
          const targetUrl = linkElement.href;
          
          // 向后台脚本发送消息，更新导航历史
          chrome.runtime.sendMessage({
            action: 'updateSidePanelHistory',
            url: targetUrl,
            source: 'in_page_navigation'
          }, response => {
            console.log('[SidePanel Navigation] 记录内部导航历史响应:', response);
          });
          
          console.log('[SidePanel Navigation] 记录内部导航到:', targetUrl);
        } catch (e) {
          console.error('[SidePanel Navigation] 记录内部导航时出错:', e);
        }
      }
      
      // 允许默认的链接点击行为继续
    }
  });
  
  // 添加历史记录变化监听
  if (inSidePanel && window.history && window.history.pushState) {
    // 包装原生的history.pushState和replaceState方法
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;
    
    window.history.pushState = function(state, title, url) {
      // 如果提供了URL，确保它包含sidepanel_view参数
      if (url) {
        try {
          const newUrl = new URL(url, window.location.href);
          if (!newUrl.searchParams.has('sidepanel_view')) {
            newUrl.searchParams.set('sidepanel_view', 'true');
            url = newUrl.toString();
            console.log('[SidePanel Navigation] 添加侧边栏参数到pushState URL:', url);
          }
        } catch (e) {
          console.error('[SidePanel Navigation] 修改pushState URL时出错:', e);
        }
      }
      
      // 调用原始方法
      const result = originalPushState.apply(this, arguments.length === 3 ? [state, title, url] : arguments);
      
      // 记录URL变化
      if (isChromeExtension) {
        try {
          chrome.runtime.sendMessage({
            action: 'updateSidePanelHistory',
            url: window.location.href,
            source: 'pushState'
          });
          console.log('[SidePanel Navigation] 记录pushState导航:', window.location.href);
        } catch (e) {
          console.error('[SidePanel Navigation] 记录pushState导航时出错:', e);
        }
      }
      
      return result;
    };
    
    window.history.replaceState = function(state, title, url) {
      // 如果提供了URL，确保它包含sidepanel_view参数
      if (url) {
        try {
          const newUrl = new URL(url, window.location.href);
          if (!newUrl.searchParams.has('sidepanel_view')) {
            newUrl.searchParams.set('sidepanel_view', 'true');
            url = newUrl.toString();
            console.log('[SidePanel Navigation] 添加侧边栏参数到replaceState URL:', url);
          }
        } catch (e) {
          console.error('[SidePanel Navigation] 修改replaceState URL时出错:', e);
        }
      }
      
      // 调用原始方法
      const result = originalReplaceState.apply(this, arguments.length === 3 ? [state, title, url] : arguments);
      
      // 记录URL变化
      if (isChromeExtension) {
        try {
          chrome.runtime.sendMessage({
            action: 'updateSidePanelHistory',
            url: window.location.href,
            source: 'replaceState'
          });
          console.log('[SidePanel Navigation] 记录replaceState导航:', window.location.href);
        } catch (e) {
          console.error('[SidePanel Navigation] 记录replaceState导航时出错:', e);
        }
      }
      
      return result;
    };
    
    // 监听popstate事件（用户点击浏览器的前进或后退按钮）
    window.addEventListener('popstate', function() {
      if (isChromeExtension) {
        try {
          chrome.runtime.sendMessage({
            action: 'updateSidePanelHistory',
            url: window.location.href,
            source: 'popstate'
          });
          console.log('[SidePanel Navigation] 记录popstate导航:', window.location.href);
        } catch (e) {
          console.error('[SidePanel Navigation] 记录popstate导航时出错:', e);
        }
      }
    });
  }
  
  // 显示加载动画
  function showLoadingSpinner(position = 'top-right') {
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
    
    // 在页面离开或5秒后自动隐藏（以防页面加载失败）
    setTimeout(() => {
      if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
      }
    }, 5000);
  }
  
  // 执行多种检测方法并汇总结果
  runDetectionMethods();
  
  // 后备检测 - 每秒检查一次，共检查5次
  const maxBackupChecks = 5;
  for (let i = 0; i < maxBackupChecks; i++) {
    setTimeout(() => {
      if (!navigationBarAdded) {
        console.log(`[SidePanel Navigation] 后备检测 #${i+1}`);
        runDetectionMethods();
      }
    }, (i + 1) * 1000);
  }
  
  // 运行所有检测方法并整合结果
  function runDetectionMethods() {
    detectionAttempts++;
    console.log(`[SidePanel Navigation] 运行检测方法 (尝试 #${detectionAttempts})`);
    
    // 重置检测结果数组
    detectionMethods = [];
    
    // 方法1：使用 chrome.runtime.getContexts API (Chrome 116+)
    if (isChromeExtension && chrome.runtime.getContexts) {
      const apiDetection = new Promise((resolve) => {
        try {
          chrome.runtime.getContexts({
            contextTypes: ["SIDE_PANEL"]
          }, (contexts) => {
            if (chrome.runtime.lastError) {
              console.log('[SidePanel Navigation] API检测错误:', chrome.runtime.lastError);
              resolve(false);
              return;
            }
            
            // 没有上下文或空数组
            if (!contexts || contexts.length === 0) {
              console.log('[SidePanel Navigation] 没有找到侧边栏上下文');
              resolve(false);
              return;
            }
            
            // 获取所有侧边栏上下文的ID
            const sidePanelContextIds = contexts.map(context => context.contextId);
            
            // 检查当前上下文是否是侧边栏
            chrome.runtime.getContextId((currentContext) => {
              if (chrome.runtime.lastError) {
                console.log('[SidePanel Navigation] 获取当前上下文错误:', chrome.runtime.lastError);
                resolve(false);
                return;
              }
              
              if (!currentContext) {
                console.log('[SidePanel Navigation] 无法获取当前上下文');
                resolve(false);
                return;
              }
              
              const isInSidePanel = sidePanelContextIds.includes(currentContext.contextId);
              console.log('[SidePanel Navigation] Chrome API检测结果:', isInSidePanel, {
                sidePanelContextIds,
                currentContextId: currentContext.contextId
              });
              
              // 如果确认在侧边栏中，保存标记以便后续页面使用
              if (isInSidePanel) {
                saveDetectionResult(true);
              }
              
              resolve(isInSidePanel);
            });
          });
        } catch (e) {
          console.log('[SidePanel Navigation] 运行API检测时出错:', e);
          resolve(false);
        }
      });
      
      detectionMethods.push(apiDetection);
    }
    
    // 方法2：传统的URL和存储检测
    const traditionalDetection = new Promise((resolve) => {
      // 检查URL中是否存在标记参数
      const urlParams = new URLSearchParams(window.location.search);
      const isSidePanelView = urlParams.has('sidepanel_view');
      
      // 检查sessionStorage和localStorage中是否存在标记
      let isSidePanelSession = false;
      let isSidePanelLocal = false;
      
      try {
        isSidePanelSession = sessionStorage.getItem('sidepanel_view') === 'true';
      } catch (e) {
        console.log('[SidePanel Navigation] sessionStorage不可用:', e);
      }
      
      try {
        isSidePanelLocal = localStorage.getItem('sidepanel_view') === 'true';
      } catch (e) {
        console.log('[SidePanel Navigation] localStorage不可用:', e);
      }
      
      // 检查chrome.storage.session (更可靠的存储)
      if (isChromeExtension && chrome.storage && chrome.storage.session) {
        chrome.storage.session.get(['sidepanel_view', 'sidepanel_last_url'], (result) => {
          const isSidePanelChromeStorage = result && result.sidepanel_view === true;
          const lastUrl = result && result.sidepanel_last_url;
          
          // 检查最后一个URL与当前URL的相似度
          const urlMatchScore = lastUrl ? calculateUrlSimilarity(lastUrl, window.location.href) : 0;
          console.log('[SidePanel Navigation] URL相似度分数:', urlMatchScore, {
            lastUrl: lastUrl && lastUrl.substring(0, 50) + '...',
            currentUrl: window.location.href.substring(0, 50) + '...'
          });
          
          // 如果URL很相似（分数>0.7），这可能是侧边栏导航的结果
          const isUrlMatch = urlMatchScore > 0.7;
          
          checkTraditionalResults(
            isSidePanelView, 
            isSidePanelSession, 
            isSidePanelLocal, 
            isSidePanelChromeStorage,
            isUrlMatch
          );
        });
      } else {
        checkTraditionalResults(isSidePanelView, isSidePanelSession, isSidePanelLocal, false, false);
      }
      
      function checkTraditionalResults(fromUrl, fromSession, fromLocal, fromChromeStorage, fromUrlMatch) {
        // 检查referrer，看看是否是从侧边栏导航来的
        const referrerIsSidePanel = document.referrer && (
          document.referrer.includes('sidepanel.html') || 
          document.referrer.includes('sidepanel_view=true') || 
          document.referrer.includes('is_sidepanel=true')
        );
        
        // 对比当前URL与引用URL，检测是否为同域内部导航
        const isInternalNavigation = document.referrer && 
          (new URL(document.referrer)).origin === window.location.origin;
        
        // 强制再次检查URL参数
        const urlParams = new URLSearchParams(window.location.search);
        const hasSidePanelParam = urlParams.get('sidepanel_view') === 'true' || 
                                 urlParams.get('is_sidepanel') === 'true';
        
        // 如果是同域内部导航并且引用页是侧边栏，或直接有侧边栏参数，则认为当前页也是侧边栏
        const isDefinitelySidePanel = (isInternalNavigation && referrerIsSidePanel) || hasSidePanelParam;
        
        // 如果URL中有标记参数，将其保存到各种存储中
        if (hasSidePanelParam) {
          saveDetectionResult(true);
        }
        
        // 综合所有传统检测结果，但给URL参数和引用页检查更高的优先级
        const result = isDefinitelySidePanel || fromUrl || fromSession || fromLocal || 
                      fromChromeStorage || fromUrlMatch;
                      
        console.log('[SidePanel Navigation] 传统检测结果:', result, {
          hasSidePanelParam, isInternalNavigation, referrerIsSidePanel, isDefinitelySidePanel,
          fromUrl, fromSession, fromLocal, fromChromeStorage, fromUrlMatch
        });
        
        // 如果确定是侧边栏，立即应用侧边栏样式
        if (isDefinitelySidePanel) {
          document.body.classList.add('is-sidepanel');
        }
        
        resolve(result);
      }
    });
    
    detectionMethods.push(traditionalDetection);
    
    // 方法3：DOM特征检测 - 寻找页面中可能表明这是侧边栏的HTML结构或样式
    const domDetection = new Promise((resolve) => {
      // 延迟执行以等待DOM完全加载
      setTimeout(() => {
        // 检查是否存在某些侧边栏特有的元素或样式
        const hasSidePanelClasses = document.body.classList.contains('is-sidepanel') || 
                                   document.documentElement.classList.contains('is-sidepanel');
        
        // 检查窗口尺寸 - 侧边栏通常较窄
        const isNarrowViewport = window.innerWidth <= 480;
        
        console.log('[SidePanel Navigation] DOM检测结果:', { 
          hasSidePanelClasses, 
          isNarrowViewport,
          windowWidth: window.innerWidth 
        });
        
        // 如果有明显的侧边栏特征
        const result = hasSidePanelClasses || isNarrowViewport;
        
        if (result) {
          saveDetectionResult(true);
        }
        
        resolve(result);
      }, 500);
    });
    
    detectionMethods.push(domDetection);
    
    // 整合所有检测结果并执行相应操作
    Promise.all(detectionMethods).then(results => {
      // 只要有一个检测方法返回true，就认为在侧边栏中
      const detectionResult = results.some(result => result === true);
      
      console.log('[SidePanel Navigation] 所有检测方法结果:', results);
      console.log('[SidePanel Navigation] 最终检测结果:', detectionResult);
      
      // 再次检查URL参数，确保只在真正的侧边栏视图中添加导航栏
      const urlParams = new URLSearchParams(window.location.search);
      const hasSidePanelParam = urlParams.get('sidepanel_view') === 'true' || urlParams.get('is_sidepanel') === 'true';
      
      if (detectionResult && hasSidePanelParam && !navigationBarAdded) {
        inSidePanel = true;
        console.log('[SidePanel Navigation] 确认在侧边栏中，添加导航栏');
        initOrRefreshNavigationBar();
        navigationBarAdded = true;
      } else if (!detectionResult || !hasSidePanelParam) {
        console.log('[SidePanel Navigation] 不在侧边栏中，不添加导航栏 (detectionResult=', detectionResult, ', hasSidePanelParam=', hasSidePanelParam, ')');
      }
    });
  }
  
  // 保存检测结果到存储
  function saveDetectionResult(isInSidePanel) {
    // 再次检查URL参数，确保只在真正的侧边栏视图中保存状态
    const urlParams = new URLSearchParams(window.location.search);
    const hasSidePanelParam = urlParams.get('sidepanel_view') === 'true' || urlParams.get('is_sidepanel') === 'true';
    
    if (isInSidePanel && hasSidePanelParam) {
      try {
        sessionStorage.setItem('sidepanel_view', 'true');
        localStorage.setItem('sidepanel_view', 'true');
        
        if (isChromeExtension && chrome.storage && chrome.storage.session) {
          chrome.storage.session.set({ 'sidepanel_view': true });
        }
      } catch (e) {
        console.log('[SidePanel Navigation] 存储检测结果时出错:', e);
      }
    }
  }
  
  // 计算两个URL之间的相似度
  function calculateUrlSimilarity(url1, url2) {
    // 简化URL
    const simplifyUrl = (url) => {
      return url.replace(/^https?:\/\//, '')  // 移除协议
              .replace(/www\./, '')          // 移除www.
              .replace(/\?.*$/, '')          // 移除查询参数
              .replace(/#.*$/, '')           // 移除锚点
              .toLowerCase();                // 转小写
    };
    
    const simple1 = simplifyUrl(url1);
    const simple2 = simplifyUrl(url2);
    
    // 如果域名不同，直接认为不相似
    const domain1 = simple1.split('/')[0];
    const domain2 = simple2.split('/')[0];
    
    if (domain1 !== domain2) {
      return 0;
    }
    
    // 如果路径部分相同，高度相似
    const path1 = simple1.substring(domain1.length);
    const path2 = simple2.substring(domain2.length);
    
    if (path1 === path2) {
      return 1;
    }
    
    // 计算路径部分的相似度
    const similarity = calculateStringSimilarity(path1, path2);
    return 0.5 + (similarity * 0.5); // 域名相同至少有0.5的相似度
  }
  
  // 计算字符串相似度 (Levenshtein距离的简化版)
  function calculateStringSimilarity(str1, str2) {
    // 如果其中一个是空字符串，返回另一个字符串的长度
    if (str1.length === 0) return 0;
    if (str2.length === 0) return 0;
  
    // 如果字符串相同，相似度为1
    if (str1 === str2) return 1;
    
    // 简单方法：比较两个字符串中相同位置的字符数
    const minLength = Math.min(str1.length, str2.length);
    let matchCount = 0;
    
    for (let i = 0; i < minLength; i++) {
      if (str1[i] === str2[i]) {
        matchCount++;
      }
    }
    
    // 返回相似度 (0-1之间)
    return matchCount / Math.max(str1.length, str2.length);
  }
  
  // 简化初始化与刷新导航栏的函数
  function initOrRefreshNavigationBar() {
    if (document.querySelector('.sidepanel-nav-bar')) {
      console.log('[SidePanel Navigation] 导航栏已存在，不需要再次添加');
      return;
    }
    
    console.log('[SidePanel Navigation] 初始化导航栏');
      initializeNavigationBar();
      
    // 在DOMContentLoaded后进行二次检查，确保导航栏存在
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ensureNavigationBar);
    } else {
      ensureNavigationBar();
    }
    
    // 在网页加载后也检查一次，处理某些异步加载的网站
    if (document.readyState !== 'complete') {
      window.addEventListener('load', ensureNavigationBar);
    } else {
      ensureNavigationBar();
    }
    
    // 设置一个MutationObserver以确保导航栏不被移除
    setupMutationObserver(document.querySelector('.sidepanel-nav-bar'));
  }
  
  // 确保导航栏存在的函数
  function ensureNavigationBar() {
    if (!document.querySelector('.sidepanel-nav-bar')) {
      console.log('[SidePanel Navigation] Navigation bar not found, reinitializing');
      initializeNavigationBar();
    }
  }
  
  // 设置一个MutationObserver以确保导航栏不被移除
  function setupMutationObserver(navBar) {
    if (!navBar) {
      console.log('[SidePanel Navigation] No navigation bar to observe');
      return null;
    }
    
    console.log('[SidePanel Navigation] Setting up mutation observer for navigation bar');
    
    // 创建一个MutationObserver实例
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          const navBarStillExists = document.body.contains(navBar);
          
          if (!navBarStillExists) {
            console.log('[SidePanel Navigation] Navigation bar was removed, adding it back');
            // 如果导航栏被移除，重新创建并添加它
            initializeNavigationBar();
            
            // 如果新的导航栏创建成功，为其设置新的观察器
            const newNavBar = document.querySelector('.sidepanel-nav-bar');
            if (newNavBar && newNavBar !== navBar) {
              setupMutationObserver(newNavBar);
              
              // 停止当前观察器，因为我们已经创建了一个新的
              observer.disconnect();
              return;
            }
          }
        }
      }
    });
    
    // 开始观察document.body的子节点变化
    observer.observe(document.body, { childList: true, subtree: true });
    
    // 另外，监听DOM content loaded和load事件，确保导航栏存在
    const ensureNavBarExists = () => {
      const navBarExists = document.querySelector('.sidepanel-nav-bar');
      if (!navBarExists) {
        console.log('[SidePanel Navigation] Navigation bar not found on page load, adding it');
        initializeNavigationBar();
      }
    };
    
    if (document.readyState !== 'complete') {
      window.addEventListener('load', ensureNavBarExists, { once: true });
    }
    
    return observer;
  }
  
  function initializeNavigationBar() {
    console.log('[SidePanel Navigation] Initializing navigation bar for:', window.location.href);
    
    // 检查是否已存在导航栏，如果存在则不再添加
    if (document.querySelector('.sidepanel-nav-bar')) {
      console.log('[SidePanel Navigation] Navigation bar already exists, not adding again');
      return;
    }
    
    // 创建导航栏样式
    const style = document.createElement('style');
    style.textContent = `
      .sidepanel-nav-bar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 32px;
        background-color: rgba(248, 249, 250, 0.95);
        border-bottom: 1px solid #dee2e6;
        display: flex;
        align-items: center;
        padding: 0 5px;
        z-index: 99999 !important; /* 提高z-index确保显示在最上层 */
        font-family: Arial, sans-serif;
        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        transition: transform 0.3s ease, opacity 0.3s ease;
        pointer-events: auto !important;
      }
      
      /* Compact mode styles */
      .sidepanel-nav-bar.compact-mode {
        transform: translateY(-28px);
      }
      
      .sidepanel-nav-bar.compact-mode:hover,
      .sidepanel-nav-bar:has(.url-display:focus) {
        transform: translateY(0);
      }
      
      .sidepanel-nav-bar .toggle-compact {
        position: absolute;
        bottom: -14px;
        left: 50%;
        transform: translateX(-50%);
        width: 28px;
        height: 14px;
        background-color: rgba(248, 249, 250, 0.95);
        border: 1px solid #dee2e6;
        border-top: none;
        border-radius: 0 0 14px 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        z-index: 99998 !important;
        pointer-events: auto !important;
      }
      
      .sidepanel-nav-bar .toggle-compact svg {
        width: 12px;
        height: 12px;
        transition: transform 0.3s ease;
      }
      
      .sidepanel-nav-bar.compact-mode .toggle-compact svg {
        transform: rotate(180deg);
      }
      
      .sidepanel-nav-bar button {
        background: none;
        border: none;
        cursor: pointer;
        padding: 3px 5px;
        margin-right: 3px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #555;
        pointer-events: auto !important;
      }
      
      .sidepanel-nav-bar button:hover {
        background-color: #e9ecef;
      }
      
      .sidepanel-nav-bar button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .sidepanel-nav-bar button svg {
        width: 14px;
        height: 14px;
      }
      
      .sidepanel-nav-bar .url-display {
        flex-grow: 1;
        margin: 0 5px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 11px;
        color: #666;
        padding: 2px 6px;
        border-radius: 4px;
        border: 1px solid transparent;
        pointer-events: auto !important;
      }
      
      .sidepanel-nav-bar .url-display:hover {
        border-color: #dee2e6;
        background-color: white;
      }
      
      /* 为页面内容添加上边距，避免被导航栏遮挡 */
      body {
        margin-top: 32px !important;
        transition: margin-top 0.3s ease;
      }
      
      /* 当导航栏处于紧凑模式时，减少页面上边距 */
      body.nav-compact-mode {
        margin-top: 4px !important;
      }
      
      /* 暗色模式 */
      @media (prefers-color-scheme: dark) {
        .sidepanel-nav-bar {
          background-color: rgba(41, 42, 45, 0.95);
          border-bottom-color: #3c4043;
          color: #e8eaed;
        }
        
        .sidepanel-nav-bar .toggle-compact {
          background-color: rgba(41, 42, 45, 0.95);
          border-color: #3c4043;
        }
        
        .sidepanel-nav-bar button {
          color: #e8eaed;
        }
        
        .sidepanel-nav-bar button:hover {
          background-color: #3c4043;
        }
        
        .sidepanel-nav-bar .url-display {
          color: #9aa0a6;
        }
        
        .sidepanel-nav-bar .url-display:hover {
          background-color: #202124;
          border-color: #3c4043;
        }
      }
      
      /* 确保导航栏在所有条件下都是可见的 */
      .sidepanel-nav-bar {
        opacity: 1 !important;
        visibility: visible !important;
        display: flex !important;
      }
    `;
    document.head.appendChild(style);
    
    // 创建导航栏
    const navBar = document.createElement('div');
    navBar.className = 'sidepanel-nav-bar';
    navBar.id = 'sidepanel-navigation-bar'; // 添加ID便于查找
    
    // 添加返回主页按钮
    const homeButton = document.createElement('button');
    homeButton.title = '返回书签列表';
    homeButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>';
    homeButton.addEventListener('click', () => {
      if (isChromeExtension) {
        chrome.runtime.sendMessage({ action: 'navigateHome' });
      } else {
        console.log('[SidePanel Navigation] Chrome Extension API not available for navigateHome');
      }
    });
    
    // 添加返回按钮
    const backButton = document.createElement('button');
    backButton.title = '返回上一页';
    backButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>';
    backButton.disabled = true; // 默认禁用，等待历史记录加载
    backButton.addEventListener('click', () => {
      if (isChromeExtension) {
        chrome.runtime.sendMessage({ action: 'navigateBack' });
      } else {
        console.log('[SidePanel Navigation] Chrome Extension API not available for navigateBack');
        // 在普通网页中可以使用浏览器的返回功能
        window.history.back();
      }
    });
    
    // 添加前进按钮
    const forwardButton = document.createElement('button');
    forwardButton.title = '前进到下一页';
    forwardButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>';
    forwardButton.disabled = true; // 默认禁用，等待历史记录加载
    forwardButton.addEventListener('click', () => {
      if (isChromeExtension) {
        chrome.runtime.sendMessage({ action: 'navigateForward' });
      } else {
        console.log('[SidePanel Navigation] Chrome Extension API not available for navigateForward');
        // 在普通网页中可以使用浏览器的前进功能
        window.history.forward();
      }
    });
    
    // 添加刷新按钮
    const refreshButton = document.createElement('button');
    refreshButton.title = '刷新页面';
    refreshButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>';
    refreshButton.addEventListener('click', () => {
      // 使用自定义刷新方法，确保刷新后仍然显示导航栏
      refreshWithNavigation();
    });
    
    // 添加在新标签页中打开按钮
    const openInNewTabButton = document.createElement('button');
    openInNewTabButton.title = '在新标签页中打开';
    openInNewTabButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>';
    openInNewTabButton.addEventListener('click', () => {
      if (isChromeExtension) {
        chrome.tabs.create({ url: window.location.href });
      } else {
        console.log('[SidePanel Navigation] Chrome Extension API not available for openInNewTab');
        // 在普通网页中使用window.open
        window.open(window.location.href, '_blank');
      }
    });
    
    // 添加URL显示
    const urlDisplay = document.createElement('div');
    urlDisplay.className = 'url-display';
    urlDisplay.textContent = window.location.href;
    
    // 添加紧凑模式切换按钮
    const toggleCompact = document.createElement('div');
    toggleCompact.className = 'toggle-compact';
    toggleCompact.title = '切换导航栏模式';
    toggleCompact.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>';
    toggleCompact.addEventListener('click', () => {
      navBar.classList.toggle('compact-mode');
      document.body.classList.toggle('nav-compact-mode');
      
      // 保存用户偏好，仅当Chrome API可用时
      if (isChromeExtension) {
        chrome.storage.local.set({
          'sidepanel_nav_compact_mode': navBar.classList.contains('compact-mode')
        });
      } else {
        console.log('[SidePanel Navigation] Chrome Extension API not available for storage');
        // 在普通网页中可以使用localStorage作为备选
        try {
          localStorage.setItem('sidepanel_nav_compact_mode', navBar.classList.contains('compact-mode'));
        } catch (e) {
          console.log('[SidePanel Navigation] localStorage not available:', e);
        }
      }
    });
    
    // 将按钮添加到导航栏
    navBar.appendChild(homeButton);
    navBar.appendChild(backButton);
    navBar.appendChild(forwardButton);
    navBar.appendChild(refreshButton);
    navBar.appendChild(openInNewTabButton);
    navBar.appendChild(urlDisplay);
    navBar.appendChild(toggleCompact);
    
    // 将导航栏添加到页面
    document.body.insertBefore(navBar, document.body.firstChild);
    
    // 设置MutationObserver监视DOM变化
    const observer = setupMutationObserver(navBar);
    
    // 如果Chrome API可用，从存储中获取历史记录状态
    if (isChromeExtension) {
      // 从存储中获取历史记录状态，更新按钮状态
      chrome.storage.local.get(['sidePanelHistory', 'sidePanelCurrentIndex', 'sidepanel_nav_compact_mode'], (result) => {
        // 还原用户的紧凑模式偏好
        if (result.sidepanel_nav_compact_mode) {
          navBar.classList.add('compact-mode');
          document.body.classList.add('nav-compact-mode');
        }
        
        if (result.sidePanelHistory && result.sidePanelCurrentIndex !== undefined) {
          const history = result.sidePanelHistory;
          const currentIndex = result.sidePanelCurrentIndex;
          
          // 更新返回按钮状态
          backButton.disabled = currentIndex <= 0;
          
          // 更新前进按钮状态
          forwardButton.disabled = currentIndex >= history.length - 1;
          
          console.log('[SidePanel Navigation] Loaded history state:', {
            historyLength: history.length,
            currentIndex: currentIndex,
            canGoBack: currentIndex > 0,
            canGoForward: currentIndex < history.length - 1
          });
        } else {
          console.log('[SidePanel Navigation] No history state found in storage');
        }
      });
      
      // 监听来自背景脚本的消息
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        try {
          if (message && message.action === "updateNavigationState") {
            console.log('[SidePanel Navigation] Received navigation state update:', message);
            
            // 更新导航按钮状态
            const navBar = document.querySelector('.sidepanel-nav-bar');
            if (navBar) {
              // 查找按钮 (第二个按钮通常是后退，第三个按钮通常是前进)
              const buttons = navBar.querySelectorAll('button');
              const backButton = buttons[1]; // 后退按钮
              const forwardButton = buttons[2]; // 前进按钮
              
              if (backButton && forwardButton) {
                backButton.disabled = !message.canGoBack;
                forwardButton.disabled = !message.canGoForward;
                console.log('[SidePanel Navigation] Updated navigation buttons - Back:', 
                          !message.canGoBack ? 'disabled' : 'enabled', 
                          'Forward:', !message.canGoForward ? 'disabled' : 'enabled');
              } else {
                console.log('[SidePanel Navigation] Could not find navigation buttons');
              }
            } else {
              console.log('[SidePanel Navigation] Navigation bar not found');
              // 如果找不到导航栏，可能需要重新创建
              initOrRefreshNavigationBar();
            }
            
            // Send a response to prevent "Receiving end does not exist" errors
            if (sendResponse) {
              sendResponse({ success: true, message: 'Navigation state updated' });
            }
          }
        } catch (e) {
          console.error('[SidePanel Navigation] Error processing navigation state update:', e);
          if (sendResponse) {
            sendResponse({ success: false, error: e.message });
          }
        }
        
        return true; // Keep the message channel open for async response
      });
    } else {
      // 当Chrome API不可用时，使用浏览器导航历史
      backButton.disabled = !window.history.length;
      
      // 在普通网页中，无法准确判断能否前进，所以禁用前进按钮
      forwardButton.disabled = true;
      
      // 尝试从localStorage获取紧凑模式设置
      try {
        const compactMode = localStorage.getItem('sidepanel_nav_compact_mode') === 'true';
        if (compactMode) {
          navBar.classList.add('compact-mode');
          document.body.classList.add('nav-compact-mode');
        }
      } catch (e) {
        console.log('[SidePanel Navigation] localStorage not available:', e);
      }
    }
    
    // 使用setTimeout确保导航栏正确添加，避免可能的页面异步加载问题
    setTimeout(() => {
      if (!document.body.contains(navBar)) {
        console.log('[SidePanel Navigation] Navigation bar was not properly added, retrying');
        document.body.insertBefore(navBar, document.body.firstChild);
      }
    }, 500);
  }
  
  // 自定义刷新方法，确保刷新后仍显示导航栏
  function refreshWithNavigation() {
    // 先保存当前会话标记
    sessionStorage.setItem('sidepanel_view', 'true');
    try {
      localStorage.setItem('sidepanel_view', 'true');
    } catch (e) {
      console.log('[SidePanel Navigation] localStorage not available:', e);
    }
    
    // 然后再刷新页面
    // 如果URL中已经有参数，添加或更新sidepanel_view参数
    if (window.location.search) {
      // 解析现有的URL参数
      const currentUrl = new URL(window.location.href);
      const searchParams = currentUrl.searchParams;
      
      // 设置sidepanel_view参数
      searchParams.set('sidepanel_view', 'true');
      
      // 更新URL并刷新
      window.location.href = currentUrl.toString();
    } else {
      // 如果没有参数，添加sidepanel_view参数
      window.location.href = window.location.href + (window.location.href.includes('?') ? '&' : '?') + 'sidepanel_view=true';
    }
  }
})(); 