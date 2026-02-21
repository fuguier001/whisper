/**
 * 加密模块 - 使用Web Crypto API实现端到端加密
 *
 * 功能:
 * 1. 生成RSA密钥对
 * 2. 导出/导入公钥
 * 3. AES加密/解密消息
 * 4. RSA加密/解密AES密钥
 * 5. 数字签名和验证
 */

class CryptoManager {
  constructor() {
    this.keyPair = null;
    this.publicKey = null;
    this.privateKey = null;
    this.peerPublicKey = null;
  }

  /**
   * 生成RSA-OAEP密钥对(用于加密AES密钥)
   */
  async generateKeyPair() {
    try {
      this.keyPair = await window.crypto.subtle.generateKey(
        {
          name: 'RSA-OAEP',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256'
        },
        true,
        ['encrypt', 'decrypt']
      );

      this.publicKey = this.keyPair.publicKey;
      this.privateKey = this.keyPair.privateKey;

      console.log('✅ RSA密钥对生成成功');
      return this.keyPair;
    } catch (error) {
      console.error('❌ 生成密钥对失败:', error);
      throw error;
    }
  }

  /**
   * 导出公钥为SPKI格式(Base64编码)
   */
  async exportPublicKey(publicKey = this.publicKey) {
    try {
      const exported = await window.crypto.subtle.exportKey(
        'spki',
        publicKey
      );
      const exportedAsBase64 = this.arrayBufferToBase64(exported);
      return exportedAsBase64;
    } catch (error) {
      console.error('❌ 导出公钥失败:', error);
      throw error;
    }
  }

  /**
   * 从SPKI格式导入公钥
   */
  async importPublicKey(base64Key) {
    try {
      const binaryKey = this.base64ToArrayBuffer(base64Key);
      const publicKey = await window.crypto.subtle.importKey(
        'spki',
        binaryKey,
        {
          name: 'RSA-OAEP',
          hash: 'SHA-256'
        },
        true,
        ['encrypt']
      );

      this.peerPublicKey = publicKey;
      console.log('✅ 导入对方公钥成功');
      return publicKey;
    } catch (error) {
      console.error('❌ 导入公钥失败:', error);
      throw error;
    }
  }

  /**
   * 生成随机AES-GCM密钥(用于加密消息内容)
   */
  async generateAESKey() {
    try {
      const key = await window.crypto.subtle.generateKey(
        {
          name: 'AES-GCM',
          length: 256
        },
        true,
        ['encrypt', 'decrypt']
      );

      return key;
    } catch (error) {
      console.error('❌ 生成AES密钥失败:', error);
      throw error;
    }
  }

  /**
   * 导出AES密钥为原始格式
   */
  async exportAESKey(key) {
    try {
      const exported = await window.crypto.subtle.exportKey(
        'raw',
        key
      );
      return new Uint8Array(exported);
    } catch (error) {
      console.error('❌ 导出AES密钥失败:', error);
      throw error;
    }
  }

  /**
   * 从原始格式导入AES密钥
   */
  async importAESKey(keyData) {
    try {
      const key = await window.crypto.subtle.importKey(
        'raw',
        keyData,
        {
          name: 'AES-GCM',
          length: 256
        },
        true,
        ['encrypt', 'decrypt']
      );

      return key;
    } catch (error) {
      console.error('❌ 导入AES密钥失败:', error);
      throw error;
    }
  }

  /**
   * 使用RSA公钥加密AES密钥
   */
  async encryptAESKey(aesKey, publicKey = this.peerPublicKey) {
    try {
      const aesKeyData = await this.exportAESKey(aesKey);
      const encrypted = await window.crypto.subtle.encrypt(
        {
          name: 'RSA-OAEP'
        },
        publicKey,
        aesKeyData
      );

      return this.arrayBufferToBase64(encrypted);
    } catch (error) {
      console.error('❌ 加密AES密钥失败:', error);
      throw error;
    }
  }

