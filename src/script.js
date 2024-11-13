let bookmarkTreeNodes = [];

function getLocalizedMessage(messageName) {
  const message = chrome.i18n.getMessage(messageName);
  return message || messageName;
}

// 在文件顶部添加这个函数
function applyBackgroundColor() {
  const savedBg = localStorage.getItem('selectedBackground');
  if (savedBg) {
    document.documentElement.className = savedBg;
  }
}

// 立即调用这个函数
applyBackgroundColor();

function updateSearchEngineIcon(engineName) {
  const searchEngineIcon = document.getElementById('search-engine-icon');

  if (searchEngineIcon) {
    const iconPath = getSearchEngineIconPath(engineName);
    if (searchEngineIcon.src !== iconPath) {
      // 创建一个新的 Image 对象来预加载图标
      const img = new Image();
      img.onload = function () {
        // 图标加载完成后，更新 src
        searchEngineIcon.src = iconPath;
        searchEngineIcon.alt = `${engineName} Search`;
      };
      img.onerror = function () {
        // 加载失败时，可以选择保留占位图或设置一个默认图标
      };
      img.src = iconPath;
    }
  }
}


function getSearchEngineIconPath(engineName) {
  const iconPaths = {
    google: '../images/google-logo.svg',
    bing: '../images/bing-logo.png',
    doubao: '../images/doubao-logo.png',
    kimi: '../images/kimi-logo.svg',
    metaso: '../images/metaso-logo.png',
    felo: '../images/felo-logo.svg',
    chatgpt: '../images/chatgpt-logo.svg'
  };
  return iconPaths[engineName.toLowerCase()] || '../images/google-logo.svg'; //  Google 图标
}

// 同样，将这个函数也移到全作用域
function setDefaultIcon(iconElement) {
  iconElement.src = '../images/default-search-icon.png';
  iconElement.alt = 'Default Search Engine';
}
function updateBookmarkCards() {
  const bookmarksList = document.getElementById('bookmarks-list');
  const defaultBookmarkId = localStorage.getItem('defaultBookmarkId');
  const parentId = defaultBookmarkId || bookmarksList.dataset.parentId || '1';

  chrome.bookmarks.getChildren(parentId, function (bookmarks) {
    displayBookmarks({ id: parentId, children: bookmarks });

    // 在显示书签后更新默认书签指示器
    updateDefaultBookmarkIndicator();
    updateSidebarDefaultBookmarkIndicator();

    // 更新 bookmarks-list 的 data-parent-id
    bookmarksList.dataset.parentId = parentId;
  });
}
document.addEventListener('DOMContentLoaded', function () {
  let currentBookmark = null; // 添加这行
  const searchEngineIcon = document.getElementById('search-engine-icon');
  const defaultSearchEngine = localStorage.getItem('selectedSearchEngine') || 'google';
  let deletedBookmark = null;
  let deletedCategory = null; // 添加这行
  let deleteTimeout = null;
  let bookmarkTreeNodes = []; // 定义全局变量
  // 调用 updateBookmarkCards
  updateBookmarkCards();
  
  setSearchEngineIcon(defaultSearchEngine);

  function setSearchEngineIcon(engineName) {
    const iconPath = getSearchEngineIconPath(engineName);
    searchEngineIcon.src = iconPath;
    searchEngineIcon.alt = `${engineName} Search`;
  }
  if (searchEngineIcon.src === '') {
    searchEngineIcon.src = '../images/placeholder-icon.svg';
  }
  setTimeout(() => {
    updateSearchEngineIcon(defaultSearchEngine);
  }, 0);
  // 修改 updateSearchEngineIcon 函数
  function updateSearchEngineIcon(engineName) {
    setSearchEngineIcon(engineName);
  }

  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', function () {
      const selectedEngine = this.getAttribute('data-engine');
      localStorage.setItem('selectedSearchEngine', selectedEngine);
      
      setSearchEngineIcon(selectedEngine);
      
      // 移除其他标签的 active 类
      tabs.forEach(t => t.classList.remove('active'));
      // 为当选中的标签添加 active 类
      this.classList.add('active');
    });
  });

  // Ensure the correct tab is active
  const defaultTab = Array.from(tabs).find(tab => 
    (tab.getAttribute('data-engine') || tab.textContent.trim()).toLowerCase() === defaultSearchEngine.toLowerCase()
  );
  if (defaultTab) {
    tabs.forEach(t => t.classList.remove('active'));
    defaultTab.classList.add('active');
  }

  // 更新侧边栏默认书签指示器和选中状态
  updateSidebarDefaultBookmarkIndicator();

  // ... 其他代码 ...
});

function showMovingFeedback(element) {
  element.style.opacity = '0.5';
}

function hideMovingFeedback(element) {
  element.style.opacity = '1';
}

function showSuccessFeedback(element) {
  element.style.backgroundColor = '#e6ffe6';
  setTimeout(() => {
    element.style.backgroundColor = '';
  }, 1000);
}

function showErrorFeedback(element) {
  element.style.backgroundColor = '#ffe6e6';
  setTimeout(() => {
    element.style.backgroundColor = '';
  }, 1000);
}
function waitForFirstCategory(attemptsLeft) {
  if (attemptsLeft <= 0) {
    updateBookmarksDisplay('1');
    updateFolderName('默认文件夹');
    return;
  }

  let defaultBookmarkId = localStorage.getItem('defaultBookmarkId');

  function initializeBookmarks() {
    if (defaultBookmarkId) {
      chrome.bookmarks.get(defaultBookmarkId, function (results) {
        if (results && results.length > 0) {
          const defaultBookmark = results[0];
          updateBookmarksDisplay(defaultBookmarkId).then(() => {
            updateFolderName(defaultBookmarkId);

            chrome.bookmarks.getTree(function (nodes) {
              bookmarkTreeNodes = nodes;
              displayBookmarkCategories(bookmarkTreeNodes[0].children, 0, null, '1');

              // 选中侧边栏中对应的文件夹
              selectSidebarFolder(defaultBookmarkId);
            });
          });
        } else {
          fallbackToRoot();
        }
      });
    } else {
      fallbackToRoot();
    }
  }

  function fallbackToRoot() {
    chrome.bookmarks.getTree(function (nodes) {
      bookmarkTreeNodes = nodes;
      displayBookmarkCategories(bookmarkTreeNodes[0].children, 0, null, '1');

      chrome.bookmarks.getChildren('1', function (bookmarks) {
        const nonFolderBookmarks = bookmarks.filter(bookmark => bookmark.url);
        if (nonFolderBookmarks.length > 0) {
          displayBookmarks({ id: '1', children: nonFolderBookmarks });
          updateFolderName('默认文件夹');
        } else {
          const firstCategory = document.querySelector('#categories-list li[data-title]');
          if (firstCategory) {
            const firstSubCategory = firstCategory.nextElementSibling ? firstCategory.nextElementSibling.querySelector('li') : null;
            if (firstSubCategory) {
              openCategory(firstSubCategory);
              setDefaultBookmark(firstSubCategory.dataset.id);
              updateFolderName(firstSubCategory.dataset.id);
            } else {
              openCategory(firstCategory);
              setDefaultBookmark(firstCategory.dataset.id);
              updateFolderName(firstCategory.dataset.id);
            }
          } else {
            setTimeout(function () {
              waitForFirstCategory(attemptsLeft - 1);
            }, 100);
          }
        }
      });
    });
  }

  initializeBookmarks();
}
function updateBookmarksDisplay(parentId, movedItemId, newIndex) {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.getChildren(parentId, (bookmarks) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }

      const bookmarksList = document.getElementById('bookmarks-list');
      const bookmarksContainer = document.querySelector('.bookmarks-container');

      // 先隐藏容器
      bookmarksContainer.style.opacity = '0';
      bookmarksContainer.style.transform = 'translateY(20px)';

      // 清空现有书签和占位符
      bookmarksList.innerHTML = '';

      // 更新本地缓存
      bookmarkOrderCache[parentId] = bookmarks.map(b => b.id);

      // 添加新的书签
      bookmarks.forEach((bookmark, index) => {
        const bookmarkElement = bookmark.url ? createBookmarkCard(bookmark, index) : createFolderCard(bookmark, index);
        bookmarksList.appendChild(bookmarkElement);
      });

      bookmarksList.dataset.parentId = parentId;

      if (movedItemId) {
        highlightBookmark(movedItemId);
      }

      // 更新文件夹名称
      updateFolderName(parentId);

      // 使用 requestAnimationFrame 来确保 DOM 更新后再显示容器
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          bookmarksContainer.style.opacity = '1';
          bookmarksContainer.style.transform = 'translateY(0)';
        });
      });

      resolve();
    });
  });
}

// 获取书签栏的本地化名称
function getBookmarksBarName() {
  return new Promise((resolve) => {
    chrome.bookmarks.getTree(function(tree) {
      if (tree && tree[0] && tree[0].children) {
        const bookmarksBar = tree[0].children.find(child => child.id === '1');
        if (bookmarksBar) {
          resolve(bookmarksBar.title);
        } else {
          resolve('Bookmarks Bar'); // 默认英文名称
        }
      } else {
        resolve('Bookmarks Bar'); // 默认英文名称
      }
    });
  });
}

function getBookmarkPath(bookmarkId) {
  return new Promise((resolve, reject) => {
    getBookmarksBarName().then(bookmarksBarName => {
      function getParentRecursive(id, path = []) {
        chrome.bookmarks.get(id, function(results) {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }
          if (results && results[0]) {
            path.unshift(results[0].title);
            if (results[0].parentId && results[0].parentId !== '0') {
              getParentRecursive(results[0].parentId, path);
            } else {
              // 确保书签栏名称总是作为第一个元素
              if (path[0] !== bookmarksBarName) {
                path.unshift(bookmarksBarName);
              }
              resolve(path);
            }
          } else {
            reject(new Error('Bookmark not found'));
          }
        });
      }
      getParentRecursive(bookmarkId);
    });
  });
}

function updateFolderName(bookmarkId) {
  const folderNameElement = document.getElementById('folder-name');
  if (folderNameElement) {
    folderNameElement.innerHTML = ''; // 清除所有内容，包括可能的占位符
    
    getBookmarkPath(bookmarkId).then(pathArray => {
      let breadcrumbHtml = '';
      let currentPath = '';

      pathArray.forEach((part, index) => {
        currentPath += (index > 0 ? ' > ' : '') + part;
        breadcrumbHtml += `<span class="breadcrumb-item" data-path="${currentPath}">${getLocalizedMessage(part)}</span>`;
        if (index < pathArray.length - 1) {
          breadcrumbHtml += '<span class="breadcrumb-separator">&gt;</span>';
        }
      });

      folderNameElement.innerHTML = breadcrumbHtml;
      addBreadcrumbClickListeners();
    }).catch(error => {
      console.error('Error updating folder name:', error);
      folderNameElement.textContent = getLocalizedMessage('bookmarks'); // 错误时设置默认文本
    });
  }
}

function addBreadcrumbClickListeners() {
  const breadcrumbItems = document.querySelectorAll('.breadcrumb-item');
  breadcrumbItems.forEach(item => {
    item.addEventListener('click', function () {
      const path = this.dataset.path;
      navigateToPath(path);
    });
  });
}

function navigateToPath(path) {
  const pathParts = path.split(' > ');
  
  // 获取书签栏的名称
  getBookmarksBarName().then(bookmarksBarName => {
    let currentId = '1'; // 默认从根目录开始
    let startIndex = 0;

    // 如果路径不是从书签栏开始，我们需要找到正确的起始点
    if (pathParts[0] !== bookmarksBarName) {
      chrome.bookmarks.search({title: pathParts[0]}, function(results) {
        if (results.length > 0) {
          currentId = results[0].id;
        }
        navigateRecursive(startIndex);
      });
    } else {
      startIndex = 1; // 如果是从书签栏开始，跳过第一个元素
      navigateRecursive(startIndex);
    }

    function navigateRecursive(index) {
      if (index >= pathParts.length) {
        updateBookmarksDisplay(currentId);
        return;
      }

      chrome.bookmarks.getChildren(currentId, function(children) {
        const matchingChild = children.find(child => child.title === pathParts[index]);
        if (matchingChild) {
          currentId = matchingChild.id;
          navigateRecursive(index + 1);
        } else {
          updateBookmarksDisplay(currentId);
        }
      });
    }
  });
}

function displayBookmarks(bookmark) {
  const bookmarksList = document.getElementById('bookmarks-list');
  if (!bookmarksList) {
    return;
  }

  const fragment = document.createDocumentFragment();
  
  let itemsToDisplay = bookmark.children || [];
  
  itemsToDisplay.sort((a, b) => a.index - b.index);
  
  itemsToDisplay.forEach((child) => {
    if (child.url) {
      const card = createBookmarkCard(child, child.index);
      fragment.appendChild(card);
    } else {
      const folderCard = createFolderCard(child, child.index);
      fragment.appendChild(folderCard);
    }
  });
  
  bookmarksList.innerHTML = '';
  bookmarksList.appendChild(fragment);
  bookmarksList.dataset.parentId = bookmark.id;
  
  setupSortable();
}

function getColors(img) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0, img.width, img.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  let colors = {};

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a === 0) continue; // 跳过完全透明的像素
    const rgb = `${r},${g},${b}`;
    colors[rgb] = (colors[rgb] || 0) + 1;
  }

  const sortedColors = Object.entries(colors).sort((a, b) => b[1] - a[1]);
  
  if (sortedColors.length === 0) {
    // 如果图片完全透明，返回默认颜色
    return { primary: [200, 200, 200], secondary: [220, 220, 220] };
  }
  
  const primaryColor = sortedColors[0][0].split(',').map(Number);
  const secondaryColor = sortedColors.length > 1 
    ? sortedColors[1][0].split(',').map(Number)
    : primaryColor.map(c => Math.min(255, c + 20)); // 如果只有一种颜色，创建一个稍微亮的次要颜色

  return { primary: primaryColor, secondary: secondaryColor };
}

