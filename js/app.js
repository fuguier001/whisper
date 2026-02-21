/**
 * 悄悄话 - 主应用逻辑
 *
 * 整合加密、邮件、存储模块,实现完整的聊天功能
 */

class WhisperApp {
  constructor() {
    this.crypto = new CryptoManager();
    this.email = new EmailManager();
    this.storage = new StorageManager();

    this.config = {
      myEmail: '',
      peerEmail: '',
      emailServiceId: '',
      emailTemplateId: '',
      emailUserId: ''
    };

    this.isConnected = false;
    this.isExchangeComplete = false; // 公钥交换是否完成
  }

  /**
   * 初始化应用
   */
  async init() {
    try {
      console.log('🚀 初始化悄悄话...');

      // 初始化存储
      await this.storage.init();

      // 加载配置
      await this.loadConfig();

      // 尝试加载私钥
      const hasKey = await this.crypto.loadPrivateKey();

      if (hasKey) {
        console.log('✅ 找到本地密钥对');
        await this.initKeys();
      } else {
        console.log('⚠️ 未找到本地密钥,需要生成新密钥');
      }

      // 加载消息历史
      await this.loadMessageHistory();

      console.log('✅ 悄悄话初始化完成');
      return true;
    } catch (error) {
      console.error('❌ 初始化失败:', error);
      return false;
    }
  }

  /**
   * 加载配置
   */
  async loadConfig() {
    try {
      const config = await this.storage.getConfig('user_config');
      if (config) {
        this.config = { ...this.config, ...config };
        console.log('✅ 配置加载成功');

        // 初始化邮件服务
        if (config.emailServiceId && config.emailUserId) {
          await this.email.init({
            serviceId: config.emailServiceId,
            templateId: config.emailTemplateId,
            userId: config.emailUserId,
            myEmail: config.myEmail,
            peerEmail: config.peerEmail
          });

          this.isConnected = true;
        }
      }
    } catch (error) {
      console.error('❌ 加载配置失败:', error);
    }
  }

  /**
   * 保存配置
   */
  async saveConfig(config) {
    try {
      this.config = { ...this.config, ...config };

      await this.storage.saveConfig('user_config', this.config);

      // 初始化邮件服务
      await this.email.init({
        serviceId: this.config.emailServiceId,
        templateId: this.config.emailTemplateId,
        userId: this.config.emailUserId,
        myEmail: this.config.myEmail,
        peerEmail: this.config.peerEmail
      });

      this.isConnected = true;
      console.log('✅ 配置保存成功');

      return true;
    } catch (error) {
      console.error('❌ 保存配置失败:', error);
      return false;
    }
  }

  /**
   * 生成新密钥对
   */
  async generateKeyPair() {
    try {
      await this.crypto.generateKeyPair();
      await this.crypto.savePrivateKey();

      // 获取公钥和指纹
      const publicKey = await this.crypto.exportPublicKey();
      const fingerprint = await this.crypto.generateKeyFingerprint();

      console.log('✅ 密钥对生成完成');
      console.log('🔐 公钥指纹:', fingerprint);

      // 自动发送公钥给对方
      await this.sendPublicKey();

      return {
        publicKey: publicKey,
        fingerprint: fingerprint
      };
    } catch (error) {
      console.error('❌ 生成密钥对失败:', error);
      throw error;
    }
  }

  /**
   * 初始化密钥(加载公钥)
   */
  async initKeys() {
    try {
      // 加载对方公钥
      const peerKey = await this.storage.getPublicKey(this.config.peerEmail);

      if (peerKey) {
        await this.crypto.importPublicKey(peerKey);
        this.isExchangeComplete = true;
        console.log('✅ 公钥交换已完成');
      } else {
        console.log('⚠️ 对方公钥未找到,需要先交换公钥');
      }
    } catch (error) {
      console.error('❌ 初始化密钥失败:', error);
    }
  }

  /**
   * 发送公钥
   */
  async sendPublicKey() {
    try {
      const publicKey = await this.crypto.exportPublicKey();
      await this.email.sendPublicKey(publicKey);
      await this.storage.savePublicKey(this.config.myEmail, publicKey);

      console.log('✅ 公钥已发送');
      return true;
    } catch (error) {
      console.error('❌ 发送公钥失败:', error);
      return false;
    }
  }

  /**
   * 导入对方公钥
   */
  async importPeerPublicKey(publicKeyBase64) {
    try {
      await this.crypto.importPublicKey(publicKeyBase64);
      await this.storage.savePublicKey(this.config.peerEmail, publicKeyBase64);

      this.isExchangeComplete = true;
      console.log('✅ 对方公钥已导入');

      return true;
    } catch (error) {
      console.error('❌ 导入公钥失败:', error);
      return false;
    }
  }