  /**
   * 使用RSA私钥解密AES密钥
   */
  async decryptAESKey(encryptedAESKey) {
    try {
      const encryptedData = this.base64ToArrayBuffer(encryptedAESKey);
      const decrypted = await window.crypto.subtle.decrypt(
        {
          name: 'RSA-OAEP'
        },
        this.privateKey,
        encryptedData
      );

      const aesKey = await this.importAESKey(new Uint8Array(decrypted));
      return aesKey;
    } catch (error) {
      console.error('❌ 解密AES密钥失败:', error);
      throw error;
    }
  }

  /**
   * 使用AES-GCM加密消息内容
   */
  async encryptMessage(content, aesKey) {
    try {
      // 生成随机IV
      const iv = window.crypto.getRandomValues(new Uint8Array(12));

      // 将内容转换为字节数组
      const encoder = new TextEncoder();
      const data = encoder.encode(content);

      // 加密
      const encrypted = await window.crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        aesKey,
        data
      );

      return {
        encrypted: this.arrayBufferToBase64(encrypted),
        iv: this.arrayBufferToBase64(iv)
      };
    } catch (error) {
      console.error('❌ 加密消息失败:', error);
      throw error;
    }
  }

  /**
   * 使用AES-GCM解密消息内容
   */
  async decryptMessage(encryptedData, iv, aesKey) {
    try {
      const encrypted = this.base64ToArrayBuffer(encryptedData);
      const ivData = this.base64ToArrayBuffer(iv);

      const decrypted = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: new Uint8Array(ivData)
        },
        aesKey,
        encrypted
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('❌ 解密消息失败:', error);
      throw error;
    }
  }

  /**
   * 生成密钥指纹(用于验证公钥)
   */
  async generateKeyFingerprint(publicKey = this.publicKey) {
    try {
      const exported = await window.crypto.subtle.exportKey(
        'spki',
        publicKey
      );

      const hashBuffer = await window.crypto.subtle.digest(
        'SHA-256',
        exported
      );

      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // 格式化为指纹: XXXX:XXXX:XXXX:XXXX:XXXX:XXXX:XXXX:XXXX
      return hashHex.match(/.{1,4}/g).join(':');
    } catch (error) {
      console.error('❌ 生成指纹失败:', error);
      throw error;
    }
  }

  /**
   * ArrayBuffer转Base64
   */
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Base64转ArrayBuffer
   */
  base64ToArrayBuffer(base64) {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * 保存私钥到localStorage
   */
  async savePrivateKey() {
    try {
      const exported = await window.crypto.subtle.exportKey(
        'pkcs8',
        this.privateKey
      );
      const exportedAsBase64 = this.arrayBufferToBase64(exported);
      localStorage.setItem('whisper_private_key', exportedAsBase64);
      console.log('✅ 私钥已保存到本地存储');
    } catch (error) {
      console.error('❌ 保存私钥失败:', error);
      throw error;
    }
  }

  /**
   * 从localStorage加载私钥
   */
  async loadPrivateKey() {
    try {
      const savedKey = localStorage.getItem('whisper_private_key');
      if (!savedKey) {
        console.log('⚠️ 本地没有保存的私钥');
        return false;
      }

      const binaryKey = this.base64ToArrayBuffer(savedKey);
      this.privateKey = await window.crypto.subtle.importKey(
        'pkcs8',
        binaryKey,
        {
          name: 'RSA-OAEP',
          hash: 'SHA-256'
        },
        true,
        ['decrypt']
      );

      // 同时加载公钥
      this.publicKey = await window.crypto.subtle.exportKey(
        'spki',
        this.privateKey
      ).then(spki => window.crypto.subtle.importKey(
        'spki',
        spki,
        {
          name: 'RSA-OAEP',
          hash: 'SHA-256'
        },
        true,
        ['encrypt']
      ));

      console.log('✅ 私钥加载成功');
      return true;
    } catch (error) {
      console.error('❌ 加载私钥失败:', error);
      return false;
    }
  }

  /**
   * 清除本地存储的私钥
   */
  clearPrivateKey() {
    localStorage.removeItem('whisper_private_key');
    console.log('✅ 私钥已从本地存储清除');
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CryptoManager;
}