function createBookmarkCard(bookmark, index) {
  const card = document.createElement('a');
  card.href = bookmark.url;
  card.className = 'bookmark-card card';
  card.dataset.id = bookmark.id;
  card.dataset.parentId = bookmark.parentId;
  card.dataset.index = index.toString();

  const img = document.createElement('img');
  img.className = 'w-6 h-6 mr-2';
  img.src = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(bookmark.url)}&size=32`;

  // 尝试从缓存中获取颜色
  const cachedColors = localStorage.getItem(`bookmark-colors-${bookmark.id}`);
  if (cachedColors) {
    const colors = JSON.parse(cachedColors);
    applyColors(card, colors);
  } else {
    // 如果缓存中没有，则计算颜色
    img.onload = function () {
      const colors = getColors(img);
      applyColors(card, colors);
      // 缓存计算结果
      localStorage.setItem(`bookmark-colors-${bookmark.id}`, JSON.stringify(colors));
    };

    img.onerror = function () {
      const defaultColors = {
        primary: [200, 200, 200],
        secondary: [220, 220, 220]
      };
      applyColors(card, defaultColors);
      // 缓存默认颜色
      localStorage.setItem(`bookmark-colors-${bookmark.id}`, JSON.stringify(defaultColors));
    };
  }

  const content = document.createElement('div');
  content.className = 'card-content';

  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = bookmark.title;

  content.appendChild(title);
  card.appendChild(img);
  card.appendChild(content);

  card.addEventListener('contextmenu', function(event) {
    event.preventDefault();
    showContextMenu(event, bookmark);
  });

  // 添加鼠标悬停效果
  card.addEventListener('mouseenter', function() {
    this.style.transform = 'scale(1.03)';
    this.style.boxShadow = '0 1px 1px rgba(0,0,0,0.01)';
    this.style.backgroundColor = 'rgba(255,255,255,1)';
  });

  card.addEventListener('mouseleave', function() {
    this.style.transform = 'scale(1)';
    this.style.boxShadow = '';
    this.style.backgroundColor = '';
  });

  return card;
}

function adjustColor(r, g, b) {
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  let factor = 1;

  if (brightness < 128) {
    // 如果颜色太暗，增加亮度
    factor = 1 + (128 - brightness) / 128;
  } else if (brightness > 200) {
    // 如果颜色太亮，减少亮度
    factor = 1 - (brightness - 200) / 55;
  }

  return {
    r: Math.min(255, Math.round(r * factor)),
    g: Math.min(255, Math.round(g * factor)),
    b: Math.min(255, Math.round(b * factor))
  };
}

function updateBookmarkColors(bookmark, img, card) {
  img.onload = function () {
    const colors = getColors(img);
    applyColors(card, colors);
    // 缓存计算结果和 URL
    localStorage.setItem(`bookmark-data-${bookmark.id}`, JSON.stringify({
      url: bookmark.url,
      colors: colors
    }));
  };

  img.onerror = function () {
    const defaultColors = {
      primary: [200, 200, 200],
      secondary: [220, 220, 220]
    };
    applyColors(card, defaultColors);
    // 缓存默认颜色和 URL
    localStorage.setItem(`bookmark-data-${bookmark.id}`, JSON.stringify({
      url: bookmark.url,
      colors: defaultColors
    }));
  };
}

function applyColors(card, colors) {
  const adjustedPrimary = adjustColor(colors.primary[0], colors.primary[1], colors.primary[2]);
  const adjustedSecondary = adjustColor(colors.secondary[0], colors.secondary[1], colors.secondary[2]);
  card.style.background = `linear-gradient(135deg, rgba(${adjustedPrimary.r}, ${adjustedPrimary.g}, ${adjustedPrimary.b}, 0.06), rgba(${adjustedSecondary.r}, ${adjustedSecondary.g}, ${adjustedSecondary.b}, 0.06))`;
  card.style.border = `1px solid rgba(${adjustedPrimary.r}, ${adjustedPrimary.g}, ${adjustedPrimary.b}, 0.01)`;
}

function openInNewWindow(url) {
  chrome.windows.create({ url: url }, function (window) {
    console.log('New window opened with id: ' + window.id);
  });
}

function openInIncognito(url) {
  chrome.windows.create({ url: url, incognito: true }, function (window) {
    console.log('New incognito window opened with id: ' + window.id);
  });
}

// Encapsulate toast and bookmark link copier functionality in a closure
const Utilities = (function() {
  let toastTimeout;

  function showToast(message = getLocalizedMessage('moreSearchSupportToast'), duration = 1500) {
    const toast = document.getElementById('more-button-toast');
    if (!toast) {
      console.error('Toast element not found');
      return;
    }

    // If toast is already showing, clear the previous timeout
    if (toast.classList.contains('show')) {
      clearTimeout(toastTimeout);
      toast.classList.remove('show');
      setTimeout(() => showToast(message, duration), 300); // Try showing again after a short delay
      return;
    }

    const toastMessage = toast.querySelector('p');
    if (toastMessage) {
      toastMessage.textContent = message;
    }

    toast.classList.add('show');

    toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }

  function copyBookmarkLink(bookmark) {
    try {
      if (!bookmark || !bookmark.url) {
        throw new Error('No valid bookmark link found');
      }
      navigator.clipboard.writeText(bookmark.url).then(() => {
        showToast(getLocalizedMessage('linkCopied'));
      }).catch(err => {
        console.error('Failed to copy link:', err);
        showToast(getLocalizedMessage('copyLinkFailed'));
      });
    } catch (error) {
      console.error('Error copying bookmark link:', error);
      if (error.message === 'Extension context invalidated.') {
        showToast(getLocalizedMessage('extensionReloaded'));
      } else {
        showToast(getLocalizedMessage('copyLinkFailed'));
      }
    }
  }

  return {
    showToast: showToast,
    copyBookmarkLink: copyBookmarkLink
  };
})();

function deleteBookmark(bookmarkId, bookmarkTitle) {
  chrome.bookmarks.remove(bookmarkId, function() {
    if (chrome.runtime.lastError) {
      console.error('Error deleting bookmark:', chrome.runtime.lastError);
      Utilities.showToast(getLocalizedMessage('deleteBookmarkError'));
    } else {
      console.log(`Bookmark deleted: ID=${bookmarkId}, Title=${bookmarkTitle}`);
      Utilities.showToast(getLocalizedMessage('bookmarkDeleted'));
      
      // 更新显示
      const parentId = document.getElementById('bookmarks-list').dataset.parentId;
      updateBookmarksDisplay(parentId);
    }
  });
}

function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) {
    console.error('Toast element not found');
    return;
  }
  toast.textContent = message;
  toast.style.display = 'block';
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.style.display = 'none';
    }, 300);
  }, duration);
}

function showConfirmDialog(message, onConfirm) {
  const confirmDialog = document.getElementById('confirm-dialog');
  const confirmDialogMessage = document.getElementById('confirm-dialog-message');
  const confirmDeleteButton = document.getElementById('confirm-delete-button');
  const cancelDeleteButton = document.getElementById('cancel-delete-button');

  // 使用传入的 message 参数设置对话框消息
  confirmDialogMessage.innerHTML = message.replace(/(\b书签名\b|\b文件夹名\b)/g, '<strong>$1</strong>');
  confirmDialog.style.display = 'block';

  confirmDeleteButton.onclick = () => {
    onConfirm();
    confirmDialog.style.display = 'none';
  };

  cancelDeleteButton.onclick = () => {
    confirmDialog.style.display = 'none';
  };
}

function showContextMenu(event, bookmark) {
  const contextMenu = document.getElementById('context-menu');
  if (!contextMenu) return;

  contextMenu.style.display = 'block';
  contextMenu.style.left = `${event.clientX}px`;
  contextMenu.style.top = `${event.clientY}px`;

  // Clear existing menu items
  contextMenu.innerHTML = '';

  // Add menu items
  const menuItems = [
    { text: getLocalizedMessage('openInNewTab'), icon: 'open_in_new', action: () => window.open(bookmark.url, '_blank') },
    { text: getLocalizedMessage('openInNewWindow'), icon: 'launch', action: () => openInNewWindow(bookmark.url) },
    { text: getLocalizedMessage('openInIncognito'), icon: 'visibility_off', action: () => openInIncognito(bookmark.url) },
    { text: getLocalizedMessage('editQuickLink'), icon: 'edit', action: () => openEditDialog(bookmark) },
    { text: getLocalizedMessage('deleteQuickLink'), icon: 'delete', action: () => showConfirmDialog(chrome.i18n.getMessage("confirmDeleteBookmark", [`<strong>${bookmark.title}</strong>`]), () => deleteBookmark(bookmark.id, bookmark.title)) },
    { text: getLocalizedMessage('copyLink'), icon: 'content_copy', action: () => {
        Utilities.copyBookmarkLink(bookmark);
      }
    },
    { text: getLocalizedMessage('createQRCode'), icon: 'qr_code_2', action: () => createQRCode(bookmark.url, bookmark.title) }
  ];

  menuItems.forEach(item => {
    const menuItem = document.createElement('div');
    menuItem.className = 'context-menu-item';
    menuItem.innerHTML = item.text;
    menuItem.addEventListener('click', () => {
      item.action();
      contextMenu.style.display = 'none';
    });
    contextMenu.appendChild(menuItem);
  });

  // Close menu when clicking outside
  document.addEventListener('click', function closeMenu(e) {
    if (!contextMenu.contains(e.target)) {
      contextMenu.style.display = 'none';
      document.removeEventListener('click', closeMenu);
    }
  });
}

function createFolderCard(folder, index) {
  const card = document.createElement('div');
  card.className = 'bookmark-folder card';
  card.dataset.id = folder.id;
  card.dataset.parentId = folder.parentId;
  card.dataset.index = index.toString();

  const folderIcon = document.createElement('span');
  folderIcon.className = 'material-icons mr-2';
  folderIcon.textContent = 'folder';

  const content = document.createElement('div');
  content.className = 'card-content';

  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = folder.title;

  content.appendChild(title);
  card.appendChild(folderIcon);
  card.appendChild(content);

  card.addEventListener('click', (event) => {
    event.preventDefault();
    updateBookmarksDisplay(folder.id);
  });

  return card;
}

function setupSortable() {
  const bookmarksList = document.getElementById('bookmarks-list');
  if (bookmarksList) {
    new Sortable(bookmarksList, {
      animation: 150,
      onEnd: function (evt) {
        const itemId = evt.item.dataset.id;
        const newParentId = bookmarksList.dataset.parentId;
        const newIndex = evt.newIndex;

        showMovingFeedback(evt.item);

        moveBookmark(itemId, newParentId, newIndex)
          .then(() => {
            hideMovingFeedback(evt.item);
            showSuccessFeedback(evt.item);
          })
          .catch(error => {
            console.error('Error moving bookmark:', error);
            hideMovingFeedback(evt.item);
            showErrorFeedback(evt.item);
            syncBookmarkOrder(newParentId);
          });
      }
    });
  } else {
    console.error('Bookmarks list element not found');
  }

  const categoriesList = document.getElementById('categories-list');
  if (categoriesList) {
    new Sortable(categoriesList, {
      animation: 150,
      group: 'nested',
      fallbackOnBody: true,
      swapThreshold: 0.65,
      onStart: function (evt) {
        console.log('Category drag started:', evt.item.dataset.id);
      },
      onEnd: function (evt) {
        const itemEl = evt.item;
        const newIndex = evt.newIndex;
        const bookmarkId = itemEl.dataset.id;
        const newParentId = evt.to.closest('li') ? evt.to.closest('li').dataset.id : '1';

        console.log('Category moved:', {
          bookmarkId: bookmarkId,
          newParentId: newParentId,
          oldIndex: evt.oldIndex,
          newIndex: newIndex,
          fromList: evt.from.id,
          toList: evt.to.id
        });

        if (evt.oldIndex !== evt.newIndex || evt.from !== evt.to) {
          moveBookmark(bookmarkId, newParentId, newIndex);
        }
      }
    });

    const folders = categoriesList.querySelectorAll('li ul');
    folders.forEach((folder, index) => {
      new Sortable(folder, {
        group: 'nested',
        animation: 150,
        fallbackOnBody: true,
        swapThreshold: 0.65,
        onStart: function (evt) {
          console.log('Subfolder drag started:', evt.item.dataset.id);
        },
        onEnd: function (evt) {
          const itemEl = evt.item;
          const newIndex = evt.newIndex;
          const bookmarkId = itemEl.dataset.id;
          const newParentId = evt.to.closest('li') ? evt.to.closest('li').dataset.id : '1';

          console.log('Subfolder item moved:', {
            bookmarkId: bookmarkId,
            newParentId: newParentId,
            oldIndex: evt.oldIndex,
            newIndex: newIndex,
            fromList: evt.from.id,
            toList: evt.to.id
          });

          if (evt.oldIndex !== evt.newIndex || evt.from !== evt.to) {
            moveBookmark(bookmarkId, newParentId, newIndex);
          }
        }
      });
    });
  } else {
    console.error('Categories list element not found');
  }
}

function moveBookmark(itemId, newParentId, newIndex) {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.move(itemId, { index: newIndex }, (result) => {
      if (chrome.runtime.lastError) {
        console.error('Error moving bookmark:', chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
      } else {
        console.log(`Bookmark ${itemId} moved to index ${result.index}`);
        updateAffectedBookmarks(newParentId, itemId, result.index)
          .then(() => {
            console.log(`Bookmark ${itemId} position updated in UI`);
            resolve(result);
          })
          .catch(reject);
      }
    });
  });
}

function updateAffectedBookmarks(parentId, movedItemId, newIndex) {
  return new Promise((resolve, reject) => {
    const bookmarksList = document.getElementById('bookmarks-list');
    const bookmarkElements = Array.from(bookmarksList.children);
    const movedElement = bookmarksList.querySelector(`[data-id="${movedItemId}"]`);
    
    if (!movedElement) {
      console.error('Moved element not found');
      reject(new Error('Moved element not found'));
      return;
    }

    const oldIndex = bookmarkElements.indexOf(movedElement);
    
    // 如置没有变化，不需要更新
    if (oldIndex === newIndex) {
      resolve();
      return;
    }

    // 移动元素到新位置
    if (newIndex >= bookmarkElements.length) {
      bookmarksList.appendChild(movedElement);
    } else {
      bookmarksList.insertBefore(movedElement, bookmarksList.children[newIndex]);
    }

    // 更新所有书签的索引
    bookmarkElements.forEach((element, index) => {
      element.dataset.index = index.toString();
    });

    // 更新本地缓存
    bookmarkOrderCache[parentId] = bookmarkElements.map(el => el.dataset.id);

    highlightBookmark(movedItemId);
    console.log(`UI updated: Bookmark ${movedItemId} moved from ${oldIndex} to ${newIndex}`);
    resolve();
  });
}

function highlightBookmark(itemId) {
  const bookmarkElement = document.querySelector(`[data-id="${itemId}"]`);
  if (bookmarkElement) {
    bookmarkElement.style.transition = 'background-color 0.5s ease';
    bookmarkElement.style.backgroundColor = '#ffff99';
    setTimeout(() => {
      bookmarkElement.style.backgroundColor = '';
    }, 1000);
  }
}

function displayBookmarkCategories(bookmarkNodes, level, parentUl, parentId) {
  const categoriesList = parentUl || document.getElementById('categories-list');

  if (parentId === '1') {
    categoriesList.style.display = 'block';
  }

  bookmarkNodes.forEach(function (bookmark) {
    if (bookmark.children && bookmark.children.length > 0) {
      let li = document.createElement('li');
      li.className = 'cursor-pointer p-2 hover:bg-emerald-500 rounded-lg flex items-center folder-item';
      li.style.paddingLeft = `${(level * 20) + 8}px`;
      li.dataset.title = bookmark.title;
      li.dataset.id = bookmark.id;

      let span = document.createElement('span');
      span.textContent = bookmark.title;

      const folderIcon = document.createElement('span');
      folderIcon.className = 'material-icons mr-2';
      folderIcon.textContent = 'folder';
      li.insertBefore(folderIcon, li.firstChild);

      const hasSubfolders = bookmark.children.some(child => child.children);
      let arrowIcon;
      if (hasSubfolders) {
        arrowIcon = document.createElement('span');
        arrowIcon.className = 'material-icons ml-auto';
        arrowIcon.textContent = 'chevron_right';
        li.appendChild(arrowIcon);
      }

      let sublist = document.createElement('ul');
      sublist.className = 'pl-4 space-y-2';

      sublist.style.display = 'none';

      li.addEventListener('click', function (event) {
        event.stopPropagation();
        if (hasSubfolders) {
          let isExpanded = sublist.style.display === 'block';
          sublist.style.display = isExpanded ? 'none' : 'block';
          if (arrowIcon) {
            arrowIcon.textContent = isExpanded ? 'chevron_right' : 'expand_less';
          }
        }

        document.querySelectorAll('#categories-list li').forEach(function (item) {
          item.classList.remove('bg-emerald-500');
        });
        li.classList.add('bg-emerald-500');

        updateBookmarksDisplay(bookmark.id);
      });

      li.appendChild(span);
      categoriesList.appendChild(li);
      categoriesList.appendChild(sublist);

      displayBookmarkCategories(bookmark.children, level + 1, sublist, bookmark.id);
    }
  });

  setupSortable();
}

function createBookmarkFolderContextMenu() {
  const menu = document.createElement('div');
  menu.className = 'custom-context-menu';
  document.body.appendChild(menu);

  const menuItems = [
    { text: getLocalizedMessage('rename'), icon: 'edit' },
    { text: getLocalizedMessage('delete'), icon: 'delete' },
    { text: getLocalizedMessage('setAsHomepage'), icon: 'home' }
  ];

  menuItems.forEach(item => {
    const menuItem = document.createElement('div');
    menuItem.className = 'custom-context-menu-item';
    
    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.textContent = item.icon;
    icon.style.marginRight = '8px';
    icon.style.fontSize = '18px';
    
    const text = document.createElement('span');
    text.textContent = item.text;

    menuItem.appendChild(icon);
    menuItem.appendChild(text);

    menuItem.addEventListener('click', function() {
      switch(item.text) {
        case getLocalizedMessage('rename'):
          openEditBookmarkFolderDialog(currentBookmarkFolder);
          break;
        case getLocalizedMessage('delete'):
          const folderId = currentBookmarkFolder.dataset.id;
          const folderTitle = currentBookmarkFolder.querySelector('.card-title').textContent;
          showConfirmDialog(chrome.i18n.getMessage("confirmDeleteFolder", [`<strong>${folderTitle}</strong>`]), () => {
            chrome.bookmarks.removeTree(folderId, () => {
              currentBookmarkFolder.remove();
              console.log(`Folder deleted: ${folderTitle}`);
            });
          });
          break;
        case getLocalizedMessage('setAsHomepage'):
          const homeFolderId = currentBookmarkFolder.dataset.id;
          console.log('Setting home folder:', homeFolderId);
          setDefaultBookmark(homeFolderId);
          break;
      }
      menu.style.display = 'none';
    });

    menu.appendChild(menuItem);
  });

  return menu;
}

let currentBookmarkFolder = null;
const bookmarkFolderContextMenu = createBookmarkFolderContextMenu();

document.addEventListener('contextmenu', function (event) {
  const targetFolder = event.target.closest('.bookmark-folder');
  if (targetFolder) {
    event.preventDefault();
    currentBookmarkFolder = targetFolder;
    bookmarkFolderContextMenu.style.top = `${event.clientY}px`;
    bookmarkFolderContextMenu.style.left = `${event.clientX}px`;
    bookmarkFolderContextMenu.style.display = 'block';
  } else {
    bookmarkFolderContextMenu.style.display = 'none';
  }
});

document.addEventListener('click', function () {
  bookmarkFolderContextMenu.style.display = 'none';
});

function openEditBookmarkFolderDialog(folderElement) {
  const folderId = folderElement.dataset.id;
  const folderTitle = folderElement.querySelector('.card-title').textContent;

  const editCategoryNameInput = document.getElementById('edit-category-name');
  const editCategoryDialog = document.getElementById('edit-category-dialog');
  const editCategoryForm = document.getElementById('edit-category-form');

  editCategoryNameInput.value = folderTitle;
  editCategoryDialog.style.display = 'block';

  editCategoryForm.onsubmit = function (event) {
    event.preventDefault();
    const newTitle = editCategoryNameInput.value;
    chrome.bookmarks.update(folderId, { title: newTitle }, function () {
      console.log('Bookmark updated:', folderId, newTitle);
      updateCategoryUI(folderId, newTitle);
      updateFolderName(folderId);
      editCategoryDialog.style.display = 'none';
    });
  };
}

function updateCategoryUI(folderId, newTitle) {
  console.log('Updating UI for folder:', folderId, newTitle);

  // 更新侧边栏中的文件夹名称
  const sidebarItem = document.querySelector(`#categories-list li[data-id="${folderId}"]`);
  if (sidebarItem) {
    // 更新文本内
    const textSpan = sidebarItem.querySelector('span:not(.material-icons)');
    if (textSpan) {
      textSpan.textContent = newTitle;
      console.log('Updated sidebar item text:', newTitle);
    }

    // 更新 data-title 属性
    sidebarItem.setAttribute('data-title', newTitle);

    // 更新样式
    sidebarItem.classList.add('updated-folder');
    setTimeout(() => {
      sidebarItem.classList.remove('updated-folder');
    }, 2000); // 2秒后移除高亮效果

    console.log('Updated sidebar item:', sidebarItem);
  } else {
    console.log('Sidebar item not found for folder:', folderId);
  }

  // 更新面包屑导航
  updateFolderName(folderId);

  // 更新文件夹卡片（如果在当前视图中）
  const folderCard = document.querySelector(`.bookmark-folder[data-id="${folderId}"]`);
  if (folderCard) {
    const titleElement = folderCard.querySelector('.card-title');
    if (titleElement) {
      titleElement.textContent = newTitle;
      console.log('Updated folder card:', newTitle);
    }
  }

  console.log('UI update complete for folder:', folderId);
}



