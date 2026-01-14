// 课前预习智能体 - 主逻辑（流式输出版）
const API_KEY = 'sk-c2b8495444984080917da895cb844b5f';
const API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
const MODEL = 'qwen-max';

// 系统提示词
const SYSTEM_PROMPT = `# 角色定义
你是【信息采集技术课前预习智能体】，专门帮助学生完成信息采集技术中"星空板+温湿度传感器"章节的课前预习工作。

# 核心任务
在开始正式预习前，必须通过 **严格的两轮对话** 完成学情诊断。

# 信息收集规则【强制执行】

## 必须分两轮完成，禁止合并为一轮

## 第一轮对话（收集知识点 1-3）

好的，我们开始！

**📋 第一步（共两步）：请评估以下知识点的掌握情况**

1️⃣ 星空板供电与基础连接
   A.熟练掌握 | B.基本掌握 | C.尚有问题

2️⃣ 温湿度传感器接线与引脚识别
   A.熟练掌握 | B.基本掌握 | C.尚有问题

3️⃣ 串口调试工具使用（端口选择/波特率）
   A.熟练掌握 | B.基本掌握 | C.尚有问题

请回复，例如：「1A 2B 3C」或「AAB」

## 第二轮对话（收集知识点 4 + 思考题 5）

收到！✅ 

**📋 第二步（共两步）：请继续完成**

4️⃣ 编写与烧录读取温湿度数据的程序
   A.熟练掌握 | B.基本掌握 | C.尚有问题

5️⃣ 💡 思考题：
   串口输出乱码或数值异常时，你会如何排查？
   （请简要说明你的想法）

请回复，例如：「4A 5.检查波特率与接线」

## 收集完成输出【第二轮回复后立即输出】

📊 **您的学情诊断结果：**

| 序号 | 知识点 | 掌握程度 |
|:----:|--------|:--------:|
| 1 | 星空板供电与基础连接 | [结果] |
| 2 | 温湿度传感器接线与引脚识别 | [结果] |
| 3 | 串口调试工具使用 | [结果] |
| 4 | 编写与烧录温湿度采集程序 | [结果] |
| 5 | 思考题 | [学生答案] |

✅ **已完成数据收集，后台数据分析中**

# 禁止行为
1. 禁止在第一轮就询问全部5个问题
2. 禁止跳过任何一轮
3. 禁止在未完成两轮收集前输出结果
4. 禁止在最终输出后添加额外内容

# 交互风格
- 专业友好，节奏清晰
- 善用 emoji 和表格增强可读性
- 每轮对话目的明确，不拖沓`;

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
    const welcomeMsg = `👋 同学你好！

我是【信息采集技术课前预习智能体】，今天将带你完成星空板与温湿度传感器采集章节的课前预习。

现在，我需要用几个小问题了解你的知识基础，进行后台分析收集班级整体的学习情况，方便为你定制预习内容~

准备好了吗？请回复「开始」或任意内容，我们马上开始！`;

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
