document.addEventListener('DOMContentLoaded', function () {
  const quickLinksContainer = document.getElementById('quick-links');
  const MAX_DISPLAY = 10;

  function faviconURL(u) {
    const url = new URL(chrome.runtime.getURL("/_favicon/"));
    url.searchParams.set("pageUrl", u);
    url.searchParams.set("size", "32");
    return url.toString();
  }

  function getSiteName(title, url) {
    const MAX_WIDTH_EN = 16; // 英文最大宽度
    const MAX_WIDTH_CN = 14; // 中文最大宽度（允许7个中文字符）
    const MAX_WIDTH_MIXED = 15; // 混合语言最大宽度

    function getVisualWidth(str) {
        return str.split('').reduce((width, char) => {
            return width + (/[\u4e00-\u9fa5]/.test(char) ? 2 : 1);
        }, 0);
    }

    function cleanTitle(title) {
        if (!title || typeof title !== 'string') return '';
        
        console.log('Cleaning title:', title); // 添加清洗前的日志

        // 移除常见的无用后缀
        title = title.replace(/\s*[-|·:]\s*.*$/, '');

        // 移除常见的网站后缀，但保留有效的标题部分
        title = title.replace(/\s*(官方网站|首页|网|网站|官网)$/, '');

        // 如果标题太长，尝试提取品牌名
        if (title.length > 20) {
            const parts = title.split(/\s+/);
            title = parts.length > 1 ? parts.slice(0, 2).join(' ') : title.substring(0, 20); // 取前两个词或截取前20个字符
        }

        // 如果清理后仍为空，返回原始标题的某种变体
        const cleanedTitle = title.trim();
        if (cleanedTitle === '') {
            console.warn('Title cleaned to empty for original title:', title);
            return title; // 返回原始标题的一部分或其他默认值
        }

        return cleanedTitle; // 返回清理后的标题
    }

    console.log('Original title:', title); // 添加原始标题日志
    title = cleanTitle(title);
    console.log('Cleaned title:', title); // 添加清洗后的标题日志

    // 处理标题
    if (title && title.trim() !== '') {
        const visualWidth = getVisualWidth(title);
        const chineseCharCount = (title.match(/[\u4e00-\u9fa5]/g) || []).length;
        const chineseRatio = chineseCharCount / title.length;

        let maxWidth;
        if (chineseRatio === 0) {
            maxWidth = MAX_WIDTH_EN;
        } else if (chineseRatio === 1) {
            maxWidth = MAX_WIDTH_CN;
        } else {
            maxWidth = Math.round(MAX_WIDTH_MIXED * (1 - chineseRatio) + MAX_WIDTH_CN * chineseRatio / 2);
        }

        if (visualWidth > maxWidth) {
            let truncated = '';
            let currentWidth = 0;
            for (let char of title) {
                const charWidth = /[\u4e00-\u9fa5]/.test(char) ? 2 : 1;
                if (currentWidth + charWidth > maxWidth) break;
                truncated += char;
                currentWidth += charWidth;
            }
            return truncated; // 返回截断后的标题
        }
        return title; // 返回清理后的标题
    } else {
        console.error('Title is empty or invalid, using URL as fallback.'); // 新增日志
        // 处理 URL
        try {
            const hostname = new URL(url).hostname;
            let name = hostname.replace(/^www\./, '').split('.')[0];
            name = name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/-/g, ' ');
            return getVisualWidth(name) > MAX_WIDTH_EN ? name.substring(0, MAX_WIDTH_EN) : name; // 返回主机名
        } catch (error) {
            console.error('Invalid URL provided:', url, error);
            return 'Unknown Site'; // 返回默认值
        }
    }
  }

  // 获取固定的快捷方式
  function getFixedShortcuts() {
    return new Promise((resolve) => {
      chrome.storage.sync.get('fixedShortcuts', (result) => {
        console.log('Retrieved fixed shortcuts:', result.fixedShortcuts);
        resolve(result.fixedShortcuts || []);
      });
    });
  }

  // 更新固定的快捷方式
  function updateFixedShortcut(updatedSite, oldUrl) {
    chrome.storage.sync.get('fixedShortcuts', (result) => {
      let fixedShortcuts = result.fixedShortcuts || [];
      const index = fixedShortcuts.findIndex(s => s.url === oldUrl);
      if (index !== -1) {
        // 更新现有的快捷方式
        fixedShortcuts[index] = updatedSite;
      } else {
        // 如果没有找到匹配的 URL，添加新的快捷方式
        fixedShortcuts.push(updatedSite);
      }
      chrome.storage.sync.set({ fixedShortcuts }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error saving updated shortcut:', chrome.runtime.lastError);
        } else {
          console.log('Shortcut updated successfully');
          refreshQuickLink(updatedSite, oldUrl);
          // 使用 setTimeout 来确保存储操作完成后再生成快速链接
          setTimeout(() => generateQuickLinks(), 0);
        }
      });
    });
  }

  // 智能排序历史记录
  function sortHistoryItems(items) {
    const now = new Date().getTime();
    const DAY_IN_MS = 24 * 60 * 60 * 1000;
    const MONTH_IN_MS = 30 * DAY_IN_MS;
    const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000; // 一周的毫秒数

    // 创建一个 Map 来存储每个主域名的访问信息
    const domainVisits = new Map();

    // 计算每个域名的访问次数和最后访问时间，同时保存主页面和子页面信息
    items.forEach(item => {
      const url = new URL(item.url);
      const domain = url.hostname;
      const path = url.pathname + url.search;
      
      if (!domainVisits.has(domain)) {
        domainVisits.set(domain, { 
          totalCount: 0, 
          lastVisit: 0,
          mainPage: null,
          lastSubPage: null
        });
      }

      const domainInfo = domainVisits.get(domain);
      domainInfo.totalCount += 1;
      
      if (item.lastVisitTime > domainInfo.lastVisit) {
        domainInfo.lastVisit = item.lastVisitTime;
      }

      // 更新主页面或最近访问的子页面信息
      const mainPagePaths = ['/', '', '/home', '/index', '/main', '/welcome', '/start', '/default', '/dashboard', '/portal', '/explore'];
      const isMainPage = mainPagePaths.includes(path);
      if (isMainPage) {
        domainInfo.mainPage = item;
      } else if (!domainInfo.lastSubPage || item.lastVisitTime > domainInfo.lastSubPage.lastVisitTime) {
        domainInfo.lastSubPage = item;
      }
    });

    // 将 Map 转换为数组并排序
    return Array.from(domainVisits.entries())
      .map(([domain, info]) => {
        // 优先选择主页面，如果没有主页面则选择最后访问的子页面
        const representativeItem = info.mainPage || info.lastSubPage;
        
        if (!representativeItem) return null; // 跳过没有有效项目的域名

        return {
          domain: domain,
          url: representativeItem.url,
          title: representativeItem.title,
          lastVisitTime: info.lastVisit,
          visitCount: info.totalCount
        };
      })
      .filter(item => item !== null) // 移除空项
      .sort((a, b) => {
        const recencyScoreA = Math.exp(-(now - a.lastVisitTime) / WEEK_IN_MS);
        const recencyScoreB = Math.exp(-(now - b.lastVisitTime) / WEEK_IN_MS);
        const frequencyScoreA = Math.log(a.visitCount + 1);
        const frequencyScoreB = Math.log(b.visitCount + 1);
        const scoreA = recencyScoreA * 0.45 + frequencyScoreA * 0.55;
        const scoreB = recencyScoreB * 0.45 + frequencyScoreB * 0.55;
        return scoreB - scoreA;
      });
  }

  // 生成快速链接
  async function generateQuickLinks() {
    const fixedShortcuts = await getFixedShortcuts();
    const fixedUrls = new Set(fixedShortcuts.map(shortcut => shortcut.url));
    const blacklist = await getBlacklist(); // 获取黑名单

    // 添加搜索引擎域名到黑名单
    const searchEngineDomains = [
      'kimi.moonshot.cn',
      'www.doubao.com',
      'chatgpt.com',
      'felo.ai',
      'metaso.cn',
      'www.google.com',
      'cn.bing.com',
      'www.baidu.com',
      'www.sogou.com',
      'www.so.com',
      'www.360.cn',
      
    ];

    // 将搜索引擎域名添加到黑名单
    for (const domain of searchEngineDomains) {
      if (!blacklist.includes(domain)) {
        await addToBlacklist(domain);
      }
    }

    // 重新获取更新后的黑名单
    const updatedBlacklist = await getBlacklist();
    console.log('Retrieved blacklist:', updatedBlacklist); // Log the retrieved blacklist

    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    chrome.history.search({ 
      text: '', 
      startTime: oneMonthAgo.getTime(),
      maxResults: 1000
    }, function (historyItems) {
      const sortedHistory = sortHistoryItems(historyItems);
      const uniqueDomains = new Set();
      const allShortcuts = [];

      // 首先添加固定的快捷方式
      fixedShortcuts.forEach(shortcut => {
        const domain = new URL(shortcut.url).hostname;
        if (!updatedBlacklist.includes(domain)) {
          allShortcuts.push(shortcut);
          uniqueDomains.add(domain);
        }
      });

      // 然后添加历史记录中的项目
      for (const item of sortedHistory) {
        const domain = new URL(item.url).hostname;
        if (!fixedUrls.has(item.url) && !uniqueDomains.has(domain) && allShortcuts.length < MAX_DISPLAY && !updatedBlacklist.includes(domain)) {
          uniqueDomains.add(domain);
          allShortcuts.push({
            name: getSiteName(item.title, item.url),
            url: item.url,
            favicon: faviconURL(item.url),
            fixed: false
          });
        }
      }

      console.log('All shortcuts before rendering:', allShortcuts);
      renderQuickLinks(allShortcuts);
      
      // 在渲染完成后调整容器宽度
      adjustQuickLinksContainerWidth();
    });
  }

  // 渲染快速链接
  function renderQuickLinks(shortcuts) {
    const quickLinksContainer = document.getElementById('quick-links');
    
    // 移除所有现有的占位元素
    quickLinksContainer.innerHTML = '';

    shortcuts.forEach((site, index) => {
      const linkItem = document.createElement('div');
      linkItem.className = 'quick-link-item-container';
      linkItem.dataset.url = site.url;

      const link = document.createElement('a');
      link.href = site.url;
      link.className = 'quick-link-item';

      const img = document.createElement('img');
      img.src = site.favicon;
      img.alt = `${site.name} Favicon`;
      img.addEventListener('error', function () {
        this.src = '../images/placeholder-icon.svg';
      });

      link.appendChild(img);

      const span = document.createElement('span');
      span.textContent = site.name;

      linkItem.appendChild(link);
      linkItem.appendChild(span);

      linkItem.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e, site);
      });

      quickLinksContainer.appendChild(linkItem);
    });

    // 如果实际的快捷方式数量少于占位符数量，添加额外的占位符
    const placeholdersNeeded = Math.max(0, 10 - shortcuts.length);
    for (let i = 0; i < placeholdersNeeded; i++) {
      const placeholder = document.createElement('div');
      placeholder.className = 'quick-link-placeholder';
      quickLinksContainer.appendChild(placeholder);
    }

    adjustQuickLinksContainerWidth();
  }

  // 显示上下文菜单
  function showContextMenu(e, site) {
    e.preventDefault();
    // 移除任何已存在的上下文菜单
    const existingMenu = document.querySelector('.custom-context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }

    const contextMenu = document.createElement('div');
    contextMenu.className = 'custom-context-menu';

    contextMenu.style.display = 'block';
    contextMenu.style.left = `${e.clientX}px`;
    contextMenu.style.top = `${e.clientY}px`;

    // 定义菜单项
    const menuItems = [
      { text: chrome.i18n.getMessage("openInNewTab"), icon: 'open_in_new', action: () => window.open(site.url, '_blank') },
      { text: chrome.i18n.getMessage("openInNewWindow"), icon: 'launch', action: () => window.open(site.url, '_blank', 'noopener,noreferrer') },
      { text: chrome.i18n.getMessage("openInIncognito"), icon: 'visibility_off', action: () => openInIncognito(site.url) },
      { text: chrome.i18n.getMessage("editQuickLink"), icon: 'edit', action: () => editQuickLink(site) },
      { text: chrome.i18n.getMessage("deleteQuickLink"), icon: 'delete', action: () => addToBlacklistConfirm(site) },
      { text: chrome.i18n.getMessage("copyLink"), icon: 'content_copy', action: () => copyToClipboard(site.url) },
      { text: chrome.i18n.getMessage("createQRCode"), icon: 'qr_code', action: () => createQRCode(site.url, site.name) }
    ];

    menuItems.forEach((item, index) => {
      const menuItem = document.createElement('div');
      menuItem.className = 'custom-context-menu-item';
      
      const icon = document.createElement('span');
      icon.className = 'material-icons';
      icon.textContent = item.icon;
      
      const text = document.createElement('span');
      text.textContent = item.text;

      menuItem.appendChild(icon);
      menuItem.appendChild(text);

      menuItem.addEventListener('click', () => {
        item.action();
        contextMenu.remove();
      });

      if (index === 3 || index === 5) {
        const divider = document.createElement('div');
        divider.className = 'custom-context-menu-divider';
        contextMenu.appendChild(divider);
      }

      contextMenu.appendChild(menuItem);
    });

    document.body.appendChild(contextMenu);

    // 确保菜单不会超出视窗
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const menuRect = contextMenu.getBoundingClientRect();

    if (e.clientX + menuRect.width > viewportWidth) {
      contextMenu.style.left = `${viewportWidth - menuRect.width}px`;
    }

    if (e.clientY + menuRect.height > viewportHeight) {
      contextMenu.style.top = `${viewportHeight - menuRect.height}px`;
    }

    // 点击其他地方闭菜单
    function closeMenu(e) {
      if (!contextMenu.contains(e.target)) {
        contextMenu.remove();
        document.removeEventListener('click', closeMenu);
      }
    }

    // 使用 setTimeout 来确保这个监听器不会立即触发
    setTimeout(() => {
      document.addEventListener('click', closeMenu);
    }, 0);
  }

  // 编辑快捷链接
  function editQuickLink(site) {
    const editDialog = document.getElementById('edit-dialog');
    const editNameInput = document.getElementById('edit-name');
    const editUrlInput = document.getElementById('edit-url');
    const editDialogTitle = editDialog.querySelector('h2');

    editDialogTitle.textContent = chrome.i18n.getMessage("editDialogTitle");

    editNameInput.value = site.name;
    editUrlInput.value = site.url;

    editDialog.style.display = 'block';

    document.getElementById('edit-form').onsubmit = function(event) {
      event.preventDefault();
      const newName = editNameInput.value.trim();
      const newUrl = editUrlInput.value.trim();

      if (newName && newUrl) {
        const oldUrl = site.url;
        const updatedSite = {
          name: newName,
          url: newUrl,
          favicon: faviconURL(newUrl),
          fixed: true
        };
        updateFixedShortcut(updatedSite, oldUrl);
        editDialog.style.display = 'none';
      }
    };

    document.querySelector('.cancel-button').onclick = function() {
      editDialog.style.display = 'none';
    };

    document.querySelector('.close-button').onclick = function() {
      editDialog.style.display = 'none';
    };
  }

  // 刷新单个快捷链接
  function refreshQuickLink(site, oldUrl) {
    const linkItem = document.querySelector(`.quick-link-item-container[data-url="${oldUrl}"]`);
    if (linkItem) {
      const link = linkItem.querySelector('a');
      const img = link.querySelector('img');
      const span = linkItem.querySelector('span');

      link.href = site.url;
      
      // 更新 favicon
      const newFaviconUrl = faviconURL(site.url);
      img.src = newFaviconUrl;
      img.alt = `${site.name} Favicon`;
      
      // 添加错误处理，如果新的 favicon 加载失败，使用默认图标
      img.onerror = function() {
        this.src = '../images/placeholder-icon.svg';
      };

      span.textContent = site.name;

      // 更新 data-url 属性
      linkItem.dataset.url = site.url;

      console.log('Quick link refreshed:', site);
    } else {
      console.error('Quick link element not found for:', oldUrl);
      // 如元素可需重成整个列表
      generateQuickLinks();
    }
  }

  // 确认添加到黑名单
  function addToBlacklistConfirm(site) {
    console.log(`Attempting to add to blacklist: ${site.name} (${site.url})`);
    const confirmDialog = document.getElementById('confirm-dialog');
    const confirmDeleteQuickLinkMessage = document.getElementById('confirm-delete-quick-link-message'); // 新增的元素

    // 使用 <strong> 标签将名字加粗
    confirmDeleteQuickLinkMessage.innerHTML = chrome.i18n.getMessage("confirmDeleteQuickLinkMessage", `<strong>${site.name}</strong>`); // 设置新元素的内容

    confirmDialog.style.display = 'block';

    document.getElementById('confirm-delete-button').onclick = function() {
      console.log(`User confirmed adding to blacklist: ${site.name}`);
      const domain = new URL(site.url).hostname;
      addToBlacklist(domain).then((added) => {
        if (added) {
          console.log(`Domain added to blacklist: ${domain}`);
          // 如果是固定的快捷方式，也需要从固定列表中除
          if (site.fixed) {
            chrome.storage.sync.get('fixedShortcuts', (result) => {
              const fixedShortcuts = result.fixedShortcuts || [];
              const updatedShortcuts = fixedShortcuts.filter(s => s.url !== site.url);
              chrome.storage.sync.set({ fixedShortcuts: updatedShortcuts }, () => {
                console.log(`Fixed shortcut removed: ${site.name}`);
              });
            });
          }
          generateQuickLinks(); // 重新生成快速链接
        } else {
          console.log(`Domain already in blacklist: ${domain}`);
        }
        confirmDialog.style.display = 'none';
      });
    };

    document.getElementById('cancel-delete-button').onclick = function() {
      console.log(`User cancelled adding to blacklist: ${site.name}`);
      confirmDialog.style.display = 'none';
    };
  }

  // 在无痕窗口中打开链接
  function openInIncognito(url) {
    chrome.windows.create({ url: url, incognito: true });
  }

  // 复制链接到剪贴板
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      // 显示 toast 提示
      showToast('链接已复制到剪贴板');
      console.log('Link copied to clipboard');
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  }
  // 显示 toast 提示
  function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 3000); // 显示3秒钟
  }

  // 创建二维码的函数
  function createQRCode(url, bookmarkName) {
    console.log('Creating QR code for:', url);
    console.log('Bookmark name:', bookmarkName);
    console.log('Download button text:', getLocalizedMessage('download'));

    // 创建一个模态来显示二维码
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.left = '0';
    modal.style.top = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.zIndex = '1000';

    const qrContainer = document.createElement('div');
    qrContainer.style.backgroundColor = 'white';
    qrContainer.style.padding = '1.5rem 3rem';
    qrContainer.style.width = '320px';
    qrContainer.style.borderRadius = '10px';
    qrContainer.style.display = 'flex';
    qrContainer.style.flexDirection = 'column';
    qrContainer.style.alignItems = 'center';
    qrContainer.style.position = 'relative';

    // 添加关闭按钮
    const closeButton = document.createElement('span');
    closeButton.textContent = '×';
    closeButton.style.position = 'absolute';
    closeButton.style.right = '10px';
    closeButton.style.top = '10px';
    closeButton.style.fontSize = '20px';
    closeButton.style.cursor = 'pointer';
    closeButton.onclick = () => document.body.removeChild(modal);
    qrContainer.appendChild(closeButton);

    // 添加标题
    const title = document.createElement('h2');
    title.textContent = getLocalizedMessage('scanQRCode');
    title.style.marginBottom = '20px';
    title.style.fontWeight = '600';
    title.style.fontSize = '0.875rem';
    qrContainer.appendChild(title);

    // 创建 QR 码容器
    const qrCodeElement = document.createElement('div');
    qrContainer.appendChild(qrCodeElement);

    // 添加 URL 显示
    const urlDisplay = document.createElement('div');
    urlDisplay.textContent = url;
    urlDisplay.style.marginTop = '20px';
    urlDisplay.style.wordBreak = 'break-all';
    urlDisplay.style.maxWidth = '300px';
    urlDisplay.style.textAlign = 'center';
    qrContainer.appendChild(urlDisplay);

    // 添加按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'space-between';
    buttonContainer.style.width = '100%';
    buttonContainer.style.marginTop = '20px';

    // 添加复制按钮
    const copyButton = document.createElement('button');
    copyButton.textContent = getLocalizedMessage('copyLink');
    copyButton.onclick = () => {
      navigator.clipboard.writeText(url).then(() => {
        copyButton.textContent = getLocalizedMessage('copied');
        setTimeout(() => copyButton.textContent = getLocalizedMessage('copyLink'), 2000);
      });
    };

    // 添加下载按钮
    const downloadButton = document.createElement('button');
    downloadButton.textContent = getLocalizedMessage('download');
    downloadButton.onclick = () => {
      console.log('Download button clicked');
      // 给 QRCode 生成一些时间
      setTimeout(() => {
        const canvas = qrCodeElement.querySelector('canvas');
        if (canvas) {
          const link = document.createElement('a');
          // 使用书签名称作为文件名，并添加 .png 扩展名
          const fileName = `${bookmarkName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_qrcode.png`;
          link.download = fileName;
          link.href = canvas.toDataURL('image/png');
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          console.error('QR code canvas not found');
          // 可以在这里添加一个用户提示
        }
      }, 100); // 给予 100ms 的延迟，确保 QR 码已经生成
    };

    // 设置按钮样式和hover效果
    [copyButton, downloadButton].forEach(button => {
      button.style.padding = '5px 10px';
      button.style.border = 'none';
      button.style.borderRadius = '5px';
      button.style.cursor = 'pointer';
      button.style.backgroundColor = '#f0f0f0';
      button.style.color = '#333';
      button.style.transition = 'all 0.3s ease';

      // 添加hover效果
      button.addEventListener('mouseenter', () => {
        button.style.backgroundColor = '#e0e0e0';
        button.style.color = '#111827';
      });
      button.addEventListener('mouseleave', () => {
        button.style.backgroundColor = '#f0f0f0';
        button.style.color = '#717882';
      });
    });

    buttonContainer.appendChild(copyButton);
    buttonContainer.appendChild(downloadButton);
    qrContainer.appendChild(buttonContainer);

    modal.appendChild(qrContainer);
    document.body.appendChild(modal);

    // 使用 qrcode.js 库生成二维码
    new QRCode(qrCodeElement, {
      text: url,
      width: 200,
      height: 200
    });

    // 点击模态框外部关闭
    modal.addEventListener('click', function (event) {
      if (event.target === modal) {
        document.body.removeChild(modal);
      }
    });
  }

  // 获取黑名单
  function getBlacklist() {
    return new Promise((resolve) => {
      chrome.storage.sync.get('blacklist', (result) => {
        console.log('Retrieved blacklist:', result.blacklist);
        resolve(result.blacklist || []); // 确保返回一个数组
      });
    });
  }

  // 添加到黑名单
  function addToBlacklist(domain) {
    return new Promise((resolve) => {
      chrome.storage.sync.get('blacklist', (result) => {
        let blacklist = result.blacklist || [];
        if (!blacklist.includes(domain)) {
          blacklist.push(domain);
          chrome.storage.sync.set({ blacklist }, () => {
            console.log(`Domain added to blacklist: ${domain}`);
            resolve(true);
          });
        } else {
          console.log(`Domain already in blacklist: ${domain}`);
          resolve(false);
        }
      });
    });
  }

  // 初始化
  generateQuickLinks();

  // 调整容器宽度
  function adjustQuickLinksContainerWidth() {
    const container = document.querySelector('.quick-links-container');
    const items = container.querySelectorAll('.quick-link-item-container');
    const itemCount = items.length;
    const itemWidth = 80; // 每个项目的宽度（包括间距）
    const maxColumns = 10; // 最大列数
    const columns = Math.min(itemCount, maxColumns);
    
    // 计算容器宽度
    const containerWidth = columns * itemWidth;
    
    // 设置容器宽度
    container.style.width = `${containerWidth}px`;
    
    // 更新网格列数
    container.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
  }

  // 监听窗口大小变化
  window.addEventListener('resize', adjustQuickLinksContainerWidth);

  function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 3000); // 显示3秒钟
  }
});