function showFolder(folderId) {
  // 显示侧边栏的文件夹
  const sidebarFolderElement = document.querySelector(`#categories-list li[data-id="${folderId}"]`);
  if (sidebarFolderElement) {
    sidebarFolderElement.style.display = '';
    // 如果文夹之前是展开的，显示其子列表
    const sublist = sidebarFolderElement.nextElementSibling;
    if (sublist && sublist.tagName === 'UL') {
      sublist.style.display = '';

    }
  } else {
    console.log('Sidebar folder element not found');
  }

  // 显示内容区域中的文件夹内容（如果当前显示的是该文件夹的内容）
  const bookmarksList = document.getElementById('bookmarks-list');
  if (bookmarksList.dataset.parentId === folderId) {
    bookmarksList.style.display = '';

  }

  // 显示文件夹卡片
  const folderCard = document.querySelector(`.bookmark-folder[data-id="${folderId}"]`);
  if (folderCard) {
    folderCard.style.display = '';

  } else {
    console.log('Folder card not found');
  }
}

function setDefaultBookmark(bookmarkId) {

  localStorage.setItem('defaultBookmarkId', bookmarkId);
  updateDefaultBookmarkIndicator();
  selectSidebarFolder(bookmarkId);


  // 刷新 bookmarks-container
  updateBookmarksDisplay(bookmarkId);

  // 更新侧边栏中的默认书签指示器和选中状态
  updateSidebarDefaultBookmarkIndicator();

  // 通知背景脚本更新默认书签ID
  chrome.runtime.sendMessage({ action: 'setDefaultBookmarkId', defaultBookmarkId: bookmarkId }, function (response) {
    if (response && response.success) {
      console.log('Background script has updated the defaultBookmarkId');
    }
  });
}

function updateSidebarDefaultBookmarkIndicator() {
  const defaultBookmarkId = localStorage.getItem('defaultBookmarkId');
  console.log('Updating sidebar indicator for:', defaultBookmarkId);
  selectSidebarFolder(defaultBookmarkId);
  
  const allCategories = document.querySelectorAll('#categories-list li');
  allCategories.forEach(category => {
    const indicator = category.querySelector('.default-indicator');
    if (indicator) {
      indicator.remove();
    }
    if (category.dataset.id === defaultBookmarkId) {
      console.log('Adding indicator to:', category.dataset.id);
      const defaultIndicator = document.createElement('span');
      defaultIndicator.className = 'default-indicator material-icons';
      defaultIndicator.textContent = 'star';
      defaultIndicator.title = getLocalizedMessage('homepage');
      category.appendChild(defaultIndicator);
    }
  });
}

// 添加局变量来存储本地缓存
let bookmarkOrderCache = {};

// 添加一函数来同步本地缓存和 Chrome 书签
function syncBookmarkOrder(parentId) {
  chrome.bookmarks.getChildren(parentId, (bookmarks) => {
    const chromeOrder = bookmarks.map(b => b.id);
    const cachedOrder = bookmarkOrderCache[parentId] || [];

    if (JSON.stringify(chromeOrder) !== JSON.stringify(cachedOrder)) {
      console.log('Bookmark order mismatch detected. Syncing...');
      
      // 使用 Chrome 的顺序更新缓存
      bookmarkOrderCache[parentId] = chromeOrder;

      // 重新排序 DOM 中的书签
      const bookmarksList = document.getElementById('bookmarks-list');
      const fragment = document.createDocumentFragment();
      chromeOrder.forEach(id => {
        const bookmarkElement = bookmarksList.querySelector(`[data-id="${id}"]`);
        if (bookmarkElement) {
          fragment.appendChild(bookmarkElement);
        }
      });
      bookmarksList.innerHTML = '';
      bookmarksList.appendChild(fragment);
    }
  });
}

// 添加一个定期同步函数
function startPeriodicSync() {
  setInterval(() => {
    const currentParentId = document.getElementById('bookmarks-list').dataset.parentId;
    syncBookmarkOrder(currentParentId);
  }, 30000); // 每30秒同步一次
}

let isRequestPending = false;

function setupSpecialLinks() {
  const specialLinks = document.querySelectorAll('.links-icons a, .settings-icon a');
  let isProcessingClick = false;

  specialLinks.forEach(link => {
    link.addEventListener('click', async function (e) {
      e.preventDefault();
      if (isProcessingClick) return;

      isProcessingClick = true;

      const href = this.getAttribute('href');
      let chromeUrl;
      switch (href) {
        case '#history':
          chromeUrl = 'chrome://history';
          break;
        case '#downloads':
          chromeUrl = 'chrome://downloads';
          break;
        case '#passwords':
          chromeUrl = 'chrome://settings/passwords';
          break;
        case '#extensions':
          chromeUrl = 'chrome://extensions';
          break;
        case '#settings':
          openSettingsModal();
          isProcessingClick = false; // 立即重置标志，因为不需要等待异步操作
          return; // 直接返回，不需要执行后面的代码
        default:
          console.error('Unknown special link:', href);
          isProcessingClick = false;
          return;
      }

      try {
        const response = await chrome.runtime.sendMessage({ action: 'openInternalPage', url: chromeUrl });
        if (response && response.success) {
          console.log('Successfully opened internal page:', response.message);
        } else if (response) {
          console.error('Failed to open internal page:', response.error);
        } else {
          console.error('No response received');
        }
      } catch (error) {
        console.error('Error opening internal page:', error);
      } finally {
        setTimeout(() => {
          isProcessingClick = false;
        }, 1000); // 添加一个短暂的延迟，防止快速重复点击
      }
    });
  });
}

// 在 DOMContentLoaded 事件中启定同步
document.addEventListener('DOMContentLoaded', function () {
  let currentBookmark = null; // 添加这行
  // ... 其他初始化代码 ...
  startPeriodicSync();
  // 处理特殊链接的点击事件
  setupSpecialLinks();
});

