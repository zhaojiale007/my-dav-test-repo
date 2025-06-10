// api/connect.js
import { createClient } from 'webdav';

export default async function handler(req, res) {
  // CORS 配置：允许前端页面跨域调用此 API
  res.setHeader('Access-Control-Allow-Origin', '*'); // 生产环境请替换为你的前端域名，例如 'https://your-frontend-domain.com'
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. 检查请求方法
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed', message: 'Only POST requests are supported.' });
  }

  // 2. 从请求体中获取 WebDAV 连接信息
  const { url, username, password } = req.body;

  // 3. 基本的数据验证
  if (!url || !username || !password) {
    return res.status(400).json({ success: false, error: 'Bad Request', message: 'Missing WebDAV URL, username, or password.' });
  }

  try {
    // 4. 创建 WebDAV 客户端实例
    const client = createClient(url, {
      username: username,
      password: password,
      // 如果你的WebDAV服务器是自签发证书，可能需要这个
      // strictSSL: false,
    });

    // 5. 尝试连接并列出根目录内容
    // 这个操作本身会尝试进行认证
    const directoryContents = await client.getDirectoryContents('/');

    // 6. 返回成功响应和目录内容
    res.status(200).json({
      success: true,
      message: 'Successfully connected to WebDAV and fetched directory contents.',
      webdavUrl: url,
      directoryContents: directoryContents.map(item => ({
        filename: item.basename,
        type: item.type,
        size: item.size, // 仅文件有
        lastModified: item.lastmod,
      })),
    });

  } catch (error) {
    console.error('WebDAV connection error:', error.message);
    // 根据错误类型返回不同的状态码和信息
    let statusCode = 500;
    let errorMessage = 'An unexpected error occurred during WebDAV connection.';
    let errorDetails = error.message;

    if (error.response) {
      statusCode = error.response.status;
      if (statusCode === 401) {
        errorMessage = 'Authentication Failed: Invalid WebDAV username or password.';
      } else if (statusCode === 404) {
        errorMessage = 'Not Found: WebDAV URL not found or invalid path. Check your URL.';
      } else if (statusCode >= 500) {
        errorMessage = 'WebDAV Server Error: The remote server encountered an error.';
      } else {
        errorMessage = `WebDAV Request Failed with status ${statusCode}.`;
      }
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'EHOSTUNREACH') {
      statusCode = 502; // Bad Gateway
      errorMessage = 'Connection Error: Could not reach the WebDAV server. Check the URL or server availability.';
    } else if (error.name === 'WebDAVClientError') { // webdav库特有的错误
      errorMessage = `WebDAV Client Error: ${error.message}`;
    }


    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: errorDetails
    });
  }
}
