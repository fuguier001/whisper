/**
 * 邮件模块 - 使用EmailJS发送和接收加密消息
 *
 * 注意:由于浏览器CORS限制,直接使用IMAP/SMTP不可行
 * 解决方案:
 * 1. 使用EmailJS服务(emailjs.com)
 * 2. 或者自建邮件转发API
 * 3. 或者使用Gmail API
 *
 * 本示例使用EmailJS(免费额度足够个人使用)
 */

class EmailManager {
  constructor() {
    this.emailConfig = null;
    this.isPolling = false;
    this.pollInterval = 30000; // 30秒
    this.lastChecked = null;
  }

  /**
   * 初始化邮件服务
   * @param {Object} config - 邮件配置
   * @param {string} config.serviceId - EmailJS服务ID
   * @param {string} config.templateId - EmailJS模板ID
   * @param {string} config.userId - EmailJS用户ID(公钥)
   * @param {string} config.myEmail - 我的邮箱
   * @param {string} config.peerEmail - 对方邮箱
   */
  async init(config) {
    this.emailConfig = config;

    // 初始化EmailJS
    if (typeof emailjs !== 'undefined') {
      try {
        emailjs.init(config.userId);
        console.log('✅ EmailJS初始化成功');
      } catch (error) {
        console.error('❌ EmailJS初始化失败:', error);
        throw error;
      }
    } else {
      console.warn('⚠️ EmailJS未加载,邮件功能将不可用');
    }
  }

  /**
   * 发送加密消息
   * @param {Object} messageData - 消息数据
   * @param {string} messageData.encryptedKey - 加密的AES密钥(Base64)
   * @param {string} messageData.encryptedContent - 加密的消息内容(Base64)
   * @param {string} messageData.iv - AES加密的IV(Base64)
   * @param {string} messageData.timestamp - 时间戳
   * @param {string} messageData.sender - 发送者邮箱
   * @param {string} messageData.recipient - 接收者邮箱
   */
  async sendMessage(messageData) {
    try {
      // 构造邮件内容
      const emailParams = {
        to_email: messageData.recipient,
        from_email: messageData.sender,
        subject: '[WHISPER] ' + messageData.timestamp,
        message: JSON.stringify({
          version: '1.0',
          type: 'message',
          encrypted_key: messageData.encryptedKey,
          encrypted_content: messageData.encryptedContent,
          iv: messageData.iv,
          timestamp: messageData.timestamp,
          sender: messageData.sender
        })
      };

      // 使用EmailJS发送
      if (typeof emailjs !== 'undefined') {
        const response = await emailjs.send(
          this.emailConfig.serviceId,
          this.emailConfig.templateId,
          emailParams
        );

        console.log('✅ 消息已发送:', response);
        return {
          success: true,
          messageId: response.status
        };
      } else {
        // Fallback: 使用mailto链接(需要用户手动发送)
        this.sendViaMailto(emailParams);
        return {
          success: true,
          manual: true
        };
      }
    } catch (error) {
      console.error('❌ 发送消息失败:', error);
      throw error;
    }
  }

  /**
   * 使用mailto发送(Fallback方案)
   */
  sendViaMailto(params) {
    const subject = encodeURIComponent(params.subject);
    const body = encodeURIComponent(params.message);
    const mailtoLink = `mailto:${params.to_email}?subject=${subject}&body=${body}`;

    // 打开邮件客户端
    window.open(mailtoLink, '_blank');

    // 显示提示
    alert('已打开邮件客户端,请点击发送按钮');
  }

  /**
   * 接收消息(通过轮询)
   *
   * 注意:由于浏览器安全限制,无法直接读取邮箱
   * 解决方案:
   * 1. 使用Gmail API + OAuth2
   * 2. 自建API服务轮询邮箱并推送到前端
   * 3. 使用EmailJS的接收功能(需要升级)
   *
   * 本示例实现方案2:自建轮询服务
   */
  async receiveMessages() {
    try {
      // 调用自建的轮询API
      const response = await fetch('http://localhost:3000/api/check-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: this.emailConfig.myEmail,
          lastChecked: this.lastChecked
        })
      });

      if (!response.ok) {
        throw new Error('轮询API请求失败');
      }

      const data = await response.json();

      if (data.messages && data.messages.length > 0) {
        console.log(`📨 收到 ${data.messages.length} 条新消息`);
        this.lastChecked = new Date().toISOString();
        return data.messages;
      }

      return [];
    } catch (error) {
      console.error('❌ 接收消息失败:', error);
      return [];
    }
  }

  /**
   * 开始轮询新消息
   * @param {Function} onMessage - 收到新消息时的回调
   */
  startPolling(onMessage) {
    if (this.isPolling) {
      console.warn('⚠️ 轮询已在运行');
      return;
    }

    this.isPolling = true;
    console.log('🔄 开始轮询新消息...');

    this.pollTimer = setInterval(async () => {
      const messages = await this.receiveMessages();

      for (const msg of messages) {
        try {
          // 解析邮件内容
          const messageData = JSON.parse(msg.content);

          // 只处理悄悄话消息
          if (messageData.type === 'message') {
            await onMessage(messageData);
          }
        } catch (error) {
          console.error('❌ 处理消息失败:', error);
        }
      }
    }, this.pollInterval);
  }

  /**
   * 停止轮询
   */
  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
      this.isPolling = false;
      console.log('⏸️ 停止轮询');
    }
  }

  /**
   * 发送公钥交换邮件
   */
  async sendPublicKey(publicKeyBase64) {
    try {
      const emailParams = {
        to_email: this.emailConfig.peerEmail,
        from_email: this.emailConfig.myEmail,
        subject: '[WHISPER] Public Key Exchange',
        message: JSON.stringify({
          version: '1.0',
          type: 'public_key',
          public_key: publicKeyBase64,
          timestamp: new Date().toISOString(),
          sender: this.emailConfig.myEmail
        })
      };

      if (typeof emailjs !== 'undefined') {
        const response = await emailjs.send(
          this.emailConfig.serviceId,
          this.emailConfig.templateId,
          emailParams
        );

        console.log('✅ 公钥已发送:', response);
        return { success: true };
      } else {
        this.sendViaMailto(emailParams);
        return { success: true, manual: true };
      }
    } catch (error) {
      console.error('❌ 发送公钥失败:', error);
      throw error;
    }
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EmailManager;
}