function updateDefaultBookmarkIndicator() {
  const defaultBookmarkId = localStorage.getItem('defaultBookmarkId');
  const allBookmarks = document.querySelectorAll('.bookmark-card, .bookmark-folder');
  allBookmarks.forEach(bookmark => {
    const indicator = bookmark.querySelector('.default-indicator');
    if (indicator) {
      indicator.remove();
    }
    if (bookmark.dataset.id === defaultBookmarkId) {
      const defaultIndicator = document.createElement('span');
      defaultIndicator.className = 'default-indicator material-icons';
      defaultIndicator.textContent = 'star';
      defaultIndicator.title = getLocalizedMessage('homepage');
      bookmark.appendChild(defaultIndicator);
    }
  });
}

function selectSidebarFolder(folderId) {
  const allFolders = document.querySelectorAll('#categories-list li');
  allFolders.forEach(folder => {
    folder.classList.remove('bg-emerald-500');
    if (folder.dataset.id === folderId) {
      folder.classList.add('bg-emerald-500');
    }
  });
}
function openSettingsModal() {
  const settingsModal = document.getElementById('settings-modal');
  if (settingsModal) {
    settingsModal.style.display = 'block';
    // 强制浏览器重新计算样式，确保模糊效果立即生效
    settingsModal.offsetHeight;
  } else {
    console.error('Settings modal not found');
  }
}
// 确保在 DOMContentLoaded 事件初始化上文菜单
document.addEventListener('DOMContentLoaded', function () {
  // ... 其他初始化代码 ...
  createBookmarkFolderContextMenu();
  // 获取模态对话框元素
  const settingsIcon = document.querySelector('.settings-icon a');
  const settingsModal = document.getElementById('settings-modal');
  const closeButton = document.querySelector('.settings-modal-close');
  const tabButtons = document.querySelectorAll('.settings-tab-button');
  const tabContents = document.querySelectorAll('.settings-tab-content');
  const bgOptions = document.querySelectorAll('.settings-bg-option');

  // 打开设置模态框
  settingsIcon.addEventListener('click', function (e) {
    e.preventDefault();
    settingsModal.style.display = 'block';
  });

  // 关闭设置模态框
  closeButton.addEventListener('click', function () {
    settingsModal.style.display = 'none';
  });

  // 点击模态框外部关闭
  window.addEventListener('click', function (e) {
    if (e.target === settingsModal) {
      settingsModal.style.display = 'none';
    }
  });

  // 标签切换
  tabButtons.forEach(button => {
    button.addEventListener('click', function () {
      const tabName = this.getAttribute('data-tab');

      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));

      this.classList.add('active');
      document.getElementById(`${tabName}-settings`).classList.add('active');
    });
  });

  // 背景颜色选择
  bgOptions.forEach(option => {
    option.addEventListener('click', function () {
      const bgClass = this.getAttribute('data-bg');
      document.documentElement.className = bgClass;
      // 移除这行，不需要重置 body 的类名
      // document.body.className = 'h-screen flex flex-col';

      bgOptions.forEach(opt => opt.classList.remove('active'));
      this.classList.add('active');

      // 保存选择到 localStorage
      localStorage.setItem('selectedBackground', bgClass);
    });
  });

  // 加载保存的背景颜色
  const savedBg = localStorage.getItem('selectedBackground');
  if (savedBg) {
    document.documentElement.className = savedBg;
    // 同样，这里不需要重置 body 的类名
    // document.body.className = 'h-screen flex flex-col';
    const activeOption = document.querySelector(`[data-bg="${savedBg}"]`);
    if (activeOption) {
      activeOption.classList.add('active');
    }
  } else {
    // 如果没有保存的背景，使用默认背景
    document.documentElement.className = 'gradient-background-7';
    const defaultOption = document.querySelector('[data-bg="gradient-background-7"]');
    if (defaultOption) {
      defaultOption.classList.add('active');
    }
  }
  const enableFloatingBallCheckbox = document.getElementById('enable-floating-ball');

  // 加载设置
  chrome.storage.sync.get(['enableFloatingBall'], function (result) {
    enableFloatingBallCheckbox.checked = result.enableFloatingBall !== false;
  });

  // 保存设置
  enableFloatingBallCheckbox.addEventListener('change', function() {
    const isEnabled = this.checked;
    chrome.runtime.sendMessage({action: 'updateFloatingBallSetting', enabled: isEnabled}, function(response) {
      if (response && response.success) {
        console.log('Floating ball setting updated successfully');
      } else {
        console.error('Failed to update floating ball setting');
      }
    });
  });
});


