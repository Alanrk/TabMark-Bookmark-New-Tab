document.addEventListener('DOMContentLoaded', function () {
    const yearProgressContainer = document.getElementById('year-progress');
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const endOfYear = new Date(currentYear, 11, 31, 23, 59, 59);
    const now = new Date();
    const yearProgress = ((now - startOfYear) / (endOfYear - startOfYear)) * 100;

    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';

    for (let i = 0; i < 12; i++) {
        const progressSegment = document.createElement('div');
        if (i < Math.floor(yearProgress / 8.33)) {
            progressSegment.classList.add('active');
        }
        progressBar.appendChild(progressSegment);
    }

    const yearProgressElement = document.createElement('div');
    yearProgressElement.className = 'year-progress';
    const yearProgressText = chrome.i18n.getMessage('yearProgress');
    yearProgressElement.innerHTML = `<span>${currentYear} ${yearProgressText}</span>`;
    yearProgressElement.appendChild(progressBar);

    const progressPercentage = document.createElement('div');
    progressPercentage.className = 'progress-percentage';
    progressPercentage.textContent = `${yearProgress.toFixed(2)}%`;

    yearProgressContainer.appendChild(yearProgressElement);
    yearProgressContainer.appendChild(progressPercentage);
});