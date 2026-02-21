# 悄悄话 - 快速开始指南

## 🚀 5分钟快速上手

### 第一步:安装依赖

```bash
cd /Users/mac/悄悄话
npm install
```

### 第二步:启动服务

```bash
npm start
```

服务将启动在 `http://localhost:8080`

### 第三步:配置邮箱

1. 打开浏览器访问 `http://localhost:8080`
2. 点击右上角的 **"⚙️ 配置"** 按钮
3. 填写以下信息:

   - **我的邮箱**: your-email@gmail.com
   - **对方邮箱**: peer-email@gmail.com
   - **EmailJS Service ID**: 你的EmailJS服务ID
   - **EmailJS Template ID**: 你的EmailJS模板ID
   - **EmailJS User ID**: 你的EmailJS公钥

4. 点击 **"保存"**

### 第四步:配置EmailJS(首次使用)

#### 4.1 注册EmailJS

1. 访问 https://www.emailjs.com/
2. 注册账号(免费)
3. 登录后进入Dashboard

#### 4.2 添加邮件服务

1. 点击 **"Email Services"**
2. 点击 **"Add New Service"**
3. 选择 **"Gmail"** (或其他邮箱服务)
4. 点击 **"Connect Account"** 授权
5. 记录 **Service ID** (如: service_xxx)

#### 4.3 创建邮件模板

1. 点击 **"Email Templates"**
2. 点击 **"Create New Template"**
3. 设置模板内容:

   ```
   To: {{to_email}}
   From: {{from_email}}
   Subject: {{subject}}

   {{{message}}}
   ```

4. 保存模板
5. 记录 **Template ID** (如: template_xxx)

#### 4.4 获取账号信息

1. 点击 **"Account"** → **"General"**
2. 复制 **Public Key** (User ID)
3. 填写到配置中

### 第五步:交换公钥

#### 5.1 生成密钥对

1. 点击 **"🔑 生成密钥"** 按钮
2. 系统会生成RSA密钥对
3. 记录显示的 **公钥指纹**
4. 公钥会自动发送给对方(通过EmailJS)

#### 5.2 导入对方公钥

对方也需要执行"生成密钥"操作。当他们发送公钥给你后:

1. 点击 **"📥 导入公钥"** 按钮
2. 粘贴对方的公钥(Base64格式)
3. 点击确定

#### 5.3 验证密钥指纹

比对双方的密钥指纹,确保一致:
- 如果指纹一致 → 公钥验证通过,可以安全通信
- 如果指纹不一致 → 可能被中间人攻击,请重新交换公钥

### 第六步:开始聊天

1. 等待密钥状态显示 **"✅ 公钥交换已完成"**
2. 在底部输入框输入消息
3. 点击 **"发送"** 或按 **Enter** 键
4. 消息会被加密并通过邮箱发送
5. 对方轮询到新消息后会自动解密显示

---

## 📧 EmailJS配置详解

### Gmail配置

1. **Service**: Gmail
2. **Authentication**: OAuth2
3. **Template**:

   ```
   To Email: {{to_email}}
   Reply To: {{from_email}}
   Subject: {{subject}}

   {{{message}}}
   ```

### QQ邮箱配置

需要使用SMTP转发服务:

1. 注册EmailJS后,添加 **"Custom SMTP"** 服务
2. 配置:

   ```
   Host: smtp.qq.com
   Port: 465
   Secure: true
   Username: your-email@qq.com
   Password: 你的QQ邮箱授权码
   ```

3. 获取授权码:
   - 登录QQ邮箱
   - 设置 → 账户 → POP3/IMAP/SMTP/Exchange/CardDAV/CalDAV服务
   - 开启 **"IMAP/SMTP服务"**
   - 生成授权码

### 163邮箱配置

类似QQ邮箱:

```
Host: smtp.163.com
Port: 465
Secure: true
Username: your-email@163.com
Password: 你的163邮箱授权码
```

---

## 🔒 安全建议

### 1. 密钥管理

- ✅ 定期备份私钥(使用导出功能)
- ✅ 不要在不安全的设备上使用
- ✅ 清除浏览器数据前先导出私钥

### 2. 邮箱安全

- ✅ 启用邮箱的2FA(两步验证)
- ✅ 使用应用专用密码,而非主密码
- ✅ 定期检查邮箱登录记录

### 3. 通信安全

- ✅ 验证对方的公钥指纹
- ✅ 不要在公共网络下交换公钥
- ✅ 定期更新密钥对

