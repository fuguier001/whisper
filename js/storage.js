/**
 * 存储模块 - 使用IndexedDB存储本地消息历史
 *
 * 功能:
 * 1. 存储消息历史
 * 2. 存储公钥
 * 3. 存储配置
 * 4. 查询和删除消息
 */

class StorageManager {
  constructor() {
    this.dbName = 'WhisperDB';
    this.dbVersion = 1;
    this.db = null;
  }

  /**
   * 初始化数据库
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('❌ 打开数据库失败:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ 数据库初始化成功');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 创建消息存储
        if (!db.objectStoreNames.contains('messages')) {
          const messageStore = db.createObjectStore('messages', {
            keyPath: 'id',
            autoIncrement: true
          });

          messageStore.createIndex('timestamp', 'timestamp', { unique: false });
          messageStore.createIndex('sender', 'sender', { unique: false });
          messageStore.createIndex('type', 'type', { unique: false });

          console.log('✅ 消息存储创建成功');
        }

        // 创建公钥存储
        if (!db.objectStoreNames.contains('keys')) {
          const keyStore = db.createObjectStore('keys', {
            keyPath: 'email'
          });

          console.log('✅ 公钥存储创建成功');
        }

        // 创建配置存储
        if (!db.objectStoreNames.contains('config')) {
          const configStore = db.createObjectStore('config', {
            keyPath: 'key'
          });

          console.log('✅ 配置存储创建成功');
        }
      };
    });
  }

  /**
   * 保存消息
   * @param {Object} message - 消息对象
   * @param {string} message.type - 消息类型(text/image/file)
   * @param {string} message.content - 消息内容(加密后的)
   * @param {string} message.sender - 发送者
   * @param {string} message.timestamp - 时间戳
   * @param {string} message.encryptedKey - 加密的AES密钥
   * @param {string} message.iv - AES IV
   * @param {boolean} message.incoming - 是否为接收的消息
   */
  async saveMessage(message) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['messages'], 'readwrite');
      const store = transaction.objectStore('messages');

      const request = store.add({
        type: message.type || 'text',
        content: message.content,
        sender: message.sender,
        timestamp: message.timestamp || new Date().toISOString(),
        encryptedKey: message.encryptedKey,
        iv: message.iv,
        incoming: message.incoming || false,
        read: false,
        withdrawn: false
      });

      request.onsuccess = () => {
        console.log('✅ 消息已保存:', request.result);
        resolve(request.result);
      };

      request.onerror = () => {
        console.error('❌ 保存消息失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取所有消息(按时间排序)
   */
  async getAllMessages() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['messages'], 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('timestamp');

      const request = index.getAll();

      request.onsuccess = () => {
        const messages = request.result;
        console.log(`📋 加载了 ${messages.length} 条消息`);
        resolve(messages);
      };

      request.onerror = () => {
        console.error('❌ 获取消息失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取最近N条消息
   * @param {number} limit - 消息数量
   */
  async getRecentMessages(limit = 50) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['messages'], 'readonly');
      const store = transaction.objectStore('messages');
      const index = store.index('timestamp');

      const request = index.openCursor(null, 'prev');
      const messages = [];

      request.onsuccess = (event) => {
        const cursor = event.target.result;

        if (cursor && messages.length < limit) {
          messages.push(cursor.value);
          cursor.continue();
        } else {
          // 反转顺序(从早到晚)
          resolve(messages.reverse());
        }
      };

      request.onerror = () => {
        console.error('❌ 获取消息失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 标记消息为已读
   * @param {number} messageId - 消息ID
   */
  async markAsRead(messageId) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['messages'], 'readwrite');
      const store = transaction.objectStore('messages');

      const getRequest = store.get(messageId);

      getRequest.onsuccess = () => {
        const message = getRequest.result;
        message.read = true;

        const putRequest = store.put(message);

        putRequest.onsuccess = () => {
          console.log('✅ 消息已标记为已读');
          resolve();
        };

        putRequest.onerror = () => {
          console.error('❌ 标记已读失败:', putRequest.error);
          reject(putRequest.error);
        };
      };

      getRequest.onerror = () => {
        console.error('❌ 获取消息失败:', getRequest.error);
        reject(getRequest.error);
      };
    });
  }

  /**
   * 撤回消息
   * @param {number} messageId - 消息ID
   */
  async withdrawMessage(messageId) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['messages'], 'readwrite');
      const store = transaction.objectStore('messages');

      const getRequest = store.get(messageId);

      getRequest.onsuccess = () => {
        const message = getRequest.result;
        message.withdrawn = true;

        const putRequest = store.put(message);

        putRequest.onsuccess = () => {
          console.log('✅ 消息已撤回');
          resolve();
        };

        putRequest.onerror = () => {
          console.error('❌ 撤回消息失败:', putRequest.error);
          reject(putRequest.error);
        };
      };

      getRequest.onerror = () => {
        console.error('❌ 获取消息失败:', getRequest.error);
        reject(getRequest.error);
      };
    });
  }

  /**
   * 删除消息
   * @param {number} messageId - 消息ID
   */
  async deleteMessage(messageId) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['messages'], 'readwrite');
      const store = transaction.objectStore('messages');

      const request = store.delete(messageId);

      request.onsuccess = () => {
        console.log('✅ 消息已删除');
        resolve();
      };

      request.onerror = () => {
        console.error('❌ 删除消息失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 清空所有消息
   */
  async clearAllMessages() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['messages'], 'readwrite');
      const store = transaction.objectStore('messages');

      const request = store.clear();

      request.onsuccess = () => {
        console.log('✅ 所有消息已清空');
        resolve();
      };

      request.onerror = () => {
        console.error('❌ 清空消息失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 保存公钥
   * @param {string} email - 邮箱地址
   * @param {string} publicKey - 公钥(Base64)
   */
  async savePublicKey(email, publicKey) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['keys'], 'readwrite');
      const store = transaction.objectStore('keys');

      const request = store.put({
        email: email,
        publicKey: publicKey,
        timestamp: new Date().toISOString()
      });

      request.onsuccess = () => {
        console.log('✅ 公钥已保存:', email);
        resolve();
      };

      request.onerror = () => {
        console.error('❌ 保存公钥失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取公钥
   * @param {string} email - 邮箱地址
   */
  async getPublicKey(email) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['keys'], 'readonly');
      const store = transaction.objectStore('keys');

      const request = store.get(email);

      request.onsuccess = () => {
        if (request.result) {
          console.log('✅ 公钥已找到:', email);
          resolve(request.result.publicKey);
        } else {
          console.log('⚠️ 公钥未找到:', email);
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('❌ 获取公钥失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 保存配置
   * @param {string} key - 配置键
   * @param {any} value - 配置值
   */
  async saveConfig(key, value) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['config'], 'readwrite');
      const store = transaction.objectStore('config');

      const request = store.put({
        key: key,
        value: value,
        timestamp: new Date().toISOString()
      });

      request.onsuccess = () => {
        console.log('✅ 配置已保存:', key);
        resolve();
      };

      request.onerror = () => {
        console.error('❌ 保存配置失败:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * 获取配置
   * @param {string} key - 配置键
   */
  async getConfig(key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['config'], 'readonly');
      const store = transaction.objectStore('config');

      const request = store.get(key);

      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.value);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('❌ 获取配置失败:', request.error);
        reject(request.error);
      };
    });
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageManager;
}