  /**
   * 发送消息
   * @param {string} content - 消息内容
   */
  async sendMessage(content) {
    try {
      if (!this.isExchangeComplete) {
        throw new Error('公钥交换未完成,无法发送加密消息');
      }

      // 生成AES密钥
      const aesKey = await this.crypto.generateAESKey();

      // 加密消息内容
      const encrypted = await this.crypto.encryptMessage(content, aesKey);

      // 加密AES密钥
      const encryptedKey = await this.crypto.encryptAESKey(aesKey);

      // 构造消息数据
      const messageData = {
        encryptedKey: encryptedKey,
        encryptedContent: encrypted.encrypted,
        iv: encrypted.iv,
        timestamp: new Date().toISOString(),
        sender: this.config.myEmail,
        recipient: this.config.peerEmail
      };

      // 发送邮件
      await this.email.sendMessage(messageData);

      // 保存到本地
      await this.storage.saveMessage({
        type: 'text',
        content: content, // 本地存储明文(方便查看)
        encryptedContent: encrypted.encrypted, // 存储密文(用于验证)
        sender: this.config.myEmail,
        timestamp: messageData.timestamp,
        encryptedKey: encryptedKey,
        iv: encrypted.iv,
        incoming: false
      });

      console.log('✅ 消息已发送');
      return true;
    } catch (error) {
      console.error('❌ 发送消息失败:', error);
      throw error;
    }
  }

  /**
   * 发送文件/图片
   * @param {File} file - 文件对象
   */
  async sendFile(file) {
    try {
      if (!this.isExchangeComplete) {
        throw new Error('公钥交换未完成,无法发送加密文件');
      }

      // 检查文件大小(限制10MB)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new Error('文件过大,最大支持10MB');
      }

      // 显示进度
      showToast('正在加密文件...');

      // 生成AES密钥
      const aesKey = await this.crypto.generateAESKey();

      // 加密文件
      const encryptedFile = await this.crypto.encryptFile(file, aesKey);

      // 加密AES密钥
      const encryptedKey = await this.crypto.encryptAESKey(aesKey);

      // 判断文件类型
      const isImage = file.type.startsWith('image/');
      const messageType = isImage ? 'image' : 'file';

      // 构造消息数据
      const messageData = {
        encryptedKey: encryptedKey,
        encryptedContent: encryptedFile.encrypted,
        iv: encryptedFile.iv,
        timestamp: new Date().toISOString(),
        sender: this.config.myEmail,
        recipient: this.config.peerEmail,
        type: messageType,
        fileName: encryptedFile.fileName,
        fileType: encryptedFile.fileType,
        fileSize: encryptedFile.fileSize
      };

      // 发送邮件
      await this.email.sendMessage(messageData);

      // 保存到本地(对于图片,保存预览URL)
      let previewData = null;
      if (isImage) {
        const reader = new FileReader();
        previewData = await new Promise((resolve) => {
          reader.onload = (e) => resolve(e.target.result);
          reader.readAsDataURL(file);
        });
      }

      await this.storage.saveMessage({
        type: messageType,
        content: isImage ? previewData : null, // 图片保存预览,文件保存null
        fileName: encryptedFile.fileName,
        fileType: encryptedFile.fileType,
        fileSize: encryptedFile.fileSize,
        encryptedContent: encryptedFile.encrypted,
        sender: this.config.myEmail,
        timestamp: messageData.timestamp,
        encryptedKey: encryptedKey,
        iv: encryptedFile.iv,
        incoming: false
      });

      console.log('✅ 文件已发送');
      return true;
    } catch (error) {
      console.error('❌ 发送文件失败:', error);
      throw error;
    }
  }

  /**
   * 接收消息
   */
  async onMessageReceived(messageData) {
    try {
      console.log('📨 收到新消息');

      // 解密AES密钥
      const aesKey = await this.crypto.decryptAESKey(messageData.encrypted_key);

      let content = null;
      let messageType = messageData.type || 'text';

      // 根据消息类型解密
      if (messageType === 'text') {
        // 解密文本消息
        content = await this.crypto.decryptMessage(
          messageData.encrypted_content,
          messageData.iv,
          aesKey
        );
        console.log('✅ 消息解密成功:', content);
      } else if (messageType === 'image' || messageType === 'file') {
        // 文件消息 - 解密并生成预览
        if (messageType === 'image') {
          content = await this.crypto.decryptFileToDataUrl(
            messageData.encrypted_content,
            messageData.iv,
            aesKey,
            messageData.fileType
          );
        }
        console.log('✅ 文件解密成功');
      }

      // 保存到本地
      await this.storage.saveMessage({
        type: messageType,
        content: content,
        fileName: messageData.fileName,
        fileType: messageData.fileType,
        fileSize: messageData.fileSize,
        encryptedContent: messageData.encrypted_content,
        sender: messageData.sender,
        timestamp: messageData.timestamp,
        encryptedKey: messageData.encrypted_key,
        iv: messageData.iv,
        incoming: true
      });

      // 触发UI更新
      if (this.onMessageCallback) {
        this.onMessageCallback({
          type: messageType,
          content: content,
          fileName: messageData.fileName,
          fileType: messageData.fileType,
          fileSize: messageData.fileSize,
          sender: messageData.sender,
          timestamp: messageData.timestamp,
          incoming: true
        });
      }

      return decrypted;
    } catch (error) {
      console.error('❌ 处理接收消息失败:', error);
      throw error;
    }
  }

  /**
   * 加载消息历史
   */
  async loadMessageHistory() {
    try {
      const messages = await this.storage.getRecentMessages(100);
      console.log(`📋 加载了 ${messages.length} 条历史消息`);
      return messages;
    } catch (error) {
      console.error('❌ 加载消息历史失败:', error);
      return [];
    }
  }

  /**
   * 开始轮询新消息
   */
  startPolling() {
    this.email.startPolling(async (messageData) => {
      await this.onMessageReceived(messageData);
    });
  }

  /**
   * 停止轮询
   */
  stopPolling() {
    this.email.stopPolling();
  }

  /**
   * 设置消息回调
   */
  onMessage(callback) {
    this.onMessageCallback = callback;
  }

  /**
   * 获取公钥指纹
   */
  async getMyKeyFingerprint() {
    return await this.crypto.generateKeyFingerprint();
  }

  /**
   * 导出私钥(用于备份)
   */
  async exportPrivateKey() {
    // 私钥已在localStorage中
    return localStorage.getItem('whisper_private_key');
  }

  /**
   * 导入私钥(用于恢复)
   */
  async importPrivateKey(privateKeyBase64) {
    localStorage.setItem('whisper_private_key', privateKeyBase64);
    return await this.crypto.loadPrivateKey();
  }

  /**
   * 清除所有数据(慎用!)
   */
  async clearAll() {
    // 清除IndexedDB
    await this.storage.clearAllMessages();

    // 清除localStorage
    this.crypto.clearPrivateKey();

    // 停止轮询
    this.stopPolling();

    console.log('✅ 所有数据已清除');
  }
}

