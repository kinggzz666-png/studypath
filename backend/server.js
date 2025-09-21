// ~/studypath/backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const redis = require('redis');
const path = require('path');
const fs = require('fs');

// 加载环境变量
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();

// 创建日志目录
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// 安全和性能中间件
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));
app.use(compression());
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost',
    credentials: true
}));

// 请求限制
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100, // 限制100个请求
    message: '请求过于频繁，请稍后再试'
});
app.use('/api/', limiter);

// 日志记录
const accessLogStream = fs.createWriteStream(
    path.join(logDir, 'access.log'),
    { flags: 'a' }
);
app.use(morgan('combined', { stream: accessLogStream }));
app.use(morgan('dev')); // 控制台日志

// 请求解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务（如果没有使用Nginx）
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Redis连接
let redisClient;
(async () => {
    redisClient = redis.createClient({
        url: process.env.REDIS_URL || 'redis://redis:6379',
        password: process.env.REDIS_PASSWORD
    });

    redisClient.on('error', (err) => {
        console.error('❌ Redis连接错误:', err);
        // Redis错误不应该导致应用崩溃
    });

    redisClient.on('connect', () => {
        console.log('✅ Redis连接成功');
    });

    try {
        await redisClient.connect();
    } catch (err) {
        console.error('⚠️ Redis连接失败，继续运行但没有缓存功能');
    }
})();

// MongoDB连接
mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongodb:27017/studypath', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    authSource: 'admin'
}).then(() => {
    console.log('✅ MongoDB连接成功');
}).catch(err => {
    console.error('❌ MongoDB连接失败:', err);
    process.exit(1);
});

// 数据模型
require('./models/User');
require('./models/Question');
require('./models/Payment');

// 健康检查
app.get('/health', async (req, res) => {
    const health = {
        uptime: process.uptime(),
        timestamp: Date.now(),
        status: 'OK',
        services: {
            database: mongoose.connection.readyState === 1 ? 'healthy' : 'unhealthy',
            redis: redisClient?.isReady ? 'healthy' : 'unhealthy'
        }
    };
    
    const httpStatus = health.services.database === 'healthy' ? 200 : 503;
    res.status(httpStatus).json(health);
});

// API路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/questions', require('./routes/questions'));
app.use('/api/users', require('./routes/users'));
app.use('/api/payment', require('./routes/payment'));
app.use('/api/ai', require('./routes/ai'));

// 404处理
app.use((req, res) => {
    res.status(404).json({ message: '请求的资源不存在' });
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('错误:', err);
    
    const status = err.status || 500;
    const message = err.message || '服务器内部错误';
    
    res.status(status).json({
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// 启动服务器
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 服务器运行在端口 ${PORT}`);
    console.log(`📍 环境: ${process.env.NODE_ENV || 'development'}`);
});

// 优雅关闭
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown() {
    console.log('\n📦 开始优雅关闭...');
    
    server.close(() => {
        console.log('✅ HTTP服务器已关闭');
    });
    
    try {
        await mongoose.connection.close();
        console.log('✅ MongoDB连接已关闭');
        
        if (redisClient) {
            await redisClient.quit();
            console.log('✅ Redis连接已关闭');
        }
        
        process.exit(0);
    } catch (err) {
        console.error('❌ 关闭过程出错:', err);
        process.exit(1);
    }
}

// 导出app和redisClient供其他模块使用
module.exports = { app, redisClient };
