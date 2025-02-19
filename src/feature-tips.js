import { ICONS } from './icons.js';

// 新功能提示管理类
class FeatureTips {
    constructor() {
        this.fadeOutDuration = 300; // 淡出动画时长(毫秒)
        this.init();
    }

    // 初始化
    async init() {
        // 获取当前版本号
        this.currentVersion = await this.getExtensionVersion();
        this.checkVersionUpdate();
    }

    // 获取扩展版本号
    async getExtensionVersion() {
        const manifest = chrome.runtime.getManifest();
        return manifest.version;
    }

    // 检查版本更新
    async checkVersionUpdate() {
        const lastVersion = localStorage.getItem('lastVersion');
        console.log('Current version:', this.currentVersion, 'Last version:', lastVersion); // 调试日志

        if (!lastVersion || this.isNewerVersion(this.currentVersion, lastVersion)) {
            // 获取该版本的所有新功能提示
            const features = await this.getVersionFeatures(lastVersion, this.currentVersion);

            // 显示新功能提示
            for (const feature of features) {
                this.checkShowTips(feature);
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
            '1.241': ['searchEngineUpdate']
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

    // 检查是否需要显示特定功能的提示
    checkShowTips(featureKey) {
        const storageKey = `hasShown${featureKey}Tips`;
        const hasShownTips = localStorage.getItem(storageKey);

        console.log('Checking tips for:', featureKey, 'hasShownTips:', hasShownTips); // 调试日志

        if (!hasShownTips) {
            this.showTips(featureKey);
            localStorage.setItem(storageKey, 'true');
        }
    }

    // 显示新功能提示
    showTips(featureKey) {
        console.log('Showing tips for:', featureKey);

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
        }, this.fadeOutDuration);
    }

    // 显示搜索引擎更新提示
    showSearchEngineUpdateTip() {
        const searchTipShown = localStorage.getItem('searchEngineUpdateTipShown') === 'true';
        if (searchTipShown) {
            this.showSettingsUpdateTip();
            const searchTip = document.querySelector('.search-engine-update-tip');
            if (searchTip) {
                searchTip.style.display = 'none';
            }
            return;
        }

        const tipContainer = document.querySelector('.search-engine-update-tip');
        if (tipContainer) {
            tipContainer.style.display = 'block';

            const closeButton = tipContainer.querySelector('.tip-close');
            closeButton.addEventListener('click', () => {
                tipContainer.classList.add('tip-fade-out');
                setTimeout(() => {
                    tipContainer.style.display = 'none';
                    localStorage.setItem('searchEngineUpdateTipShown', 'true');
                    this.showSettingsUpdateTip();
                }, 300);
            });
        }
    }

    // 显示设置更新提示
    showSettingsUpdateTip() {
        const settingsTipShown = localStorage.getItem('settingsUpdateTipShown') === 'true';
        if (settingsTipShown) {
            return;
        }

        const tipContainer = document.querySelector('.settings-update-tip');
        if (tipContainer) {
            tipContainer.style.display = 'block';

            const closeButton = tipContainer.querySelector('.tip-close');
            closeButton.addEventListener('click', () => {
                tipContainer.classList.add('tip-fade-out');
                setTimeout(() => {
                    tipContainer.style.display = 'none';
                    localStorage.setItem('settingsUpdateTipShown', 'true');
                }, 300);
            });
        }
    }

    // 初始化所有提示
    initAllTips() {
        // 初始化时隐藏设置提示
        const settingsTip = document.querySelector('.settings-update-tip');
        if (settingsTip) {
            settingsTip.style.display = 'none';
        }

        // 显示搜索引擎更新提示
        this.showSearchEngineUpdateTip();
    }
}

// 导出单例实例
export const featureTips = new FeatureTips();