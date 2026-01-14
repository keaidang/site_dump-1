// 问卷系统主逻辑
document.addEventListener('DOMContentLoaded', function () {
    initializeForm();
    initializeUploadAreas();
    initializeToggleButtons();
    initializeAutoSave();
    loadSavedData();
});

// 表单初始化
function initializeForm() {
    const form = document.getElementById('questionnaire-form');
    form.addEventListener('submit', handleSubmit);
}

// 截图上传区域初始化
function initializeUploadAreas() {
    const uploadAreas = document.querySelectorAll('.upload-area');

    uploadAreas.forEach(area => {
        const step = area.dataset.step;
        const fileInput = area.querySelector('input[type="file"]');
        const previewImg = area.querySelector('.preview-image');

        // 点击上传
        area.addEventListener('click', () => fileInput.click());

        // 文件选择
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) handleImageUpload(file, area, previewImg);
        });

        // 拖拽上传
        area.addEventListener('dragover', (e) => {
            e.preventDefault();
            area.style.borderColor = 'var(--accent-color)';
            area.style.background = 'rgba(0, 212, 255, 0.1)';
        });

        area.addEventListener('dragleave', () => {
            area.style.borderColor = '';
            area.style.background = '';
        });

        area.addEventListener('drop', (e) => {
            e.preventDefault();
            area.style.borderColor = '';
            area.style.background = '';
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                handleImageUpload(file, area, previewImg);
            }
        });

        // 粘贴上传
        area.addEventListener('paste', (e) => {
            const items = e.clipboardData.items;
            for (let item of items) {
                if (item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    handleImageUpload(file, area, previewImg);
                    break;
                }
            }
        });

        // 让区域可以接收粘贴事件
        area.setAttribute('tabindex', '0');
    });

    // 全局粘贴监听
    document.addEventListener('paste', (e) => {
        const focusedUpload = document.activeElement.closest('.upload-area');
        if (focusedUpload) {
            const items = e.clipboardData.items;
            for (let item of items) {
                if (item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    const previewImg = focusedUpload.querySelector('.preview-image');
                    handleImageUpload(file, focusedUpload, previewImg);
                    break;
                }
            }
        }
    });
}

// 处理图片上传
function handleImageUpload(file, area, previewImg) {
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImg.src = e.target.result;
        area.classList.add('has-image');
        saveToLocalStorage();
    };
    reader.readAsDataURL(file);
}

// 成功/失败切换按钮初始化
function initializeToggleButtons() {
    const toggleButtons = document.querySelectorAll('.toggle-btn');

    toggleButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            const container = this.closest('.toggle-buttons');
            const hiddenInput = container.nextElementSibling;

            // 移除同组其他按钮的激活状态
            container.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));

            // 激活当前按钮
            this.classList.add('active');
            hiddenInput.value = this.dataset.value;

            saveToLocalStorage();
        });
    });
}

// 自动保存功能
let autoSaveTimeout;
function initializeAutoSave() {
    const form = document.getElementById('questionnaire-form');
    const indicator = document.querySelector('.auto-save-indicator');

    form.addEventListener('input', () => {
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => {
            saveToLocalStorage();
            showSaveIndicator(indicator);
        }, 1000);
    });
}

function showSaveIndicator(indicator) {
    indicator.classList.add('visible');
    setTimeout(() => indicator.classList.remove('visible'), 2000);
}

// 保存到本地存储
function saveToLocalStorage() {
    const form = document.getElementById('questionnaire-form');
    const formData = new FormData(form);
    const data = {};

    formData.forEach((value, key) => {
        data[key] = value;
    });

    // 保存图片预览
    document.querySelectorAll('.upload-area.has-image').forEach(area => {
        const step = area.dataset.step;
        const img = area.querySelector('.preview-image');
        if (img.src) {
            data[`screenshot_${step}_data`] = img.src;
        }
    });

    localStorage.setItem('questionnaire_data', JSON.stringify(data));
}

// 从本地存储加载数据
function loadSavedData() {
    const savedData = localStorage.getItem('questionnaire_data');
    if (!savedData) return;

    try {
        const data = JSON.parse(savedData);
        const form = document.getElementById('questionnaire-form');

        Object.keys(data).forEach(key => {
            if (key.startsWith('screenshot_') && key.endsWith('_data')) {
                // 恢复图片
                const step = key.replace('screenshot_', '').replace('_data', '');
                const area = document.querySelector(`.upload-area[data-step="${step}"]`);
                if (area) {
                    const img = area.querySelector('.preview-image');
                    img.src = data[key];
                    area.classList.add('has-image');
                }
            } else if (key.includes('_status')) {
                // 恢复切换按钮状态
                const hiddenInput = form.querySelector(`input[name="${key}"]`);
                if (hiddenInput) {
                    hiddenInput.value = data[key];
                    const container = hiddenInput.previousElementSibling;
                    container.querySelectorAll('.toggle-btn').forEach(btn => {
                        if (btn.dataset.value === data[key]) {
                            btn.classList.add('active');
                        }
                    });
                }
            } else {
                // 恢复普通输入
                const input = form.querySelector(`[name="${key}"]`);
                if (input) input.value = data[key];
            }
        });
    } catch (e) {
        console.error('Failed to load saved data:', e);
    }
}