// 全局实例
const app = new WhisperApp();

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
  console.log('📱 悄悄话 v1.0');

  // 初始化应用
  await app.init();

  // 绑定UI事件
  bindUIEvents();

  // 如果已连接,自动开始轮询
  if (app.isConnected) {
    app.startPolling();
  }
});

/**
 * 绑定UI事件
 */
function bindUIEvents() {
  // 配置按钮
  const configBtn = document.getElementById('configBtn');
  if (configBtn) {
    configBtn.addEventListener('click', showConfigDialog);
  }

  // 生成密钥按钮
  const generateKeyBtn = document.getElementById('generateKeyBtn');
  if (generateKeyBtn) {
    generateKeyBtn.addEventListener('click', async () => {
      try {
        const result = await app.generateKeyPair();
        alert('密钥对已生成!\n\n请将以下公钥发送给对方:\n\n' + result.publicKey);
        displayKeyFingerprint(result.fingerprint);
      } catch (error) {
        alert('生成密钥失败: ' + error.message);
      }
    });
  }

  // 导入公钥按钮
  const importKeyBtn = document.getElementById('importKeyBtn');
  if (importKeyBtn) {
    importKeyBtn.addEventListener('click', () => {
      const publicKey = prompt('请输入对方的公钥(Base64格式):');
      if (publicKey) {
        app.importPeerPublicKey(publicKey).then(success => {
          if (success) {
            alert('公钥导入成功!');
          } else {
            alert('公钥导入失败!');
          }
        });
      }
    });
  }

  // 发送消息按钮
  const sendBtn = document.getElementById('sendBtn');
  if (sendBtn) {
    sendBtn.addEventListener('click', sendMessage);
  }

  // 回车发送
  const messageInput = document.getElementById('messageInput');
  if (messageInput) {
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  // 附件按钮
  const attachBtn = document.getElementById('attachBtn');
  const fileInput = document.getElementById('fileInput');
  if (attachBtn && fileInput) {
    attachBtn.addEventListener('click', () => {
      fileInput.click();
    });

    // 文件选择
    let selectedFile = null;
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      selectedFile = file;

      // 如果是图片,显示预览
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const preview = document.getElementById('imagePreview');
          const previewImage = document.getElementById('previewImage');
          previewImage.src = e.target.result;
          preview.style.display = 'flex';
        };
        reader.readAsDataURL(file);
      } else {
        // 非图片文件直接确认
        if (confirm(`要发送文件 "${file.name}" 吗?`)) {
          sendFile(file);
        }
      }
    });

    // 确认上传
    const confirmUpload = document.getElementById('confirmUpload');
    if (confirmUpload) {
      confirmUpload.addEventListener('click', () => {
        if (selectedFile) {
          sendFile(selectedFile);
          document.getElementById('imagePreview').style.display = 'none';
          selectedFile = null;
          fileInput.value = '';
        }
      });
    }

    // 取消上传
    const cancelUpload = document.getElementById('cancelUpload');
    if (cancelUpload) {
      cancelUpload.addEventListener('click', () => {
        document.getElementById('imagePreview').style.display = 'none';
        selectedFile = null;
        fileInput.value = '';
      });
    }
  }

  // 表情按钮
  const emojiBtn = document.getElementById('emojiBtn');
  const emojiPicker = document.getElementById('emojiPicker');
  if (emojiBtn && emojiPicker) {
    let isEmojiPickerVisible = false;

    // 初始化表情数据
    initEmojiPicker();

    emojiBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      isEmojiPickerVisible = !isEmojiPickerVisible;
      emojiPicker.style.display = isEmojiPickerVisible ? 'block' : 'none';
    });

    // 点击其他地方关闭表情选择器
    document.addEventListener('click', (e) => {
      if (isEmojiPickerVisible && !emojiPicker.contains(e.target)) {
        emojiPicker.style.display = 'none';
        isEmojiPickerVisible = false;
      }
    });
  }
}