// 保留原有的DOMContentLoaded事件监听器，但移除其中的背景应用逻辑
document.addEventListener('DOMContentLoaded', function () {
  let currentBookmark = null; // 添加这行

  // 在页面加载完成后立即检查 folder-name 元素
  const folderNameElement = document.getElementById('folder-name');

  // 设置一个 MutationObserver 来监视 folder-name 元素的变化
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
    });
  });

  observer.observe(folderNameElement, { childList: true, subtree: true });

  function expandBookmarkTree(category) {
    let parent = category.parentElement;
    while (parent && parent.id !== 'categories-list') {
      if (parent.classList.contains('folder-item')) {
        const sublist = parent.nextElementSibling;
        if (sublist && sublist.tagName === 'UL') {
          sublist.style.display = 'block';
          const arrowIcon = parent.querySelector('.material-icons.ml-auto');
          if (arrowIcon) {
            arrowIcon.textContent = 'expand_less';
          }
        }
      }
      parent = parent.parentElement;
    }
  }

  function waitForFirstCategoryEdge(attemptsLeft) {
    waitForFirstCategory(attemptsLeft);
  }

  function findBookmarksByParentId(nodes, parentId) {
    if (!nodes) return [];
    let bookmarks = [];
    nodes.forEach(node => {
      if (node.parentId === parentId) {
        bookmarks.push(node);
      }
      if (node.children && node.children.length > 0) {
        bookmarks = bookmarks.concat(findBookmarksByParentId(node.children, parentId));
      }
    });
    return bookmarks;
  }

  function openCategory(category) {
    if (category && category.classList.contains('folder-item')) {
      document.querySelectorAll('#categories-list li').forEach(function (item) {
        item.classList.remove('bg-emerald-500');
      });
      category.classList.add('bg-emerald-500');

      if (category.dataset.id) {
        updateBookmarksDisplay(category.dataset.id);
      }
    }
  }
  function isEdgeBrowser() {
    return /Edg/.test(navigator.userAgent);
  }

  if (isEdgeBrowser()) {
    waitForFirstCategoryEdge(10);
  } else {
    waitForFirstCategory(10);
  }

  const toggleSidebarButton = document.getElementById('toggle-sidebar');
  const sidebarContainer = document.getElementById('sidebar-container');

  // 读保存的侧边栏状态
  const isSidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';

  // 初状
  function setSidebarState(isCollapsed) {
    if (isCollapsed) {
      sidebarContainer.classList.add('collapsed');
      toggleSidebarButton.textContent = '>';
      toggleSidebarButton.style.left = '2rem'; // 收起时的位置
    } else {
      sidebarContainer.classList.remove('collapsed');
      toggleSidebarButton.textContent = '<';
      toggleSidebarButton.style.left = '14.75rem'; // 展开时的位置
    }
  }

  // 应用初始状态
  setSidebarState(isSidebarCollapsed);

  // 切换侧边状态的函数
  function toggleSidebar() {
    const isCollapsed = sidebarContainer.classList.toggle('collapsed');
    setSidebarState(isCollapsed);
    localStorage.setItem('sidebarCollapsed', isCollapsed);
  }

  // 添加点击事件监听器
  toggleSidebarButton.addEventListener('click', toggleSidebar);

  document.addEventListener('click', function (event) {
    if (event.target.closest('#categories-list li')) {
      updateBookmarkCards();
    }
  });

  updateBookmarkCards();

  function createContextMenu() {
    const menu = document.createElement('div');
    menu.className = 'custom-context-menu';
    document.body.appendChild(menu);

    const menuItems = [
      { text: getLocalizedMessage('openInNewTab'), icon: 'open_in_new', action: () => window.open(currentBookmark.url, '_blank') },
      { text: getLocalizedMessage('openInNewWindow'), icon: 'launch', action: () => openInNewWindow(currentBookmark.url) },
      { text: getLocalizedMessage('openInIncognito'), icon: 'visibility_off', action: () => openInIncognito(currentBookmark.url) },
      { text: getLocalizedMessage('editQuickLink'), icon: 'edit', action: () => openEditDialog(currentBookmark) },
      { text: getLocalizedMessage('deleteQuickLink'), icon: 'delete', action: () => showConfirmDialog(chrome.i18n.getMessage("confirmDeleteBookmark", [`<strong>${currentBookmark.title}</strong>`]), () => deleteBookmark(currentBookmark.id, currentBookmark.title)) },
      { text: getLocalizedMessage('copyLink'), icon: 'content_copy', action: () => {
          Utilities.copyBookmarkLink(currentBookmark);
        }
      },
      { text: getLocalizedMessage('createQRCode'), icon: 'qr_code_2', action: () => createQRCode(currentBookmark.url, currentBookmark.title) }
    ];

    menuItems.forEach((item, index) => {
      const menuItem = document.createElement('div');
      menuItem.className = 'custom-context-menu-item';
      
      const icon = document.createElement('span');
      icon.className = 'material-icons';
      icon.textContent = item.icon;
      icon.style.marginRight = '8px';
      icon.style.fontSize = '18px';
      
      const text = document.createElement('span');
      text.textContent = item.text;

      menuItem.appendChild(icon);
      menuItem.appendChild(text);

      menuItem.addEventListener('click', function() {
        // 这里添加每个菜单项点击件理
        item.action();
        menu.style.display = 'none';
      });

      if (index === 3 || index === 5) {
        const divider = document.createElement('div');
        divider.className = 'custom-context-menu-divider';
        menu.appendChild(divider);
      }

      menu.appendChild(menuItem);
    });

    return menu;
  }

  // 创建二维码的函数
  function createQRCode(url, bookmarkName) {
    // 创建一个模态来显维码
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

    // 添加关闭钮
    const closeButton = document.createElement('span');
    closeButton.textContent = '×';
    closeButton.style.position = 'absolute';
    closeButton.style.right = '10px';
    closeButton.style.top = '10px';
    closeButton.style.fontSize = '20px';
    closeButton.style.cursor = 'pointer';
    closeButton.onclick = () => document.body.removeChild(modal);
    qrContainer.appendChild(closeButton);

    // 添加标
    const title = document.createElement('h2');
    title.textContent = getLocalizedMessage('scanQRCode');
    title.style.marginBottom = '20px';
    title.style.fontWeight = '600';
    title.style.fontSize = '0.875rem';
    qrContainer.appendChild(title);

    // 创建 QR 码容
    const qrCodeElement = document.createElement('div');
    qrContainer.appendChild(qrCodeElement);

    // 添 URL 显示
    const urlDisplay = document.createElement('div');
    urlDisplay.textContent = url;
    urlDisplay.style.marginTop = '20px';
    urlDisplay.style.wordBreak = 'break-all';
    urlDisplay.style.maxWidth = '300px';
    urlDisplay.style.textAlign = 'center';
    qrContainer.appendChild(urlDisplay);

    // 添按容器
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

  const contextMenu = createContextMenu();

  document.addEventListener('contextmenu', function (event) {
    const targetCard = event.target.closest('.bookmark-card');
    if (targetCard) {
      event.preventDefault();
      currentBookmark = {
        id: targetCard.dataset.id,
        url: targetCard.href,
        title: targetCard.querySelector('.card-title').textContent
      };
      contextMenu.style.top = `${event.clientY}px`;
      contextMenu.style.left = `${event.clientX}px`;
      contextMenu.style.display = 'block';
    } else {
      contextMenu.style.display = 'none';
    }
  });

  document.addEventListener('click', function () {
    contextMenu.style.display = 'none';
  });

  const editDialog = document.getElementById('edit-dialog');
  const editForm = document.getElementById('edit-form');
  const editNameInput = document.getElementById('edit-name');
  const editUrlInput = document.getElementById('edit-url');
  const closeButton = document.querySelector('.close-button');
  const cancelButton = document.querySelector('.cancel-button');

  function openEditDialog(bookmark) {
    const bookmarkId = bookmark.id;
    const bookmarkTitle = bookmark.title;
    const bookmarkUrl = bookmark.url;

    document.getElementById('edit-name').value = bookmarkTitle;
    document.getElementById('edit-url').value = bookmarkUrl;

    const editDialog = document.getElementById('edit-dialog');
    editDialog.style.display = 'block';

    // 设置提交事件
    document.getElementById('edit-form').onsubmit = function (event) {
      event.preventDefault();
      const newTitle = document.getElementById('edit-name').value;
      const newUrl = document.getElementById('edit-url').value;
      chrome.bookmarks.update(bookmarkId, { title: newTitle, url: newUrl }, function () {
        editDialog.style.display = 'none';

        // 更新特定的书签卡片
        updateSpecificBookmarkCard(bookmarkId, newTitle, newUrl);
      });
    };

    // 添加取消按钮的事件监听
    document.querySelector('.cancel-button').addEventListener('click', function () {
      editDialog.style.display = 'none';
    });

    // 添加关闭按钮的事件监听
    document.querySelector('.close-button').addEventListener('click', function () {
      editDialog.style.display = 'none';
    });
  }

  function updateSpecificBookmarkCard(bookmarkId, newTitle, newUrl) {
    const bookmarkCard = document.querySelector(`.bookmark-card[data-id="${bookmarkId}"]`);
    if (bookmarkCard) {
      bookmarkCard.href = newUrl;
      bookmarkCard.querySelector('.card-title').textContent = newTitle;

      // 更新 favicon 和颜色
      const img = bookmarkCard.querySelector('img');
      updateBookmarkCardColors(bookmarkCard, newUrl, img);
    }
  }

  function updateBookmarkCardColors(bookmarkCard, newUrl, img) {
    // 清除旧的缓存
    localStorage.removeItem(`bookmark-colors-${bookmarkCard.dataset.id}`);
    
    // 更新 favicon URL
    img.src = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(newUrl)}&size=32&t=${Date.now()}`;
    
    img.onload = function () {
      const colors = getColors(img);
      applyColors(bookmarkCard, colors);
      localStorage.setItem(`bookmark-colors-${bookmarkCard.dataset.id}`, JSON.stringify(colors));
    };
    
    img.onerror = function () {
      const defaultColors = { primary: [200, 200, 200], secondary: [220, 220, 220] };
      applyColors(bookmarkCard, defaultColors);
      localStorage.setItem(`bookmark-colors-${bookmarkCard.dataset.id}`, JSON.stringify(defaultColors));
    };
  }

  closeButton.onclick = function () {
    editDialog.style.display = 'none';
  };

  cancelButton.onclick = function () {
    editDialog.style.display = 'none';
  };

  window.onclick = function (event) {
    if (event.target == editDialog) {
      editDialog.style.display = 'none';
    }
  };

  function findBookmarkNodeByTitle(nodes, title) {
    for (let node of nodes) {
      if (node.title === title) {
        return node;
      } else if (node.children) {
        const result = findBookmarkNodeByTitle(node.children, title);
        if (result) {
          return result;
        }
      }
    }
    return null;
  }



  // 调用 updateBookmarkCards
  updateBookmarkCards();

  function expandToBookmark(bookmarkId) {
    setTimeout(() => {
      const bookmarkElement = document.querySelector(`#categories-list li[data-id="${bookmarkId}"]`);
      if (bookmarkElement) {
        let parent = bookmarkElement.parentElement;
        while (parent && parent.id !== 'categories-list') {
          if (parent.classList.contains('folder-item')) {
            parent.classList.add('expanded');
            const sublist = parent.querySelector('ul');
            if (sublist) sublist.style.display = 'block';
          }
          parent = parent.parentElement;
        }
        bookmarkElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        bookmarkElement.style.animation = 'highlight 1s';
      }
    }, 100); // 给予一些 DOM 更新
  }

  function getFavicon(url, callback) {
    const domain = new URL(url).hostname;

    chrome.bookmarks.search({ url: url }, function (results) {
      if (results && results.length > 0) {
        const faviconURL = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`;
        const img = new Image();
        img.onload = function () {
          callback(faviconURL);
        };
        img.onerror = function () {
          fetchFaviconOnline(domain, callback);
        };
        img.src = faviconURL;
      } else {
        fetchFaviconOnline(domain, callback);
      }
    });
  }

  function fetchFaviconOnline(domain, callback) {
    const faviconUrls = [
      `https://www.google.com/s2/favicons?domain=${domain}`,
    ];

    let faviconUrl = faviconUrls[0];
    const img = new Image();
    img.onload = function () {
      cacheFavicon(domain, faviconUrl);
      callback(faviconUrl);
    };
    img.onerror = function () {
      faviconUrls.shift();
      if (faviconUrls.length > 0) {
        faviconUrl = faviconUrls[0];
        img.src = faviconUrl;
      } else {
        callback('');
      }
    };
    img.src = faviconUrl;
  }

  function cacheFavicon(domain, faviconUrl) {
    const data = {};
    data[domain] = faviconUrl;
    chrome.storage.local.set(data);
  }

  let currentCategory = null;

  function createCategoryContextMenu() {
    const menu = document.createElement('div');
    menu.className = 'custom-context-menu';
    document.body.appendChild(menu);

    const menuItems = [
      { text: getLocalizedMessage('rename'), icon: 'edit' },
      { text: getLocalizedMessage('delete'), icon: 'delete' },
      { text: getLocalizedMessage('setAsHomepage'), icon: 'home' }
    ];

    menuItems.forEach(item => {
      const menuItem = document.createElement('div');
      menuItem.className = 'custom-context-menu-item';
      
      const icon = document.createElement('span');
      icon.className = 'material-icons';
      icon.textContent = item.icon;
      icon.style.marginRight = '8px';
      icon.style.fontSize = '18px';
      
      const text = document.createElement('span');
      text.textContent = item.text;

      menuItem.appendChild(icon);
      menuItem.appendChild(text);

      menuItem.addEventListener('click', function() {
        switch(item.text) {
          case getLocalizedMessage('rename'):
            openEditCategoryDialog(currentCategory);
            break;
          case getLocalizedMessage('delete'):
            const categoryId = currentCategory.dataset.id;
            const categoryTitle = currentCategory.dataset.title;
            showConfirmDialog(chrome.i18n.getMessage("confirmDeleteFolder", [`<strong>${categoryTitle}</strong>`]), () => {
              // 使用 let 声明，确保变量在正确的作用域内
              let deletedCategoryData = { id: categoryId, parentId: currentCategory.parentElement.dataset.id, title: categoryTitle, children: [] };

              chrome.bookmarks.getChildren(categoryId, function (children) {
                children.forEach(child => {
                  deletedCategoryData.children.push({
                    id: child.id,
                    parentId: child.parentId,
                    title: child.title,
                    url: child.url
                  });
                });

                chrome.bookmarks.removeTree(categoryId, function () {
                  currentCategory.remove();
                  Utilities.showToast(getLocalizedMessage('categoryDeleted'));

                  // 添加日志记录
                  console.log(`[${new Date().toISOString()}] Folder deleted: ID=${categoryId}, Title=${categoryTitle}`);
                  
                  // 更新显示
                  const parentId = document.getElementById('bookmarks-list').dataset.parentId;
                  updateBookmarksDisplay(parentId);
                });
              });
            });
            break;
          case getLocalizedMessage('setAsHomepage'):
            const homeFolderId = currentCategory.dataset.id;
            setDefaultBookmark(homeFolderId);
            break;
        }
        menu.style.display = 'none';
      });

      menu.appendChild(menuItem);
    });

    return menu;
  }

  const categoryContextMenu = createCategoryContextMenu();

  document.addEventListener('contextmenu', function (event) {
    const targetCategory = event.target.closest('#categories-list li');
    if (targetCategory) {
      event.preventDefault();
      currentCategory = targetCategory;
      categoryContextMenu.style.top = `${event.clientY}px`;
      categoryContextMenu.style.left = `${event.clientX}px`;
      categoryContextMenu.style.display = 'block';
    } else {
      categoryContextMenu.style.display = 'none';
    }
  });

  document.addEventListener('click', function () {
    categoryContextMenu.style.display = 'none';
  });

  const editCategoryDialog = document.getElementById('edit-category-dialog');
  const editCategoryForm = document.getElementById('edit-category-form');
  const editCategoryNameInput = document.getElementById('edit-category-name');
  const closeCategoryButton = document.querySelector('.close-category-button');
  const cancelCategoryButton = document.querySelector('.cancel-category-button');

  function openEditCategoryDialog(categoryElement) {
    const categoryId = categoryElement.dataset.id;
    const categoryTitle = categoryElement.dataset.title;

    editCategoryNameInput.value = categoryTitle;

    editCategoryDialog.style.display = 'block';

    editCategoryForm.onsubmit = function (event) {
      event.preventDefault();
      const updatedTitle = editCategoryNameInput.value;

      chrome.bookmarks.update(categoryId, {
        title: updatedTitle
      }, function (result) {
        updateCategoryUI(categoryElement, updatedTitle);
        editCategoryDialog.style.display = 'none';
      });
    };
  }

  function updateCategoryUI(categoryElement, newTitle) {
    // 更新侧边栏中的文件夹名称
    const sidebarItem = document.querySelector(`#categories-list li[data-id="${categoryElement.dataset.id}"]`);
    if (sidebarItem) {
      // 更新文本内容
      const textSpan = sidebarItem.querySelector('span:not(.material-icons)');
      if (textSpan) {
        textSpan.textContent = newTitle;
      }

      // 更新 data-title 属性
      sidebarItem.setAttribute('data-title', newTitle);

      // 更新样式
      sidebarItem.classList.add('updated-folder');
      setTimeout(() => {
        sidebarItem.classList.remove('updated-folder');
      }, 2000); // 2秒后移除高亮效果
    }

    // 更新面包屑导航
    updateFolderName(categoryElement.dataset.id);

    // 更新文件夹卡片（如果在当前视图中）
    const folderCard = document.querySelector(`.bookmark-folder[data-id="${categoryElement.dataset.id}"]`);
    if (folderCard) {
      const titleElement = folderCard.querySelector('.card-title');
      if (titleElement) {
        titleElement.textContent = newTitle;
      }
    }
  }

  closeCategoryButton.onclick = function () {
    editCategoryDialog.style.display = 'none';
  };

  cancelCategoryButton.onclick = function () {
    editCategoryDialog.style.display = 'none';
  };

  window.onclick = function (event) {
    if (event.target == editCategoryDialog) {
      editCategoryDialog.style.display = 'none';
    }
  };

  function setDefaultBookmark(bookmarkId) {
    localStorage.setItem('defaultBookmarkId', bookmarkId);
    updateDefaultBookmarkIndicator();

    // 刷新 bookmarks-container
    updateBookmarksDisplay(bookmarkId);

    // 更新侧边栏中的默认书签指示器和选中状态
    updateSidebarDefaultBookmarkIndicator();

    // 通知背景脚本更新默认书签ID
    chrome.runtime.sendMessage({ action: 'setDefaultBookmarkId', defaultBookmarkId: bookmarkId }, function (response) {
      if (response && response.success) {
      }
    });
  }

  function updateDefaultBookmarkIndicator() {
    const defaultBookmarkId = localStorage.getItem('defaultBookmarkId');
    const allBookmarks = document.querySelectorAll('.bookmark-card, .bookmark-folder');
    allBookmarks.forEach(bookmark => {
      const indicator = bookmark.querySelector('.default-indicator');
      if (indicator) {
        indicator.remove();
      }
      if (bookmark.dataset.id === defaultBookmarkId) {
        const defaultIndicator = document.createElement('span');
        defaultIndicator.className = 'default-indicator material-icons';
        defaultIndicator.textContent = 'star';
        defaultIndicator.title = getLocalizedMessage('homepage');
        bookmark.appendChild(defaultIndicator);
      }
    });
  }

  function updateSidebarDefaultBookmarkIndicator() {
    const defaultBookmarkId = localStorage.getItem('defaultBookmarkId');
    selectSidebarFolder(defaultBookmarkId);
    
    const allCategories = document.querySelectorAll('#categories-list li');
    allCategories.forEach(category => {
      const indicator = category.querySelector('.default-indicator');
      if (indicator) {
        indicator.remove();
      }
      if (category.dataset.id === defaultBookmarkId) {
        const defaultIndicator = document.createElement('span');
        defaultIndicator.className = 'default-indicator material-icons';
        defaultIndicator.textContent = 'star';
        defaultIndicator.title = getLocalizedMessage('homepage');
        category.appendChild(defaultIndicator);
      }
    });
  }

  function updateBookmarksDisplay(parentId, movedItemId, newIndex) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.getChildren(parentId, (bookmarks) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        const bookmarksList = document.getElementById('bookmarks-list');
        const bookmarksContainer = document.querySelector('.bookmarks-container');

        // 先隐藏容器
        bookmarksContainer.style.opacity = '0';
        bookmarksContainer.style.transform = 'translateY(20px)';

        // 清空现有书签和占位符
        bookmarksList.innerHTML = '';

        // 更新本地缓存
        bookmarkOrderCache[parentId] = bookmarks.map(b => b.id);

        // 添加新的书签
        bookmarks.forEach((bookmark, index) => {
          const bookmarkElement = bookmark.url ? createBookmarkCard(bookmark, index) : createFolderCard(bookmark, index);
          bookmarksList.appendChild(bookmarkElement);
        });

        bookmarksList.dataset.parentId = parentId;

        if (movedItemId) {
          highlightBookmark(movedItemId);
        }

        // 更新文件夹名称
        updateFolderName(parentId);

        // 使用 requestAnimationFrame 来确保 DOM 更新后再显示容器
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            bookmarksContainer.style.opacity = '1';
            bookmarksContainer.style.transform = 'translateY(0)';
          });
        });

        resolve();
      });
    });
  }

  const tabsContainer = document.getElementById('tabs-container');
  const tabs = document.querySelectorAll('.tab');
  const defaultSearchEngine = localStorage.getItem('selectedSearchEngine') || 'Google';

  // 在文件的适当位置（可能在 DOMContentLoaded 事件监听器内）添加这个标志
  let isChangingSearchEngine = false;

  tabs.forEach(tab => {
    tab.setAttribute('tabindex', '0');
    if (tab.textContent.trim() === defaultSearchEngine) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
    tab.addEventListener('click', function () {
      isChangingSearchEngine = true;
      const selectedEngine = this.getAttribute('data-engine');
      localStorage.setItem('selectedSearchEngine', selectedEngine);
      
      requestAnimationFrame(() => {
        updateSearchEngineIcon(selectedEngine);
      });
      
      // 移除其他标签的 active 类
      tabs.forEach(t => t.classList.remove('active'));
      // 为当前选的标签添加 active 类
      this.classList.add('active');

      // 如果搜索建议列表当前是显示的，则保持显示
      if (searchSuggestions.style.display !== 'none') {
        // 可能需要重新获取建议，因为搜索引擎改变了
        const query = searchInput.value.trim();
        if (query) {
          getSuggestions(query).then(suggestions => {
            showSuggestions(suggestions);
          });
        }
      }

      // 重置标志
      setTimeout(() => {
        isChangingSearchEngine = false;
      }, 0);
    });
    tab.addEventListener('focus', function () {
      const selectedEngine = this.getAttribute('data-engine');
      localStorage.setItem('selectedSearchEngine', selectedEngine);
      
      requestAnimationFrame(() => {
        updateSearchEngineIcon(selectedEngine);
      });
      
      // 移除其他标签的 active 类
      tabs.forEach(t => t.classList.remove('active'));
      // 为当前选中的标签添加 active 类
      this.classList.add('active');
    });
  });

  new Sortable(tabsContainer, {
    animation: 150,
    onEnd: function (evt) {
      const orderedEngines = Array.from(tabsContainer.children).map(tab => tab.getAttribute('data-engine'));
      localStorage.setItem('orderedSearchEngines', JSON.stringify(orderedEngines));
    }
  });

  const savedOrder = JSON.parse(localStorage.getItem('orderedSearchEngines'));
  if (savedOrder) {
    savedOrder.forEach(engineName => {
      const tab = Array.from(tabs).find(tab => tab.getAttribute('data-engine') === engineName);
      if (tab) {
        tabsContainer.appendChild(tab);
      }
    });
  }

  const searchForm = document.getElementById('search-form');
  const searchInput = document.querySelector('.search-input');
  const searchEngineIcon = document.getElementById('search-engine-icon');

  searchInput.addEventListener('focus', function () {
    searchForm.classList.add('focused');
    if (searchInput.value.trim() === '') {
      showDefaultSuggestions();
    } else {
      const suggestions = getSuggestions(searchInput.value.trim());
      showSuggestions(suggestions);
    }
  });

  searchInput.addEventListener('blur', () => {
    const searchForm = document.querySelector('.search-form');
    searchForm.classList.remove('focused');
    // 使用 setTimeout 来延迟隐藏建议列表，允许点击建议
    setTimeout(() => {
      if (!searchForm.contains(document.activeElement)) {
        hideSuggestions();
      }
    }, 200);
  });

  if (!searchForm || !searchInput || !tabsContainer || !searchEngineIcon) {
    return;
  }

  updateSubmitButtonState();



  function updateSubmitButtonState() {
    if (searchInput.value.trim() === '') {
      tabsContainer.style.display = 'none';
    } else {
      // 只有当搜索建议列表不为空时才显示 tabs-container
      if (searchSuggestions.children.length > 0) {
        tabsContainer.style.display = 'flex';
      } else {
        tabsContainer.style.display = 'none';
      }
    }
  }

  let isSearching = false;
  let searchQueue = [];

  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  const debouncedPerformSearch = debounce(performSearch, 300);

  // Modify the search form submit event listener
  searchForm.addEventListener('submit', (e) => {
    e.preventDefault(); // Prevent default form submission
    performSearch(searchInput.value.trim());
  });

  function queueSearch() {
    const query = searchInput.value.trim();
    if (query === '') {
      return;
    }
    searchQueue.push(query);
    processSearchQueue();
  }

  function processSearchQueue() {
    if (isSearching || searchQueue.length === 0) {
      return;
    }
    
    const query = searchQueue.shift();
    debouncedPerformSearch(query);
  }

  function performSearch(query) {
    if (!query || typeof query !== 'string' || query.trim() === '') {
      return;
    }

    const selectedEngine = localStorage.getItem('selectedSearchEngine') || 'google';

    // 检查是否是通过 Cmd/Ctrl + Enter 触发的搜索
    if (window.lastSearchTrigger === 'cmdCtrlEnter') {
      window.lastSearchTrigger = null; // 重置标志
      return;
    }

    isSearching = true;

    let url = getSearchUrl(selectedEngine, query);

    window.open(url, '_blank');
    hideSuggestions(); // Hide search suggestions

    setTimeout(() => {
      isSearching = false;
      processSearchQueue(); // Check if there are more searches queued
    }, 1000); // Allow next search after 1 second
  }

  function getSearchUrl(engine, query) {
    switch (engine.toLowerCase()) {
      case 'kimi':
      case 'kimi':
        return `https://kimi.moonshot.cn/?q=${encodeURIComponent(query)}`;
      case 'doubao':
      case '豆包':
        return `https://www.doubao.com/chat/?q=${encodeURIComponent(query)}`;
      case 'chatgpt':
        return `https://chatgpt.com/?q=${encodeURIComponent(query)}`;
      case 'felo':
        return `https://felo.ai/search?q=${query}`;
      case 'metaso':
      case '秘塔':
        return `https://metaso.cn/?q=${query}`;
      case 'google':
      case '谷歌':
        return `https://www.google.com/search?q=${query}`;
      case 'bing':
      case '必应':
        return `https://www.bing.com/search?q=${query}`;
      default:
        return `https://www.bing.com/search?q=${query}`;
    }
  }

  // 动态调整 textarea 度的函数
  function adjustTextareaHeight() {
    searchInput.style.height = 'auto'; // 重置高度
    const maxHeight = 3 * 21; // 假设每行高度为 24px，最多显示 3 行
    searchInput.style.height = Math.min(searchInput.scrollHeight, maxHeight) + 'px';
  }

  // 在输入事件中调用调整高度的函数
  searchInput.addEventListener('input', adjustTextareaHeight);

  // 初始化时调整高度
  adjustTextareaHeight();

  const searchSuggestions = document.getElementById('search-suggestions');

  // 防抖函数
  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
  async function getRecentHistory(limit = 100, maxPerDomain = 5) {
    return new Promise((resolve) => {
      chrome.history.search({ text: '', maxResults: limit * 20 }, (historyItems) => {
        const now = Date.now();
        const domainCounts = {};
        const uniqueItems = new Map();

        const recentHistory = historyItems
          // 映射并添加额外信息
          .map(item => {
            const url = new URL(item.url);
            const domain = url.hostname;
            return {
              text: item.title,
              url: item.url,
              domain: domain,
              type: 'history',
              relevance: 1,
              timestamp: item.lastVisitTime
            };
          })
          // 按时间排序（最近的优先）
          .sort((a, b) => b.timestamp - a.timestamp)
          // 去重（基于URL和标题）并限制每个域名的数量
          .filter(item => {
            const key = `${item.url}|${item.text}`;
            if (uniqueItems.has(key)) return false;
            
            domainCounts[item.domain] = (domainCounts[item.domain] || 0) + 1;
            if (domainCounts[item.domain] > maxPerDomain) return false;
            
            uniqueItems.set(key, item);
            return true;
          })
          // 应用时间衰减因子
          .map(item => {
            const daysSinceLastVisit = (now - item.timestamp) / (1000 * 60 * 60 * 24);
            item.relevance *= Math.exp(-daysSinceLastVisit / RELEVANCE_CONFIG.timeDecayHalfLife);
            return item;
          })
          // 再次排序，这次基于相关性（考虑了时间衰减）
          .sort((a, b) => b.relevance - a.relevance)
          // 限制结果数量
          .slice(0, limit);

        resolve(recentHistory);
      });
    });
  }
  // 在文件顶部定义 RELEVANCE_CONFIG
  const RELEVANCE_CONFIG = {
    titleExactMatchWeight: 6,
    urlExactMatchWeight: 1.5,
    titlePartialMatchWeight: 1.2,
    urlPartialMatchWeight: 0.3,
    timeDecayHalfLife: 60,
    fuzzyMatchThreshold: 0.6,
    fuzzyMatchWeight: 1.5,
    bookmarkRelevanceBoost: 1.2
  };
  function searchHistory(query, maxResults = 200) {
    return new Promise((resolve) => {
      const startTime = new Date().getTime() - (30 * 24 * 60 * 60 * 1000); // 搜索最近30天的历史
      chrome.history.search(
        { 
          text: query, 
          startTime: startTime,
          maxResults: maxResults 
        }, 
        (results) => {
          
          // 对历史记录进行去重
          const uniqueResults = Array.from(new Set(results.map(r => r.url)))
            .map(url => results.find(r => r.url === url));
          resolve(uniqueResults);
        }
      );
    });
  }
  // 获取搜索建议
  async function getSuggestions(query) {
    const maxHistoryResults = 200;
    const maxBookmarkResults = 50;
    const maxTotalSuggestions = 50;

    const suggestions = [{ text: query, type: 'search', relevance: Infinity }];

    // 从历史记录获取建议
    const historyItems = await searchHistory(query, maxHistoryResults);
    const historySuggestions = historyItems.map(item => ({
      text: item.title,
      url: item.url,
      type: 'history',
      relevance: calculateRelevance(query, item.title, item.url),
      timestamp: item.lastVisitTime
    }));

    // 从书签获取建议
    const bookmarkItems = await new Promise(resolve => {
      chrome.bookmarks.search(query, resolve);
    });
    const bookmarkSuggestions = bookmarkItems.slice(0, maxBookmarkResults).map(item => ({
      text: item.title,
      url: item.url,
      type: 'bookmark',
      relevance: calculateRelevance(query, item.title, item.url) * RELEVANCE_CONFIG.bookmarkRelevanceBoost
    }));

    // 获取 Bing 建议
    const bingSuggestions = await getBingSuggestions(query);

    // 合并所有建议
    suggestions.push(
      ...historySuggestions,
      ...bookmarkSuggestions,
      ...bingSuggestions
    );
    // 对结果进行排序和去重
    const uniqueSuggestions = Array.from(new Set(suggestions.map(s => s.url)))
      .map(url => suggestions.find(s => s.url === url))
      .sort((a, b) => b.relevance - a.relevance);
    // 平衡和交替显示结果
    const balancedResults = await balanceResults(uniqueSuggestions, maxTotalSuggestions);
    balancedResults.slice(0, 5).forEach((suggestion, index) => {
    });

    return balancedResults;
  }

  function calculateRelevance(query, title, url) {
    const lowerQuery = query.toLowerCase();
    const lowerTitle = title.toLowerCase();
    const lowerUrl = url.toLowerCase();

    let score = 0;

    // 完全匹配
    if (lowerTitle.includes(lowerQuery)) {
      score += 10;
    }
    if (lowerUrl.includes(lowerQuery)) {
      score += 5;
    }

    // 部分匹配
    const queryChars = Array.from(lowerQuery);
    let titleMatchCount = 0;
    let urlMatchCount = 0;

    queryChars.forEach(char => {
      if (lowerTitle.includes(char)) titleMatchCount++;
      if (lowerUrl.includes(char)) urlMatchCount++;
    });

    score += (titleMatchCount / queryChars.length) * 5;
    score += (urlMatchCount / queryChars.length) * 2;

    // 添加模糊匹配
    const titleWords = lowerTitle.split(/\s+/);
    const urlWords = lowerUrl.split(/[/:.?=&-]+/);
    const allWords = [...new Set([...titleWords, ...urlWords])];

    for (const word of allWords) {
      if (word.length > 1) {  // 考虑更的词
        const distance = levenshteinDistance(lowerQuery, word);
        const similarity = 1 - distance / Math.max(lowerQuery.length, word.length);
        if (similarity >= 0.6) {  // 降低相似度阈值
          score += 3 * similarity;
        }
      }
    }

    return score;
  }

  function updateSidebarDefaultBookmarkIndicator() {
    const defaultBookmarkId = localStorage.getItem('defaultBookmarkId');
    selectSidebarFolder(defaultBookmarkId);
    
    const allCategories = document.querySelectorAll('#categories-list li');
    allCategories.forEach(category => {
      const indicator = category.querySelector('.default-indicator');
      if (indicator) {
        indicator.remove();
      }
      if (category.dataset.id === defaultBookmarkId) {
        const defaultIndicator = document.createElement('span');
        defaultIndicator.className = 'default-indicator material-icons';
        defaultIndicator.textContent = 'star';
        defaultIndicator.title = getLocalizedMessage('homepage');
        category.appendChild(defaultIndicator);
      }
    });
  }

  function updateBookmarksDisplay(parentId, movedItemId, newIndex) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.getChildren(parentId, (bookmarks) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
          return;
        }

        const bookmarksList = document.getElementById('bookmarks-list');
        const bookmarksContainer = document.querySelector('.bookmarks-container');

        // 先隐藏容器
        bookmarksContainer.style.opacity = '0';
        bookmarksContainer.style.transform = 'translateY(20px)';

        // 清空现有书签和占位符
        bookmarksList.innerHTML = '';

        // 更新本地缓存
        bookmarkOrderCache[parentId] = bookmarks.map(b => b.id);

        // 添加新的书签
        bookmarks.forEach((bookmark, index) => {
          const bookmarkElement = bookmark.url ? createBookmarkCard(bookmark, index) : createFolderCard(bookmark, index);
          bookmarksList.appendChild(bookmarkElement);
        });

        bookmarksList.dataset.parentId = parentId;

        if (movedItemId) {
          highlightBookmark(movedItemId);
        }

        // 更新文件夹名称
        updateFolderName(parentId);

        // 使用 requestAnimationFrame 来确保 DOM 更新后再显示容器
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            bookmarksContainer.style.opacity = '1';
            bookmarksContainer.style.transform = 'translateY(0)';
          });
        });

        resolve();
      });
    });
  }

  tabs.forEach(tab => {
    tab.setAttribute('tabindex', '0');
    if (tab.textContent.trim() === defaultSearchEngine) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
    tab.addEventListener('click', function () {
      isChangingSearchEngine = true;
      const selectedEngine = this.getAttribute('data-engine');
      localStorage.setItem('selectedSearchEngine', selectedEngine);
      
      requestAnimationFrame(() => {
        updateSearchEngineIcon(selectedEngine);
      });
      
      // 移除其他标签的 active 类
      tabs.forEach(t => t.classList.remove('active'));
      // 为当前选的标签添加 active 类
      this.classList.add('active');

      // 如果搜索建议列表当前是显示的，则保持显示
      if (searchSuggestions.style.display !== 'none') {
        // 可能需要重新获取建议，因为搜索引擎改变了
        const query = searchInput.value.trim();
        if (query) {
          getSuggestions(query).then(suggestions => {
            showSuggestions(suggestions);
          });
        }
      }

      // 重置标志
      setTimeout(() => {
        isChangingSearchEngine = false;
      }, 0);
    });
    tab.addEventListener('focus', function () {
      const selectedEngine = this.getAttribute('data-engine');
      localStorage.setItem('selectedSearchEngine', selectedEngine);
      
      requestAnimationFrame(() => {
        updateSearchEngineIcon(selectedEngine);
      });
      
      // 移除其他标签的 active 类
      tabs.forEach(t => t.classList.remove('active'));
      // 为当前选中的标签添加 active 类
      this.classList.add('active');
    });
  });

  new Sortable(tabsContainer, {
    animation: 150,
    onEnd: function (evt) {
      const orderedEngines = Array.from(tabsContainer.children).map(tab => tab.getAttribute('data-engine'));
      localStorage.setItem('orderedSearchEngines', JSON.stringify(orderedEngines));
    }
  });





  searchInput.addEventListener('focus', function () {
    searchForm.classList.add('focused');
  });

  searchInput.addEventListener('blur', function () {
    searchForm.classList.remove('focused');
  });

  if (!searchForm || !searchInput || !tabsContainer || !searchEngineIcon) {
    return;
  }



  function updateSubmitButtonState() {
    if (searchInput.value.trim() === '') {
      tabsContainer.style.display = 'none';
    } else {
      // 只有当搜索建议列表不为空时才显示 tabs-container
      if (searchSuggestions.children.length > 0) {
        tabsContainer.style.display = 'flex';
      } else {
        tabsContainer.style.display = 'none';
      }
    }
  }



  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }


  function queueSearch() {
    const query = searchInput.value.trim();
    if (query === '') {
      return;
    }
    searchQueue.push(query);
    processSearchQueue();
  }

  function processSearchQueue() {
    if (isSearching || searchQueue.length === 0) {
      return;
    }
    
    const query = searchQueue.shift();
    debouncedPerformSearch(query);
  }

  function performSearch(query) {
    if (!query || typeof query !== 'string' || query.trim() === '') {
      return;
    }

    const selectedEngine = localStorage.getItem('selectedSearchEngine') || 'google';

    // 检查是否是通过 Cmd/Ctrl + Enter 触发的搜索
    if (window.lastSearchTrigger === 'cmdCtrlEnter') {
      window.lastSearchTrigger = null; // 重置标志
      return;
    }

    isSearching = true;

    let url = getSearchUrl(selectedEngine, query);

    window.open(url, '_blank');
    hideSuggestions(); // Hide search suggestions

    setTimeout(() => {
      isSearching = false;
      processSearchQueue(); // Check if there are more searches queued
    }, 1000); // Allow next search after 1 second
  }

  function getSearchUrl(engine, query) {
    switch (engine.toLowerCase()) {
      case 'kimi':
      case 'kimi':
        return `https://kimi.moonshot.cn/?q=${encodeURIComponent(query)}`;
      case 'doubao':
      case '豆包':
        return `https://www.doubao.com/chat/?q=${encodeURIComponent(query)}`;
      case 'chatgpt':
        return `https://chatgpt.com/?q=${encodeURIComponent(query)}`;
      case 'felo':
        return `https://felo.ai/search?q=${query}`;
      case 'metaso':
      case '秘塔':
        return `https://metaso.cn/?q=${query}`;
      case 'google':
      case '谷歌':
        return `https://www.google.com/search?q=${query}`;
      case 'bing':
      case '必应':
        return `https://www.bing.com/search?q=${query}`;
      default:
        return `https://www.bing.com/search?q=${query}`;
    }
  }

  // 动态调整 textarea 度的函数
  function adjustTextareaHeight() {
    searchInput.style.height = 'auto'; // 重置高度
    const maxHeight = 3 * 32; // 假设每行高度为 24px，最多显示 3 行
    searchInput.style.height = Math.min(searchInput.scrollHeight, maxHeight) + 'px';
  }

  // 在输入事件中调用调整高度的函数
  searchInput.addEventListener('input', adjustTextareaHeight);

  // 初始化时调整高度
  adjustTextareaHeight();


  // 防抖函数
  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
  // 添加这个函数定义
  async function getBingSuggestions(query) {
    try {
      const response = await fetch(`https://api.bing.com/osjson.aspx?query=${encodeURIComponent(query)}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data[1].map(suggestion => ({
        text: suggestion,
        type: 'bing_suggestion',
        relevance: 1
      }));
    } catch (error) {
      return []; // 返回空数组，以便在出错时程序可以继续运行
    }
  }
  async function getRecentHistory(limit = 100, maxPerDomain = 5) {
    return new Promise((resolve) => {
      chrome.history.search({ text: '', maxResults: limit * 20 }, (historyItems) => {
        const now = Date.now();
        const domainCounts = {};
        const uniqueItems = new Map();

        const recentHistory = historyItems
          // 映射并添加额外信息
          .map(item => {
            const url = new URL(item.url);
            const domain = url.hostname;
            return {
              text: item.title,
              url: item.url,
              domain: domain,
              type: 'history',
              relevance: 1,
              timestamp: item.lastVisitTime
            };
          })
          // 按时间排序（最近的优先）
          .sort((a, b) => b.timestamp - a.timestamp)
          // 去重（基于URL和标题）并限制每个域名的数量
          .filter(item => {
            const key = `${item.url}|${item.text}`;
            if (uniqueItems.has(key)) return false;
            
            domainCounts[item.domain] = (domainCounts[item.domain] || 0) + 1;
            if (domainCounts[item.domain] > maxPerDomain) return false;
            
            uniqueItems.set(key, item);
            return true;
          })
          // 应用时间衰减因子
          .map(item => {
            const daysSinceLastVisit = (now - item.timestamp) / (1000 * 60 * 60 * 24);
            item.relevance *= Math.exp(-daysSinceLastVisit / RELEVANCE_CONFIG.timeDecayHalfLife);
            return item;
          })
          // 再次排序，这次基于相关性（考虑了时间衰减）
          .sort((a, b) => b.relevance - a.relevance)
          // 限制结果数量
          .slice(0, limit);

        resolve(recentHistory);
      });
    });
  }

  function searchHistory(query, maxResults = 200) {
    return new Promise((resolve) => {
      const startTime = new Date().getTime() - (30 * 24 * 60 * 60 * 1000); // 搜索最近30天的历史
      chrome.history.search(
        { 
          text: query, 
          startTime: startTime,
          maxResults: maxResults 
        }, 
        (results) => {
          
          // 对历史记录进行去重
          const uniqueResults = Array.from(new Set(results.map(r => r.url)))
            .map(url => results.find(r => r.url === url));
          resolve(uniqueResults);
        }
      );
    });
  }
  // 获取搜索建议
  async function getSuggestions(query) {
    const maxHistoryResults = 200;
    const maxBookmarkResults = 50;
    const maxTotalSuggestions = 50;

    const suggestions = [{ text: query, type: 'search', relevance: Infinity }];

    // 从历史记录获取建议
    const historyItems = await searchHistory(query, maxHistoryResults);
    const historySuggestions = historyItems.map(item => ({
      text: item.title,
      url: item.url,
      type: 'history',
      relevance: calculateRelevance(query, item.title, item.url),
      timestamp: item.lastVisitTime
    }));

    // 从书签获取建议
    const bookmarkItems = await new Promise(resolve => {
      chrome.bookmarks.search(query, resolve);
    });
    const bookmarkSuggestions = bookmarkItems.slice(0, maxBookmarkResults).map(item => ({
      text: item.title,
      url: item.url,
      type: 'bookmark',
      relevance: calculateRelevance(query, item.title, item.url) * RELEVANCE_CONFIG.bookmarkRelevanceBoost
    }));



    // 合并所有建议
    suggestions.push(
      ...historySuggestions,
      ...bookmarkSuggestions,
 
    );
    // 对结果进行排序和去重
    const uniqueSuggestions = Array.from(new Set(suggestions.map(s => s.url)))
      .map(url => suggestions.find(s => s.url === url))
      .sort((a, b) => b.relevance - a.relevance);
    // 平衡和交替显示结果
    const balancedResults = await balanceResults(uniqueSuggestions, maxTotalSuggestions);
    balancedResults.slice(0, 5).forEach((suggestion, index) => {
    });

    return balancedResults;
  }

  function calculateRelevance(query, title, url) {
    const lowerQuery = query.toLowerCase();
    const lowerTitle = title.toLowerCase();
    const lowerUrl = url.toLowerCase();

    let score = 0;

    // 完全匹配
    if (lowerTitle.includes(lowerQuery)) {
      score += 10;
    }
    if (lowerUrl.includes(lowerQuery)) {
      score += 5;
    }

    // 部分匹配
    const queryChars = Array.from(lowerQuery);
    let titleMatchCount = 0;
    let urlMatchCount = 0;

    queryChars.forEach(char => {
      if (lowerTitle.includes(char)) titleMatchCount++;
      if (lowerUrl.includes(char)) urlMatchCount++;
    });

    score += (titleMatchCount / queryChars.length) * 5;
    score += (urlMatchCount / queryChars.length) * 2;

    // 添加模糊匹配
    const titleWords = lowerTitle.split(/\s+/);
    const urlWords = lowerUrl.split(/[/:.?=&-]+/);
    const allWords = [...new Set([...titleWords, ...urlWords])];

    for (const word of allWords) {
      if (word.length > 1) {  // 考虑更短的词
        const distance = levenshteinDistance(lowerQuery, word);
        const similarity = 1 - distance / Math.max(lowerQuery.length, word.length);
        if (similarity >= 0.6) {  // 降低相似度阈值
          score += 3 * similarity;
        }
      }
    }

    return score;
  }

  // Levenshtein 距离函数（如果之前没有定义的话）
  function levenshteinDistance(a, b) {
    const matrix = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  async function balanceResults(suggestions, maxResults) {
    const currentSuggestion = suggestions.filter(s => s.type === 'search');
    let bookmarks = suggestions.filter(s => s.type === 'bookmark');
    let histories = suggestions.filter(s => s.type === 'history');
    let bingSuggestions = suggestions.filter(s => s.type === 'bing_suggestion');

    // 应用时间衰减因子到历史记录
    const now = Date.now();
    histories = histories.map(h => {
        const daysSinceLastVisit = (now - h.timestamp) / (1000 * 60 * 60 * 24);
        if (daysSinceLastVisit < 7) { // 如果是最近7天内的记录
          h.relevance *= 1.5; // 为最近的记录提供额外的提升
        }
        h.relevance *= Math.exp(-daysSinceLastVisit / RELEVANCE_CONFIG.timeDecayHalfLife);
        return h;
    });

    // 为书签提供轻微的相关性提
    bookmarks = bookmarks.map(b => {
        b.relevance *= RELEVANCE_CONFIG.bookmarkRelevanceBoost;
        return b;
    });

    // 重新排序
    bookmarks.sort((a, b) => b.relevance - a.relevance);
    histories.sort((a, b) => b.relevance - a.relevance);
    bingSuggestions.sort((a, b) => b.relevance - a.relevance);

    const results = [...currentSuggestion];
    const maxEachType = Math.floor((maxResults - 1) / 4); // 现在我们有4种类型

    // 交替添加不同类型的建议
    for (let i = 0; i < maxEachType * 4; i++) {
      if (i % 4 === 0 && bookmarks.length > 0) {
        results.push(bookmarks.shift());
      } else if (i % 4 === 1 && histories.length > 0) {
        results.push(histories.shift());
      } else if (i % 4 === 2 && bingSuggestions.length > 0) {
        results.push(bingSuggestions.shift());
      } else if (histories.length > 0) {
        results.push(histories.shift());
      }
    }

    // 如果还有空间，添加剩余的最相关项
    while (results.length < maxResults && (bookmarks.length > 0 || histories.length > 0 || bingSuggestions.length > 0)) {
      if (bookmarks.length === 0) {
        if (histories.length === 0) {
          results.push(bingSuggestions.shift());
        } else if (bingSuggestions.length === 0) {
          results.push(histories.shift());
        } else {
          results.push(histories[0].relevance > bingSuggestions[0].relevance ? histories.shift() : bingSuggestions.shift());
        }
      } else if (histories.length === 0) {
        if (bookmarks.length === 0) {
          results.push(bingSuggestions.shift());
        } else if (bingSuggestions.length === 0) {
          results.push(bookmarks.shift());
        } else {
          results.push(bookmarks[0].relevance > bingSuggestions[0].relevance ? bookmarks.shift() : bingSuggestions.shift());
        }
      } else if (bingSuggestions.length === 0) {
        results.push(bookmarks[0].relevance > histories[0].relevance ? bookmarks.shift() : histories.shift());
      } else {
        const maxRelevance = Math.max(bookmarks[0].relevance, histories[0].relevance, bingSuggestions[0].relevance);
        if (maxRelevance === bookmarks[0].relevance) {
          results.push(bookmarks.shift());
        } else if (maxRelevance === histories[0].relevance) {
          results.push(histories.shift());
        } else {
          results.push(bingSuggestions.shift());
        }
      }
    }

    // 计算用户相关性
    const suggestionsWithUserRelevance = await calculateUserRelevance(results);

    // 重新排序，使用 userRelevance 而不是 relevance
    suggestionsWithUserRelevance.sort((a, b) => b.userRelevance - a.userRelevance);

    return suggestionsWithUserRelevance;
  }

  const USER_BEHAVIOR_KEY = 'userSearchBehavior';

  // 在文件顶部定义 MAX_BEHAVIOR_ENTRIES
  const MAX_BEHAVIOR_ENTRIES = 1000; // 你可以根据需要调整这个值

  // 获取用户行为数据
  async function getUserBehavior() {
    return new Promise((resolve) => {
      chrome.storage.local.get(USER_BEHAVIOR_KEY, (result) => {
        const behavior = result[USER_BEHAVIOR_KEY] || {};
        resolve(behavior); // 直接返回行为数据，不进行清理
      });
    });
  }

  // 保存用户行为数据
  async function saveUserBehavior(key, increment = 1) {
    const behavior = await getUserBehavior();
    const now = Date.now();

    if (!behavior[key]) {
      behavior[key] = { count: 0, lastUsed: now };
    }

    behavior[key].count += increment; // 增加计数
    behavior[key].lastUsed = now; // 更新最后使用时间

    // 检查条目数并清理
    if (Object.keys(behavior).length > MAX_BEHAVIOR_ENTRIES) {
      const sortedEntries = Object.entries(behavior)
        .sort(([, a], [, b]) => a.lastUsed - b.lastUsed); // 按最后使用时间排序
      sortedEntries.slice(0, sortedEntries.length - MAX_BEHAVIOR_ENTRIES).forEach(([key]) => {
        delete behavior[key]; // 删除最旧的条目
      });
    }

    return new Promise((resolve) => {
      chrome.storage.local.set({ [USER_BEHAVIOR_KEY]: behavior }, resolve); // 直接保存行为数据
    });
  }

  // 计算用户相关性
  async function calculateUserRelevance(suggestions) {
    const behavior = await getUserBehavior();
    const now = Date.now();

    return suggestions.map(suggestion => {
      const key = suggestion.url || suggestion.text;
      const behaviorData = behavior[key];

      if (!behaviorData) return { ...suggestion, userRelevance: suggestion.relevance };

      const daysSinceLastUse = (now - behaviorData.lastUsed) / (1000 * 60 * 60 * 24);
      const recencyFactor = Math.exp(-daysSinceLastUse / 30); // 30天的半衰期
      const behaviorScore = behaviorData.count * recencyFactor;

      return {
        ...suggestion,
        userRelevance: suggestion.relevance * (1 + behaviorScore * 0.1) // 增加最多10%的权重
      };
    });
  }

  let allSuggestions = [];
  let displayedSuggestions = 0;
  const suggestionsPerLoad = 10; // 每次加载10个建议

  let isScrollListenerAttached = false;

  function showSuggestions(suggestions) {
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      hideSuggestions();
      return;
    }

    allSuggestions = suggestions;
    displayedSuggestions = 0;
    searchSuggestions.innerHTML = '';
  
    const searchForm = document.querySelector('.search-form');
    searchForm.classList.add('focused-with-suggestions');

    const suggestionsWrapper = document.querySelector('.search-suggestions-wrapper');
    if (suggestionsWrapper) {
      suggestionsWrapper.style.display = 'block';
    }
    searchSuggestions.style.display = 'block';

    // 显示 line-container
    const lineContainer = document.getElementById('line-container');
    lineContainer.style.display = 'block'; // 显示线条

    // Set a fixed height for the suggestions container
    searchSuggestions.style.maxHeight = '390px'; // Adjust this value as needed
    searchSuggestions.style.overflowY = 'auto';

    loadMoreSuggestions();

    if (!isScrollListenerAttached) {
      searchSuggestions.addEventListener('scroll', throttledHandleScroll);
      isScrollListenerAttached = true;
    }
    setTimeout(() => {
    }, 0);
  }

  function loadMoreSuggestions() {
    if (!Array.isArray(allSuggestions) || allSuggestions.length === 0) {
      return;
    }

    const remainingSuggestions = allSuggestions.length - displayedSuggestions;
    const suggestionsToAdd = Math.min(remainingSuggestions, 10);

    if (suggestionsToAdd <= 0) {
      return;
    }

    const fragment = document.createDocumentFragment();
    for (let i = displayedSuggestions; i < displayedSuggestions + suggestionsToAdd; i++) {
      const li = createSuggestionElement(allSuggestions[i]);
      fragment.appendChild(li);
    }

    searchSuggestions.appendChild(fragment);
    displayedSuggestions += suggestionsToAdd;

  }

  function throttle(func, limit) {
    let inThrottle;
    return function() {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    }
  }

  const throttledHandleScroll = throttle(function() {
    const scrollPosition = searchSuggestions.scrollTop + searchSuggestions.clientHeight;
    const scrollHeight = searchSuggestions.scrollHeight;
    if (scrollPosition >= scrollHeight - 20 && displayedSuggestions < allSuggestions.length) {
      loadMoreSuggestions();
    }
  }, 200);  // 限制为每200毫秒最多执行一次

  function showNoMoreSuggestions() {
    const existingNoMore = searchSuggestions.querySelector('.no-more-suggestions');
    if (!existingNoMore) {
      const noMoreElement = document.createElement('li');
      noMoreElement.className = 'no-more-suggestions';
      noMoreElement.style.height = '38px'; // 设置一个固定高度，与他建议项保持一致
      noMoreElement.style.visibility = 'hidden'; // 使元素不可见，但保留空间
      searchSuggestions.appendChild(noMoreElement);
    }
  }

  // 修改创建建议元素的函数
  function createSuggestionElement(suggestion) {
    const li = document.createElement('li');
    const displayUrl = suggestion.url ? formatUrl(suggestion.url) : '';
    li.setAttribute('data-type', suggestion.type);
    if (suggestion.url) {
      li.setAttribute('data-url', suggestion.url);
    }
    const searchSvgIcon = `<svg class="suggestion-icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
  <path d="M466.624 890.432a423.296 423.296 0 0 1-423.936-423.04C42.688 233.728 231.936 42.624 466.56 42.624a423.68 423.68 0 0 1 423.936 424.64 437.952 437.952 0 0 1-56.32 213.12 47.872 47.872 0 0 1-64.128 17.28 48 48 0 0 1-17.216-64.256c29.76-50.176 43.84-106.56 43.84-166.144-1.6-183.36-148.608-330.624-330.112-330.624a330.432 330.432 0 0 0-330.112 330.624 329.408 329.408 0 0 0 330.112 330.688c57.92 0 115.776-15.68 165.824-43.904a47.872 47.872 0 0 1 64.128 17.28 48 48 0 0 1-17.152 64.192 443.584 443.584 0 0 1-212.8 54.848z" fill="#334155"></path>
  <path d="M466.624 890.432a423.296 423.296 0 0 1-423.936-423.04c0-75.264 20.288-148.928 56.32-213.12a47.872 47.872 0 0 1 64.128-17.28 48 48 0 0 1 17.216 64.256 342.08 342.08 0 0 0-43.84 166.08c0 181.76 147.072 330.688 330.112 330.688a329.408 329.408 0 0 0 330.112-330.688A330.432 330.432 0 0 0 466.56 136.704c-57.856 0-115.776 15.68-165.824 43.84a47.872 47.872 0 0 1-64.128-17.216 48 48 0 0 1 17.216-64.256A436.032 436.032 0 0 1 466.56 42.688c233.088 0 422.4 189.568 422.4 424.64a422.016 422.016 0 0 1-422.4 423.104z" fill="#334155"></path>
  <path d="M934.4 981.312a44.992 44.992 0 0 1-32.832-14.08l-198.72-199.04c-18.752-18.816-18.752-48.576 0-65.792 18.752-18.816 48.512-18.816 65.728 0l198.656 199.04c18.816 18.752 18.816 48.576 0 65.792a47.68 47.68 0 0 1-32.832 14.08z" fill="#334155"></path>
</svg>`;
    // 限制建议文本的长度
    const maxTextLength = 20; // 你可以根据需要调整这个值
    const truncatedText = suggestion.text.length > maxTextLength 
      ? suggestion.text.substring(0, maxTextLength) + '...' 
      : suggestion.text;

    li.innerHTML = `
    ${suggestion.type === 'search' ? searchSvgIcon : '<span class="material-icons suggestion-icon"></span>'}
    <div class="suggestion-content">
      <span class="suggestion-text" title="${suggestion.text}">${truncatedText}</span>
      ${displayUrl ? `<span class="suggestion-dash">-</span><span class="suggestion-url">${displayUrl}</span>` : ''}
    </div>
    <span class="suggestion-type">${suggestion.type}</span>
  `;

    if (suggestion.url && suggestion.type !== 'search') {
      getFavicon(suggestion.url, (faviconUrl) => {
        const iconSpan = li.querySelector('.suggestion-icon');
        iconSpan.innerHTML = `<img src="${faviconUrl}" alt="" class="favicon">`;
      });
    }

    li.addEventListener('click', async () => {
      if (suggestion.url) {
        window.open(suggestion.url, '_blank');
        await saveUserBehavior(suggestion.url);
      } else {
        searchInput.value = suggestion.text;
        searchInput.focus();
        queueSearch();
        await saveUserBehavior(suggestion.text);
      }
      hideSuggestions();
    });

    return li;
  }

  function formatUrl(url) {
    try {
      const urlObj = new URL(url);
      let domain = urlObj.hostname;

      // 移除 'www.' 前缀（如果存在）
      domain = domain.replace(/^www\./, '');

      // 如果路径不只是 '/'
      let path = urlObj.pathname;
      if (path && path !== '/') {
        // 截断长路径
        path = path.length > 10 ? path.substring(0, 10) + '...' : path;
        domain += path;
      }

      return domain;
    } catch (e) {
      // 如果 URL 解析失败，返回空字符串
      return '';
    }
  }


  // Add this function to fetch favicons
  function getFavicon(url, callback) {
    const faviconURL = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`;
    const img = new Image();
    img.onload = function () {
      callback(faviconURL);
    };
    img.onerror = function () {
      callback(''); // Return an empty string if favicon is not found
    };
    img.src = faviconURL;
  }

  // Add this function to fetch favicon online as a fallback
  function fetchFaviconOnline(url, callback) {
    const domain = new URL(url).hostname;
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    const img = new Image();
    img.onload = function () {
      cacheFavicon(domain, faviconUrl);
      callback(faviconUrl);
    };
    img.onerror = function () {
      callback('');
    };
    img.src = faviconUrl;
  }

  // Add this function to cache favicons
  function cacheFavicon(domain, faviconUrl) {
    const data = {};
    data[domain] = faviconUrl;
    chrome.storage.local.set(data);
  }

  async function showDefaultSuggestions() {
    const recentHistory = await getRecentHistory(20);
    const suggestions = recentHistory.map(item => ({
      text: item.text,
      url: item.url,
      type: 'history',
      relevance: item.relevance
    }));

    showSuggestions(suggestions);
  }

  // 处理输入事件
  const handleInput = debounce(async () => {
    const query = searchInput.value.trim();
    showLoadingIndicator();
    if (query) {
      const suggestions = await getSuggestions(query);
      hideLoadingIndicator();
      showSuggestions(suggestions);
    } else {
      hideLoadingIndicator();
      showDefaultSuggestions();
    }
    updateSubmitButtonState();
  }, 300);

  searchInput.addEventListener('input', () => {
    handleInput();
    updateSubmitButtonState();
    if (searchInput.value.trim() === '') {
      showDefaultSuggestions();
    }
  });

  // 修改搜索输入框的事件监听器
  searchInput.addEventListener('focus', () => {
    const searchForm = document.querySelector('.search-form');
    searchForm.classList.add('focused');
    if (searchInput.value.trim() === '') {
      showDefaultSuggestions();
    } else {
      const suggestions = getSuggestions(searchInput.value.trim());
      showSuggestions(suggestions);
    }
  });

  searchInput.addEventListener('blur', (e) => {
    const searchForm = document.querySelector('.search-form');
    searchForm.classList.remove('focused');
    // 使用 setTimeout 来延迟隐藏建议列表，允许点击建议
    setTimeout(() => {
      if (!searchForm.contains(document.activeElement) && !searchSuggestions.contains(document.activeElement)) {
        hideSuggestions();
      }
    }, 200);
  });




  // 处理键盘导航
  searchInput.addEventListener('keydown', (e) => {
    const items = searchSuggestions.querySelectorAll('li');
    let index = Array.from(items).findIndex(item => item.classList.contains('keyboard-selected'));

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (index < items.length - 1) index++;
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (index > 0) index--;
        break;
      case 'Enter':
        e.preventDefault();
        if (e.metaKey || e.ctrlKey) {
          // 处理 Cmd/Ctrl + Enter
          const query = searchInput.value.trim();
          if (query) {
            openAllSearchEnginesExceptCurrent(query);
          }
        } else if (index !== -1) {
          e.stopPropagation(); // 阻止事件冒泡
          const selectedItem = items[index];
          const suggestionType = selectedItem.getAttribute('data-type');
          if (suggestionType === 'history' || suggestionType === 'bookmark') {
            const url = selectedItem.getAttribute('data-url');
            if (url) {
              window.open(url, '_blank');
              hideSuggestions();
              return;
            }
          }
          selectedItem.click();
        } else {
          performSearch(searchInput.value.trim());
        }
        return;
      default:
        return;
    }

    items.forEach(item => item.classList.remove('keyboard-selected'));
    if (index !== -1) {
      items[index].classList.add('keyboard-selected');
      // 只在选择搜索建议时更新输入框的值
      const selectedItem = items[index];
      const suggestionType = selectedItem.getAttribute('data-type');
      if (suggestionType === 'search') {
        searchInput.value = selectedItem.querySelector('.suggestion-text').textContent;
      }
    }
  })

  // 添加防抖函数
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }



  function hideSuggestions() {
    if (isChangingSearchEngine) {
      return; // 如果正在切换搜索引擎，不隐藏建议列表
    }
    const searchForm = document.querySelector('.search-form');
    searchForm.classList.remove('focused-with-suggestions');

    const suggestionsWrapper = document.querySelector('.search-suggestions-wrapper');
    if (suggestionsWrapper) {
      suggestionsWrapper.style.display = 'none';
    }
    if (searchSuggestions) {
      searchSuggestions.style.display = 'none';
      searchSuggestions.innerHTML = ''; // Clear the suggestions
    }

    // 隐藏 line-container
    const lineContainer = document.getElementById('line-container');
    lineContainer.style.display = 'none'; // 隐藏线条

    if (isScrollListenerAttached) {
      searchSuggestions.removeEventListener('scroll', throttledHandleScroll);
      isScrollListenerAttached = false;
    }

    // Reset suggestions-related variables
    allSuggestions = [];
    displayedSuggestions = 0;
  }

  function showLoadingIndicator() {
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-indicator';
    loadingIndicator.textContent = '加载中...';
    searchSuggestions.appendChild(loadingIndicator);
  }

  function hideLoadingIndicator() {
    const loadingIndicator = searchSuggestions.querySelector('.loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.remove();
    }
  }


  // 修改这个函数
  function openAllSearchEnginesExceptCurrent(query) {
    const currentEngine = localStorage.getItem('selectedSearchEngine') || 'google';
    const engines = ['google', 'bing', 'kimi', 'doubao', 'chatgpt', 'felo', 'metaso'];

    const urls = engines
      .filter(engine => engine.toLowerCase() !== currentEngine.toLowerCase())
      .map(engine => getSearchUrl(engine, query));

    if (urls.length > 0) {
      // 设置一个标志，表示这是通过 Cmd/Ctrl + Enter 触发的搜索
      window.lastSearchTrigger = 'cmdCtrlEnter';

      chrome.runtime.sendMessage({
        action: 'openMultipleTabsAndGroup',
        urls: urls,
        groupName: query
      }, function (response) {
        if (response && response.success) {
        } else {
          console.error('打开多个标签页或创建标签组失败:', response ? response.error : '未知错误');
        }
      });
    } else {
      console.log('没有其他搜索引擎可以打开');
    }
  }

});