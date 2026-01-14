// 课堂答疑智能体 - 主逻辑（流式输出版）
const API_KEY = 'sk-c2b8495444984080917da895cb844b5f';
const API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const MODEL = 'qwen-max';

// 系统提示词 - 信息采集技术课堂答疑专用
const SYSTEM_PROMPT = `# 角色定义
你是【信息采集技术课堂答疑智能体】，专门解答学生在使用行空板和温湿度传感器进行信息采集实验过程中遇到的各类问题。

# 专业领域
## 核心技能
- 行空板基础连接与供电
- 温湿度传感器接线与引脚识别
- 串口调试工具使用（端口/波特率）
- 采集程序编写与烧录
- 数据输出格式与校准
- 常见异常排查（无输出/乱码/数值跳变）

## 实验场景专项
- 设备连接与驱动识别
- 串口监视器/调试工具使用
- 采样周期与数据稳定性
- 记录与截图规范

# 回答规范

## 格式要求
1. **先给结论**：用一句话说明解决方向
2. **分步骤讲解**：复杂操作编号列出
3. **关键操作/代码放在代码块中**

## 代码示例格式
使用代码块展示关键片段（示例）：
\`\`\`
initSensor();
Serial.begin(9600);
readTemperature();
readHumidity();
Serial.print("T:", temp);
Serial.print(" H:", hum);
\`\`\`

## 常用排查清单
| 场景 | 检查项 |
|------|------|
| 串口无输出 | 端口选择、供电、数据线、程序是否运行 |
| 输出乱码 | 波特率一致性、串口占用、乱码过滤 |
| 数据异常 | 接线、供电电压、采样间隔、传感器初始化 |
| 无法下载程序 | 驱动识别、下载模式、权限问题 |

# 故障排查流程
当学生遇到"无输出/乱码/数值异常"问题时，引导按以下顺序检查：
1. **硬件层**：供电是否稳定、接线是否正确、接口方向是否反
2. **连接层**：串口端口是否正确、是否使用数据线
3. **程序层**：初始化是否成功、读取函数是否调用、波特率是否一致
4. **数据层**：输出格式、刷新频率与实际环境对照

# 交互风格
- 专业但友好，像一位耐心的助教
- 遇到模糊问题，先确认具体场景
- 鼓励学生动手验证`;

// 对话历史
let conversationHistory = [];

// DOM 元素
let chatMessages, chatInput, sendBtn;

// 初始化
document.addEventListener('DOMContentLoaded', function () {
    chatMessages = document.getElementById('chat-messages');
    chatInput = document.getElementById('chat-input');
    sendBtn = document.getElementById('send-btn');

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keydown', handleKeyDown);
    chatInput.addEventListener('input', autoResize);

    showWelcomeMessage();
});

// 显示欢迎消息
function showWelcomeMessage() {
    const welcomeMsg = `您好！我是信息采集技术课堂答疑助手 👋

我可以帮您解答：
• 行空板与温湿度传感器接线
• 串口调试与波特率设置
• 程序编写、烧录与运行
• 温湿度数据异常排查

请描述您的问题，最好附上：
1. 您的接线方式或照片
2. 串口工具设置（端口/波特率）
3. 当前输出现象或报错信息`;

    addMessage('ai', welcomeMsg);
}

function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

function autoResize() {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
}

async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    setInputEnabled(false);
    addMessage('user', message);
    chatInput.value = '';
    autoResize();

    conversationHistory.push({
        role: 'user',
        content: message
    });

    await callAPIStream();
}

// 流式调用API
async function callAPIStream() {
    // 创建AI消息容器
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ai';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = 'AI';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = '<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    let fullContent = '';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    ...conversationHistory
                ],
                temperature: 0.7,
                max_tokens: 2000,
                stream: true  // 启用流式输出
            })
        });

        if (!response.ok) {
            throw new Error(`API请求失败: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data:')) {
                    const data = line.slice(5).trim();
                    if (data === '[DONE]') continue;

                    try {
                        const json = JSON.parse(data);
                        const delta = json.choices?.[0]?.delta?.content;
                        if (delta) {
                            fullContent += delta;
                            contentDiv.innerHTML = formatMessage(fullContent);
                            chatMessages.scrollTop = chatMessages.scrollHeight;
                        }
                    } catch (e) {
                        // 忽略解析错误
                    }
                }
            }
        }

        conversationHistory.push({
            role: 'assistant',
            content: fullContent
        });

    } catch (error) {
        console.error('API调用错误:', error);
        contentDiv.innerHTML = formatMessage('抱歉，连接出现问题，请稍后重试。\n\n错误信息: ' + error.message);
    }

    setInputEnabled(true);
    chatInput.focus();
}

function addMessage(type, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = type === 'ai' ? 'AI' : '我';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = formatMessage(content);

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);

    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function formatMessage(content) {
    let html = content;

    // 处理代码块
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, function (match, lang, code) {
        const escapedCode = code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .trim();
        return `<pre><code>${escapedCode}</code></pre>`;
    });

    // 转义HTML（保留已处理的标签）
    const parts = html.split(/(<pre><code>[\s\S]*?<\/code><\/pre>)/);
    html = parts.map(part => {
        if (part.startsWith('<pre><code>')) return part;
        return part
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }).join('');

    // 处理表格
    const lines = html.split('\n');
    let inTable = false;
    let tableHtml = '';
    let result = [];
    let isFirstRow = true;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith('|') && line.endsWith('|')) {
            if (!inTable) {
                inTable = true;
                tableHtml = '<table>';
                isFirstRow = true;
            }

            if (line.match(/^\|[\s\-:|]+\|$/)) continue;

            const cells = line.split('|').filter(c => c.trim() !== '');
            const tag = isFirstRow ? 'th' : 'td';

            tableHtml += '<tr>';
            cells.forEach(cell => {
                tableHtml += `<${tag}>${cell.trim()}</${tag}>`;
            });
            tableHtml += '</tr>';
            isFirstRow = false;
        } else {
            if (inTable) {
                inTable = false;
                tableHtml += '</table>';
                result.push(tableHtml);
                tableHtml = '';
            }
            result.push(line);
        }
    }

    if (inTable) {
        tableHtml += '</table>';
        result.push(tableHtml);
    }

    html = result.join('\n');

    // 行内代码
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 粗体
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // 标题（必须在换行处理之前）
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');

    // 列表
    html = html.replace(/^[•\-\*] (.+)$/gm, '<li>$1</li>');
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

    // 换行
    html = html.replace(/\n/g, '<br>');

    // 清理标题周围多余换行
    html = html.replace(/<br>(<h[2-4]>)/g, '$1');
    html = html.replace(/(<\/h[2-4]>)<br>/g, '$1');

    return html;
}

function setInputEnabled(enabled) {
    chatInput.disabled = !enabled;
    sendBtn.disabled = !enabled;
}