/**
 * 初始化表情选择器
 */
function initEmojiPicker() {
  // 表情数据
  const emojiData = {
    smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '😶‍🌫️', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐'],
    people: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄'],
    animals: ['🐱', '🐶', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓'],
    food: ['🍕', '🍔', '🍟', '🌭', '🍿', '🧂', '🥓', '🥚', '🍳', '🧇', '🥞', '🧈', '🍞', '🥐', '🥖', '🥨', '🧀', '🥗', '🥙', '🥪', '🌮', '🌯', '🫔', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯'],
    activities: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '🤾', '🏌️', '🏇', '🧘', '🏊', '🤽', '🚣', '🧗', '🚴', '🚵', '🎪', '🎭', '🎨'],
    objects: ['💡', '🔦', '🏮', '🪔', '📱', '💻', '🖥️', '🖨️', '⌨️', '🖱️', '🖲️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏰', '⏱️', '⏲️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪓', '🔩', '⚙️', '🪤']
  };

  const emojiList = document.getElementById('emojiList');
  const emojiTabs = document.querySelectorAll('.emoji-tab');
  let currentCategory = 'smileys';

  // 渲染表情列表
  function renderEmojis(category) {
    emojiList.innerHTML = '';
    const emojis = emojiData[category] || [];
    emojis.forEach(emoji => {
      const emojiItem = document.createElement('div');
      emojiItem.className = 'emoji-item';
      emojiItem.textContent = emoji;
      emojiItem.addEventListener('click', () => {
        insertEmoji(emoji);
      });
      emojiList.appendChild(emojiItem);
    });
  }

  // 插入表情到输入框
  function insertEmoji(emoji) {
    const input = document.getElementById('messageInput');
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const text = input.value;

    input.value = text.substring(0, start) + emoji + text.substring(end);
    input.focus();
    input.selectionStart = input.selectionEnd = start + emoji.length;

    // 关闭表情选择器
    const emojiPicker = document.getElementById('emojiPicker');
    emojiPicker.style.display = 'none';
  }

  // 切换表情分类
  emojiTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // 移除所有active类
      emojiTabs.forEach(t => t.classList.remove('active'));
      // 添加当前active类
      tab.classList.add('active');
      // 渲染对应分类
      currentCategory = tab.dataset.category;
      renderEmojis(currentCategory);
    });
  });

  // 初始化默认分类
  renderEmojis(currentCategory);
}

/**
 * 显示配置对话框
 */
