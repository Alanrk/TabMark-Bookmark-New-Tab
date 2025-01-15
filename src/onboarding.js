class Onboarding {
  constructor() {
    this.currentStep = 1;
    this.totalSteps = 3;
    this.overlay = document.getElementById('onboarding-overlay');
    this.prevButton = document.querySelector('.onboarding-prev');
    this.nextButton = document.querySelector('.onboarding-next');
    this.dots = document.querySelectorAll('.onboarding-dot');
    
    this.init();
  }

  init() {
    // 检查是否是首次访问
    if (!localStorage.getItem('onboardingCompleted')) {
      this.show();
      this.bindEvents();
    }
  }

  bindEvents() {
    this.prevButton.addEventListener('click', () => this.navigate('prev'));
    this.nextButton.addEventListener('click', () => this.navigate('next'));
    
    // 允许点击圆点直接跳转到对应步骤
    document.querySelectorAll('.dot').forEach((dot, index) => {
      dot.addEventListener('click', () => this.goToStep(index + 1));
    });
  }

  show() {
    this.overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // 防止背景滚动
  }

  hide() {
    this.overlay.classList.add('hidden');
    document.body.style.overflow = '';
    localStorage.setItem('onboardingCompleted', 'true');
  }

  navigate(direction) {
    if (direction === 'next') {
      if (this.currentStep === this.totalSteps) {
        this.hide();
        return;
      }
      this.goToStep(this.currentStep + 1);
    } else {
      this.goToStep(this.currentStep - 1);
    }
  }

  goToStep(step) {
    // 更新步骤状态
    document.querySelectorAll('.onboarding-step').forEach(stepEl => {
      stepEl.classList.remove('active');
      if (parseInt(stepEl.dataset.step) === step) {
        stepEl.classList.add('active');
      }
    });

    // 更新圆点状态
    document.querySelectorAll('.dot').forEach((dot, index) => {
      dot.classList.toggle('active', index + 1 === step);
    });

    // 更新按钮状态
    this.prevButton.disabled = step === 1;
    if (step === this.totalSteps) {
      this.nextButton.textContent = window.getLocalizedMessage('finishButton');
    } else {
      this.nextButton.textContent = window.getLocalizedMessage('nextButton');
    }

    this.currentStep = step;
  }
}

// 当 DOM 加载完成后初始化引导流程
document.addEventListener('DOMContentLoaded', () => {
  new Onboarding();
}); 