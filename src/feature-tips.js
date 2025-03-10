import { ICONS } from './icons.js';

// 新功能提示管理类
class FeatureTips {
    constructor() {
        this.fadeOutDuration = 300; // 淡出动画时长(毫秒)
        this.tipQueue = []; // 提示队列，用于顺序显示提示
        this.isShowingTip = false; // 是否正在显示提示
        this.tipsInitialized = false; // 标记提示是否已初始化
        this.isProcessing = false; // 防止重复处理
        this.checkTimeout = null; // 用于防抖处理
        this.hasCheckedSettingsTip = false; // 标记是否已检查过设置提示
        this.domReady = false; // 标记DOM是否已准备好
        this.pageLoaded = false; // 标记页面是否已完全加载
        this.initStarted = false; // 标记初始化是否已开始

        // 立即隐藏所有提示，防止闪烁
        this.hideAllTipsImmediately();

        // 等待DOM加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.domReady = true;
                this.hideAllTipsImmediately();
                this.startInit();
            });
        } else {
            this.domReady = true;
            this.startInit();
        }

        // 监听页面完全加载
        window.addEventListener('load', () => {
            this.pageLoaded = true;
            this.startInit();
        });
    }

    // 开始初始化流程
    startInit() {
        if (this.initStarted || !this.domReady || !this.pageLoaded) {
            return;
        }
        this.initStarted = true;
        this.init();
    }

    // 立即隐藏所有提示
    hideAllTipsImmediately() {
        // 使用 style 标签立即隐藏提示，避免 CSS 加载延迟导致的闪烁
        const style = document.createElement('style');
        style.textContent = `
            .settings-update-tip {
                display: none !important;
                opacity: 0 !important;
                visibility: hidden !important;
            }
        `;
        document.head.appendChild(style);

        // 移除可能存在的旧样式
        const oldStyle = document.getElementById('feature-tips-style');
        if (oldStyle) {
            oldStyle.remove();
        }
        style.id = 'feature-tips-style';
    }

    // 重置提示样式
    resetTipStyle(tipContainer) {
        // 移除内联样式和之前添加的类
        tipContainer.style.cssText = '';
        tipContainer.classList.remove('tip-fade-out');
        
        // 移除 !important 样式的影响
        const style = document.getElementById('feature-tips-style');
        if (style) {
            style.remove();
        }

        // 设置初始样式
        tipContainer.style.display = 'block';
        tipContainer.style.opacity = '0';
        tipContainer.style.visibility = 'visible';
        
        // 强制重排以确保样式生效
        void tipContainer.offsetHeight;
    }

    // 初始化
    async init() {
        try {
            // 获取当前版本号
            this.currentVersion = await this.getExtensionVersion();
            console.log('[FeatureTips] 当前版本:', this.currentVersion);
            
            // 检查版本更新
            await this.checkVersionUpdate();
            
            // 开始处理提示队列
            setTimeout(() => {
                this.processNextTip();
            }, 1000);
        } catch (error) {
            console.error('[FeatureTips] 初始化错误:', error);
        }
    }

    // 获取扩展版本号
    async getExtensionVersion() {
        const manifest = chrome.runtime.getManifest();
        return manifest.version;
    }

    // 检查版本更新
    async checkVersionUpdate() {
        const lastVersion = localStorage.getItem('lastVersion');
        console.log('[FeatureTips] 当前版本:', this.currentVersion, '上一版本:', lastVersion);

        if (!lastVersion || this.isNewerVersion(this.currentVersion, lastVersion)) {
            // 获取该版本的所有新功能提示
            const features = await this.getVersionFeatures(lastVersion, this.currentVersion);
            console.log('[FeatureTips] 新功能列表:', features);

            // 将新功能提示添加到队列
            for (const feature of features) {
                this.queueShowTips(feature);
            }

            // 更新存储的版本号
            localStorage.setItem('lastVersion', this.currentVersion);
        }
    }

    // 比较版本号
    isNewerVersion(current, last) {
        if (!last) return true;

        const currentParts = current.split('.').map(Number);
        const lastParts = last.split('.').map(Number);

        for (let i = 0; i < currentParts.length; i++) {
            if (currentParts[i] > (lastParts[i] || 0)) return true;
            if (currentParts[i] < (lastParts[i] || 0)) return false;
        }
        return false;
    }

    // 获取版本之间的新功能
    getVersionFeatures(lastVersion, currentVersion) {
        // 版本功能映射表
        const versionFeatures = {
            '1.238': ['bookmarkCleanup'],
            '1.239': ['sidebarFeatures'],
            '1.241': ['searchEngineUpdate'],
            '1.243': ['customTab'],
            '1.244': ['shortcuts'],
            '1.245': ['searchSuggestions'],
        };

        const features = [];

        // 如果是新安装（lastVersion 为 null），只显示当前版本的功能
        if (!lastVersion) {
            const currentFeatures = versionFeatures[currentVersion];
            return currentFeatures ? currentFeatures : [];
        }

        // 获取版本之间的所有新功能
        for (const [version, featureList] of Object.entries(versionFeatures)) {
            if (this.isNewerVersion(version, lastVersion) &&
                !this.isNewerVersion(version, currentVersion)) {
                features.push(...featureList);
            }
        }

        return features;
    }

    // 将提示添加到队列
    queueShowTips(featureKey) {
        const storageKey = `hasShown${featureKey}Tips`;
        const hasShownTips = localStorage.getItem(storageKey);

        console.log('[FeatureTips] 检查提示:', featureKey, '已显示:', hasShownTips);

        if (!hasShownTips) {
            this.tipQueue.push({
                featureKey,
                storageKey
            });
        }
    }

    // 处理队列中的下一个提示
    processNextTip() {
        // 如果正在处理中或已经检查过所有提示，直接返回
        if (this.isProcessing || (this.hasCheckedSettingsTip)) {
            return;
        }

        console.log('[FeatureTips] 处理下一个提示, 队列长度:', this.tipQueue.length, '是否正在显示:', this.isShowingTip);
        
        if (this.isShowingTip || this.tipQueue.length === 0) {
            // 如果没有新功能提示或已经显示完，检查是否需要显示设置提示
            if (!this.isShowingTip && this.tipQueue.length === 0 && !this.hasCheckedSettingsTip) {
                console.log('[FeatureTips] 新功能提示队列为空，检查设置提示');
                this.isProcessing = true;
                this.checkSettingsTip();
            }
            return;
        }

        this.isProcessing = true;
        const { featureKey, storageKey } = this.tipQueue.shift();
        this.isShowingTip = true;
        
        requestAnimationFrame(() => {
            this.showTips(featureKey);
            localStorage.setItem(storageKey, 'true');
        });
    }

    // 检查是否需要显示设置提示
    checkSettingsTip() {
        if (this.checkTimeout) {
            clearTimeout(this.checkTimeout);
        }

        // 如果已经检查过设置提示，直接返回
        if (this.hasCheckedSettingsTip && localStorage.getItem('settingsUpdateTipShown') === 'true') {
            this.isProcessing = false;
            return;
        }

        this.hasCheckedSettingsTip = true;
        this.checkTimeout = setTimeout(() => {
            const settingsTipShown = localStorage.getItem('settingsUpdateTipShown') === 'true';
            if (!settingsTipShown) {
                console.log('[FeatureTips] 显示设置提示');
                this.showSettingsUpdateTip();
            } else {
                this.isProcessing = false;
            }
        }, 100);
    }

    // 显示新功能提示
    showTips(featureKey) {
        console.log('[FeatureTips] 显示提示:', featureKey);

        const tipsElement = document.createElement('div');
        tipsElement.className = 'feature-tips';

        // 获取消息文本并将 \n 转换为 <br>
        const messageText = chrome.i18n.getMessage(featureKey + 'Feature').replace(/\n/g, '<br>');

        tipsElement.innerHTML = `
      <div class="feature-tips-content">
        <div class="tip-content">
          ${ICONS.info}
          <div class="tip-text">
            <div class="feature-tips-title">${chrome.i18n.getMessage('newFeatureTitle')}</div>
            <div class="feature-description">${messageText}</div>
          </div>
          <button class="tip-close" aria-label="关闭提示">
            ${ICONS.close}
          </button>
        </div>
      </div>
    `;

        document.body.appendChild(tipsElement);

        // 添加关闭按钮事件监听
        const closeButton = tipsElement.querySelector('.tip-close');
        closeButton.addEventListener('click', () => {
            this.closeTips(tipsElement);
        });
    }

    // 关闭提示
    closeTips(tipsElement) {
        tipsElement.style.opacity = '0';
        setTimeout(() => {
            tipsElement.remove();
            this.isShowingTip = false;
            this.isProcessing = false; // 重置处理状态
            // 处理队列中的下一个提示
            this.processNextTip();
        }, this.fadeOutDuration);
    }

    // 初始化所有提示
    initAllTips() {
        // 防止重复初始化
        if (this.tipsInitialized) {
            return;
        }
        this.tipsInitialized = true;
        
        // 重置检查状态
        this.hasCheckedSettingsTip = false;
        
        // 确保DOM已完全加载
        if (!this.domReady || !this.pageLoaded) {
            return;
        }

        // 预先隐藏所有提示
        this.hideAllTipsImmediately();
        
        // 开始检查提示
        this.startTipsCheck();
    }

    // 显示设置更新提示
    showSettingsUpdateTip() {
        if (this.isShowingTip || !this.domReady || !this.pageLoaded) {
            return;
        }
        
        // 检查localStorage，如果已经显示过，直接返回
        if (localStorage.getItem('settingsUpdateTipShown') === 'true') {
            this.isShowingTip = false;
            this.isProcessing = false;
            return;
        }
        
        this.isShowingTip = true;
        const tipContainer = document.querySelector('.settings-update-tip');
        if (tipContainer) {
            console.log('[FeatureTips] 显示设置更新提示');
            
            // 重置提示样式
            this.resetTipStyle(tipContainer);
            
            // 使用 requestAnimationFrame 和 setTimeout 确保动画平滑
            requestAnimationFrame(() => {
                setTimeout(() => {
                    tipContainer.style.opacity = '1';
                }, 50);
            });

            const closeButton = tipContainer.querySelector('.tip-close');
            if (closeButton) {
                const newCloseButton = closeButton.cloneNode(true);
                closeButton.parentNode.replaceChild(newCloseButton, closeButton);
                
                newCloseButton.addEventListener('click', () => {
                    tipContainer.classList.add('tip-fade-out');
                    tipContainer.style.opacity = '0';
                    setTimeout(() => {
                        tipContainer.style.display = 'none';
                        localStorage.setItem('settingsUpdateTipShown', 'true');
                        this.isShowingTip = false;
                        this.isProcessing = false;
                    }, 300);
                });
            } else {
                console.warn('[FeatureTips] 设置提示关闭按钮未找到');
                this.isShowingTip = false;
                this.isProcessing = false;
            }
        } else {
            console.warn('[FeatureTips] 设置提示容器未找到');
            this.isShowingTip = false;
            this.isProcessing = false;
        }
    }

    // 开始检查提示
    startTipsCheck() {
        if (this.checkTimeout) {
            clearTimeout(this.checkTimeout);
        }

        // 确保页面和DOM都已加载完成
        if (!this.domReady || !this.pageLoaded) {
            return;
        }

        this.checkTimeout = setTimeout(() => {
            if (this.tipQueue.length === 0 && !this.isShowingTip && !this.isProcessing) {
                this.processNextTip();
            }
        }, 1000);
    }
}

// 导出单例实例
export const featureTips = new FeatureTips();