// 表单提交处理
function handleSubmit(e) {
    e.preventDefault();

    // 验证必填项
    const form = e.target;
    const requiredFields = form.querySelectorAll('[required]');
    let isValid = true;

    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            isValid = false;
            field.style.borderColor = 'var(--error-color)';
            field.addEventListener('input', function handler() {
                this.style.borderColor = '';
                this.removeEventListener('input', handler);
            });
        }
    });

    if (!isValid) {
        // 滚动到第一个错误字段
        const firstError = form.querySelector('[required]:invalid, [required][style*="error"]');
        if (firstError) {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            firstError.focus();
        }
        return;
    }

    // 收集表单数据
    const formData = collectFormData(form);

    // 显示提交动画
    showSubmitOverlay(formData);
}

// 收集表单数据
function collectFormData(form) {
    const data = {
        studentInfo: {
            name: form.studentName.value,
            id: form.studentId.value,
            group: form.groupNumber.value
        },
        steps: [],
        answers: {
            q1: form.answer1.value,
            q2: form.answer2.value,
            q3: form.answer3.value
        },
        submittedAt: new Date().toISOString()
    };

    // 收集步骤数据
    for (let i = 1; i <= 8; i++) {
        const stepData = { step: i };
        const statusInput = form.querySelector(`input[name="step${i}_status"]`);
        if (statusInput) stepData.status = statusInput.value;
        data.steps.push(stepData);
    }

    return data;
}

// 显示提交遮罩层
function showSubmitOverlay(formData) {
    const overlay = document.getElementById('submit-overlay');
    const loadingPhase = document.getElementById('loading-phase');
    const successPhase = document.getElementById('success-phase');
    const progressFill = overlay.querySelector('.progress-fill');
    const analysisSteps = overlay.querySelectorAll('.analysis-step');

    // 重置状态
    loadingPhase.classList.remove('hidden');
    successPhase.classList.add('hidden');
    progressFill.style.width = '0%';
    analysisSteps.forEach(step => {
        step.classList.remove('active', 'completed');
        step.querySelector('.step-check').textContent = '⏳';
    });

    // 显示遮罩
    overlay.classList.remove('hidden');

    // 模拟分析过程
    simulateAnalysis(formData, progressFill, analysisSteps, loadingPhase, successPhase);
}

// 模拟分析过程
function simulateAnalysis(formData, progressFill, steps, loadingPhase, successPhase) {
    let currentStep = 0;
    const totalSteps = steps.length;
    const stepDuration = 1000;

    function processStep() {
        if (currentStep >= totalSteps) {
            // 完成所有步骤
            setTimeout(() => {
                loadingPhase.classList.add('hidden');
                successPhase.classList.remove('hidden');

                // 设置提交信息
                document.getElementById('submit-time').textContent =
                    new Date().toLocaleString('zh-CN');
                document.getElementById('submit-id').textContent =
                    'RPT-' + generateRandomId(8);

                // 清除本地存储
                localStorage.removeItem('questionnaire_data');
            }, 500);
            return;
        }

        // 激活当前步骤
        steps[currentStep].classList.add('active');

        // 更新进度条
        const progress = ((currentStep + 1) / totalSteps) * 100;
        progressFill.style.width = progress + '%';

        // 完成当前步骤
        setTimeout(() => {
            steps[currentStep].classList.remove('active');
            steps[currentStep].classList.add('completed');
            steps[currentStep].querySelector('.step-check').textContent = '✓';
            currentStep++;
            processStep();
        }, stepDuration);
    }

    // 开始处理
    setTimeout(processStep, 500);
}

// 关闭遮罩层
function closeOverlay() {
    const overlay = document.getElementById('submit-overlay');
    overlay.classList.add('hidden');

    // 重置表单
    document.getElementById('questionnaire-form').reset();

    // 重置图片上传区域
    document.querySelectorAll('.upload-area').forEach(area => {
        area.classList.remove('has-image');
        const img = area.querySelector('.preview-image');
        img.src = '';
    });

    // 重置切换按钮
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // 滚动到顶部
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 生成随机报告编号
function generateRandomId(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
