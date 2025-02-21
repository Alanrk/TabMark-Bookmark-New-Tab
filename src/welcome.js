let userName = localStorage.getItem('userName') || 'Sowhale';

// 集中管理欢迎消息的颜色逻辑
const WelcomeManager = {
    colorCache: {
        lastBackground: null,
        lastTextColor: null
    },

    // 初始化方法
    initialize() {
        this.updateWelcomeMessage();
        this.initializeColorCache();
        this.setupEventListeners();
        this.setupThemeChangeListener();
    },

    // 更新欢迎消息
    updateWelcomeMessage() {
        const now = new Date();
        const hours = now.getHours();
        let greeting;
        
        if (hours < 12) {
            greeting = window.getLocalizedMessage('morningGreeting');
        } else if (hours < 18) {
            greeting = window.getLocalizedMessage('afternoonGreeting');
        } else {
            greeting = window.getLocalizedMessage('eveningGreeting');
        }

        const welcomeMessage = `${greeting}, ${userName}`;
        const welcomeElement = document.getElementById('welcome-message');
        if (welcomeElement) {
            welcomeElement.textContent = welcomeMessage;
            this.adjustTextColor(welcomeElement);
        }
    },

    // 初始化颜色缓存
    initializeColorCache() {
        const computedStyle = window.getComputedStyle(document.documentElement);
        const backgroundColor = computedStyle.backgroundColor;
        const backgroundImage = document.body.style.backgroundImage;
        
        // 计算初始文字颜色
        if (backgroundColor && backgroundColor !== 'rgba(0, 0, 0, 0)' && backgroundColor !== 'transparent') {
            const rgb = backgroundColor.match(/\d+/g);
            if (rgb && rgb.length >= 3) {
                const brightness = (parseInt(rgb[0]) * 0.299 + parseInt(rgb[1]) * 0.587 + parseInt(rgb[2]) * 0.114);
                this.colorCache.lastTextColor = brightness > 128 ? 'rgba(51, 51, 51, 0.9)' : 'rgba(255, 255, 255, 0.9)';
            }
        }
        
        this.colorCache.lastBackground = backgroundImage !== 'none' ? backgroundImage : backgroundColor;
        
        // 应用初始颜色
        const welcomeElement = document.getElementById('welcome-message');
        if (welcomeElement) {
            welcomeElement.style.color = this.colorCache.lastTextColor || 'rgba(51, 51, 51, 0.9)';
        }
    },

    // 调整文字颜色
    adjustTextColor(element) {
        const computedStyle = window.getComputedStyle(document.documentElement);
        const backgroundColor = computedStyle.backgroundColor;
        const backgroundImage = document.body.style.backgroundImage;
        const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
        
        // 处理纯色背景的情况
        if (!backgroundImage || backgroundImage === 'none') {
            // 如果是暗色模式，直接使用亮色文本
            if (isDarkMode) {
                element.style.color = 'rgba(255, 255, 255, 0.9)';
                this.colorCache.lastTextColor = 'rgba(255, 255, 255, 0.9)';
                return;
            }
            
            // 亮色模式下，根据背景色计算文字颜色
            let textColor = 'rgba(51, 51, 51, 0.9)'; // 默认深色文本
            
            if (backgroundColor && backgroundColor !== 'rgba(0, 0, 0, 0)' && backgroundColor !== 'transparent') {
                const rgb = backgroundColor.match(/\d+/g);
                if (rgb && rgb.length >= 3) {
                    const brightness = (parseInt(rgb[0]) * 0.299 + parseInt(rgb[1]) * 0.587 + parseInt(rgb[2]) * 0.114);
                    textColor = brightness > 128 ? 'rgba(51, 51, 51, 0.9)' : 'rgba(255, 255, 255, 0.9)';
                }
            }
            
            this.colorCache.lastTextColor = textColor;
            element.style.color = textColor;
            return;
        }

        // 处理壁纸背景的情况
        if (backgroundImage && backgroundImage !== 'none') {
            // 先检查缓存
            if (this.colorCache.lastBackground === backgroundImage && this.colorCache.lastTextColor) {
                element.style.color = this.colorCache.lastTextColor;
                // 如果有缓存，仍然进行新的计算，但不设置临时的白色文本
            } else {
                // 只有在没有缓存时才设置临时的白色文本
                element.style.color = 'rgba(255, 255, 255, 0.9)';
            }
            
            // 进行新的计算...
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = backgroundImage.slice(5, -2);
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const sampleSize = 50;

                // 获取欢迎文字元素的位置和尺寸
                const elementRect = element.getBoundingClientRect();
                
                // 计算采样区域
                const sampleArea = {
                    x: Math.max(0, elementRect.x),
                    y: Math.max(0, elementRect.y),
                    width: Math.min(elementRect.width, window.innerWidth),
                    height: Math.min(elementRect.height, window.innerHeight)
                };

                // 设置画布尺寸
                canvas.width = sampleSize;
                canvas.height = sampleSize;

                // 计算图片在背景中的实际尺寸和位置
                const backgroundSize = getComputedStyle(document.body).backgroundSize;
                const backgroundPosition = getComputedStyle(document.body).backgroundPosition;
                
                // 计算图片的缩放比例
                const scale = {
                    x: img.width / window.innerWidth,
                    y: img.height / window.innerHeight
                };

                // 根据背景属性计算实际的采样区域
                const sourceArea = {
                    x: (sampleArea.x * scale.x),
                    y: (sampleArea.y * scale.y),
                    width: (sampleArea.width * scale.x),
                    height: (sampleArea.height * scale.y)
                };

                // 绘制采样区域到画布
                ctx.drawImage(
                    img,
                    sourceArea.x, sourceArea.y, sourceArea.width, sourceArea.height,  // 源图像区域
                    0, 0, sampleSize, sampleSize  // 目标画布区域
                );

                try {
                    const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
                    const data = imageData.data;
                    let r = 0, g = 0, b = 0;
                    let count = 0;

                    // 计算采样区域的平均颜色
                    for (let x = 0, len = data.length; x < len; x += 4) {
                        r += data[x];
                        g += data[x + 1];
                        b += data[x + 2];
                        count++;
                    }

                    r = Math.floor(r / count);
                    g = Math.floor(g / count);
                    b = Math.floor(b / count);

                    const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
                    console.log('[WelcomeManager] Sampled area color:', {
                        area: sampleArea,
                        color: {r, g, b},
                        brightness
                    });

                    const textColor = brightness > 128 ? 
                        'rgba(51, 51, 51, 0.9)' : 
                        'rgba(255, 255, 255, 0.9)';
                    
                    // 更新缓存和应用颜色
                    this.colorCache.lastBackground = backgroundImage;
                    this.colorCache.lastTextColor = textColor;
                    element.style.color = textColor;
                    element.style.transition = 'color 0.3s ease';
                } catch (error) {
                    console.error('分析背景颜色失败:', error, {
                        sampleArea,
                        sourceArea
                    });
                    element.style.color = 'rgba(255, 255, 255, 0.9)';
                }
            };

            img.onerror = () => {
                console.error('背景图片加载失败');
                if (!this.colorCache.lastTextColor) {
                    // 只有在没有缓存颜色时才设置默认颜色
                    element.style.color = 'rgba(255, 255, 255, 0.9)';
                }
            };

            // 在图片加载过程中先使用白色文本
            element.style.color = 'rgba(255, 255, 255, 0.9)';
            return;
        }
    },

    // 设置事件监听器
    setupEventListeners() {
        document.getElementById('welcome-message').addEventListener('click', () => {
            // 使用 chrome.i18n.getMessage 获取本地化的提示文本
            const newUserName = prompt(chrome.i18n.getMessage("namePrompt"), userName);
            if (newUserName && newUserName.trim() !== "") {
                userName = newUserName.trim();
                localStorage.setItem('userName', userName);
                this.updateWelcomeMessage();
            }
        });
    },

    // 添加主题变化监听方法
    setupThemeChangeListener() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'data-theme') {
                    const welcomeElement = document.getElementById('welcome-message');
                    if (welcomeElement) {
                        this.adjustTextColor(welcomeElement);
                    }
                }
            });
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme']
        });
    }
};

// 导出给其他模块使用的方法
window.WelcomeManager = WelcomeManager;

// DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    WelcomeManager.initialize();
    // 每分钟更新一次欢迎消息
    setInterval(() => WelcomeManager.updateWelcomeMessage(), 60000);
});