---

## 🛠️ 故障排除

### 问题1:无法发送邮件

**检查清单**:
- [ ] EmailJS配置是否正确?
- [ ] 邮箱服务是否已授权?
- [ ] 是否超过EmailJS免费额度(每月200封)?

**解决方案**:
1. 重新配置EmailJS
2. 检查邮箱授权状态
3. 升级EmailJS套餐或使用其他邮箱

### 问题2:无法接收邮件

**原因**: 浏览器无法直接读取邮箱

**解决方案**:
1. 使用Gmail API + OAuth2
2. 自建轮询API(见后文)
3. 使用第三方邮件转发服务

### 问题3:消息解密失败

**检查清单**:
- [ ] 对方的公钥是否正确导入?
- [ ] 公钥指纹是否匹配?
- [ ] 消息是否被篡改?

**解决方案**:
1. 重新导入对方公钥
2. 验证公钥指纹
3. 重新发送消息

### 问题4:密钥丢失

**症状**: 清除浏览器数据后无法解密历史消息

**解决方案**:
1. 如果之前导出过私钥,使用导入功能恢复
2. 如果没有导出,需要重新生成密钥对
3. 旧消息将无法解密,需要清空历史

---

## 🔧 高级配置

### 自建邮件轮询API

由于浏览器无法直接读取邮箱,可以自建一个简单的轮询服务:

#### 创建轮询服务

```bash
cd /Users/mac/悄悄话
mkdir server
cd server
npm init -y
npm install express cors imap nodemailer
```

#### 创建 `server.js`

```javascript
const express = require('express');
const cors = require('cors');
const Imap = require('imap');
const app = express();

app.use(cors());
app.use(express.json());

// 检查新邮件
app.post('/api/check-email', async (req, res) => {
  const { email, password, lastChecked } = req.body;

  const imap = new Imap({
    user: email,
    password: password,
    host: 'imap.gmail.com',
    port: 993,
    tls: true
  });

  try {
    const messages = await new Promise((resolve, reject) => {
      imap.once('ready', () => {
        imap.openBox('INBOX', false, (err) => {
          if (err) return reject(err);

          const searchCriteria = ['UNSEEN', ['SINCE', lastChecked || new Date()]];
          imap.search(searchCriteria, (err, results) => {
            if (err) return reject(err);

            const fetch = imap.fetch(results, { bodies: '' });
            const messages = [];

            fetch.on('message', (msg) => {
              msg.on('body', (stream) => {
                let buffer = '';
                stream.on('data', (chunk) => { buffer += chunk.toString('utf8'); });
                stream.once('end', () => {
                  messages.push({ content: buffer });
                });
              });
            });

            fetch.once('error', reject);
            fetch.once('end', () => {
              imap.end();
              resolve(messages);
            });
          });
        });
      });

      imap.once('error', reject);
      imap.connect();
    });

    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('轮询服务运行在 http://localhost:3000');
});
```

#### 启动服务

```bash
node server.js
```

#### 修改前端配置

在 `js/email.js` 中,已包含调用此API的代码。

---

## 📊 配置对比

| 特性 | EmailJS | 自建API | Gmail API |
|-----|---------|---------|----------|
| **难度** | ⭐ | ⭐⭐⭐ | ⭐⭐ |
| **接收** | ❌ | ✅ | ✅ |
| **发送** | ✅ | ✅ | ✅ |
| **免费额度** | 200封/月 | 无限制 | 无限制 |
| **维护** | 无 | 需要 | 无 |

**推荐方案**:
- 快速体验: EmailJS (需要手动接收)
- 完整功能: 自建API
- 最简单: Gmail API (需要OAuth2)

---

## 🎉 完成!

现在你已经配置好了"悄悄话"加密聊天系统!

### 特点确认

- ✅ **端到端加密** - 消息使用AES-256 + RSA加密
- ✅ **无中央服务器** - 消息通过邮箱传输,不经过聊天服务器
- ✅ **完全私密** - 即使邮箱被黑,消息内容也是加密的
- ✅ **简单轻量** - 纯前端实现,无需部署服务器

### 下一步

1. **测试功能**: 发送一条测试消息
2. **交换公钥**: 与对方完成公钥交换
3. **验证指纹**: 确认对方公钥指纹一致
4. **开始聊天**: 享受私密安全的通信体验

---

**祝使用愉快!** 🎉

如有问题,请查看主README文档或提交Issue。
