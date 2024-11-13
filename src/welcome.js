let userName = localStorage.getItem('userName') || 'Orion Wang'; // 从 localStorage 获取用户名，默认值为 'Orion Wang'

function updateWelcomeMessage() {
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

  console.log('Greeting:', greeting); // 添加调试日志

  const welcomeMessage = `${greeting}, ${userName}`;
  console.log('Welcome message:', welcomeMessage); // 添加调试日志

  const welcomeElement = document.getElementById('welcome-message');
  if (welcomeElement) {
    welcomeElement.textContent = welcomeMessage;
    console.log('Welcome element updated'); // 添加调试日志
  } else {
    console.error('Welcome element not found'); // 添加错误日志
  }
}

function editUserName() {
  const newUserName = prompt("我该怎么称呼你:" , userName);
  if (newUserName && newUserName.trim() !== "") {
    userName = newUserName.trim(); // 更新用户名
    localStorage.setItem('userName', userName); // 保存到 localStorage
    updateWelcomeMessage(); // 更新显示
  }
}

// 确保 DOM 加载完成后再执行
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM content loaded'); // 添加调试日志
  updateWelcomeMessage();
  document.getElementById('welcome-message').addEventListener('click', editUserName);
});

// 每分钟更新一次欢迎消息
setInterval(updateWelcomeMessage, 60000);