function showConfigDialog() {
  // 创建配置表单
  const dialog = document.createElement('div');
  dialog.className = 'config-dialog';
  dialog.innerHTML = `
    <div class="dialog-content">
      <h2>配置邮箱</h2>
      <form id="configForm">
        <div>
          <label>我的邮箱:</label>
          <input type="email" id="myEmail" value="${app.config.myEmail}" required>
        </div>
        <div>
          <label>对方邮箱:</label>
          <input type="email" id="peerEmail" value="${app.config.peerEmail}" required>
        </div>
        <div>
          <label>EmailJS Service ID:</label>
          <input type="text" id="serviceId" value="${app.config.emailServiceId || ''}" required>
        </div>
        <div>
          <label>EmailJS Template ID:</label>
          <input type="text" id="templateId" value="${app.config.emailTemplateId || ''}" required>
        </div>
        <div>
          <label>EmailJS User ID:</label>
          <input type="text" id="userId" value="${app.config.emailUserId || ''}" required>
        </div>
        <div class="buttons">
          <button type="submit">保存</button>
          <button type="button" onclick="this.closest('.config-dialog').remove()">取消</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(dialog);

  // 绑定表单提交
  document.getElementById('configForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const config = {
      myEmail: document.getElementById('myEmail').value,
      peerEmail: document.getElementById('peerEmail').value,
      emailServiceId: document.getElementById('serviceId').value,
      emailTemplateId: document.getElementById('templateId').value,
      emailUserId: document.getElementById('userId').value
    };

    const success = await app.saveConfig(config);
    if (success) {
      alert('配置保存成功!');
      dialog.remove();
      app.startPolling();
    } else {
      alert('配置保存失败!');
    }
  });
}

/**
 * 发送消息
 */
async function sendMessage() {
  const input = document.getElementById('messageInput');
  const content = input.value.trim();

  if (!content) {
    return;
  }

  if (!app.isConnected) {
    alert('请先配置邮箱!');
    return;
  }

  if (!app.isExchangeComplete) {
    alert('请先完成公钥交换!');
    return;
  }

  try {
    await app.sendMessage(content);
    input.value = '';

    // 刷新消息列表
    await refreshMessages();
  } catch (error) {
    alert('发送失败: ' + error.message);
  }
}

/**
 * 发送文件
 */
async function sendFile(file) {
  if (!app.isConnected) {
    alert('请先配置邮箱!');
    return;
  }

  if (!app.isExchangeComplete) {
    alert('请先完成公钥交换!');
    return;
  }

  try {
    showToast('正在发送文件...');
    await app.sendFile(file);

    // 刷新消息列表
    await refreshMessages();

    showToast('文件发送成功!');
  } catch (error) {
    alert('发送文件失败: ' + error.message);
  }
}

/**
 * 显示Toast提示
 */
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

/**
 * 刷新消息列表
 */
async function refreshMessages() {
  const messages = await app.loadMessageHistory();
  const container = document.getElementById('messagesContainer');

  if (container) {
    container.innerHTML = '';

    messages.forEach(msg => {
      const div = document.createElement('div');
      div.className = msg.incoming ? 'message incoming' : 'message outgoing';

      const time = new Date(msg.timestamp).toLocaleTimeString();

      // 根据消息类型渲染不同的内容
      let contentHtml = '';
      if (msg.type === 'image') {
        // 图片消息
        contentHtml = `
          <img src="${msg.content}" class="message-image" alt="图片" onclick="this.style.maxHeight === 'none' ? this.style.maxHeight = '300px' : this.style.maxHeight = 'none'">
        `;
      } else if (msg.type === 'file') {
        // 文件消息
        const fileSize = formatFileSize(msg.fileSize);
        contentHtml = `
          <div class="message-file">
            <span class="message-file-icon">📄</span>
            <div class="message-file-info">
              <div class="message-file-name">${msg.fileName}</div>
              <div class="message-file-size">${fileSize}</div>
            </div>
          </div>
        `;
      } else {
        // 文本消息
        contentHtml = `<div class="message-text">${msg.content}</div>`;
      }

      div.innerHTML = `
        <div class="message-content">
          ${contentHtml}
          <div class="message-time">${time}</div>
        </div>
      `;

      container.appendChild(div);
    });

    // 滚动到底部
    container.scrollTop = container.scrollHeight;
  }
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * 显示密钥指纹
 */
function displayKeyFingerprint(fingerprint) {
  const container = document.getElementById('keyFingerprint');
  if (container) {
    container.textContent = `我的密钥指纹: ${fingerprint}`;
  }
}
