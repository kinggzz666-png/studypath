// ~/studypath/backend/routes/auth.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { redisClient } = require('../server');

// 注册
router.post('/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        
        // 检查用户是否存在
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: '该邮箱已被注册' });
        }
        
        // 创建新用户
        const user = new User({
            email,
            password,
            name
        });
        
        await user.save();
        
        // 生成JWT
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        // 存储到Redis（如果可用）
        if (redisClient?.isReady) {
            await redisClient.setEx(
                `session:${user._id}`,
                7 * 24 * 60 * 60, // 7天
                token
            );
        }
        
        res.status(201).json({
            message: '注册成功',
            token,
            user
        });
    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json({ message: '注册失败，请稍后重试' });
    }
});

// 登录
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // 查找用户
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: '邮箱或密码错误' });
        }
        
        // 验证密码
        const isValid = await user.comparePassword(password);
        if (!isValid) {
            return res.status(401).json({ message: '邮箱或密码错误' });
        }
        
        // 更新最后登录时间
        user.lastLogin = new Date();
        await user.save();
        
        // 生成JWT
        const token = jwt.sign(
            { userId: user._id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        // 存储到Redis
        if (redisClient?.isReady) {
            await redisClient.setEx(
                `session:${user._id}`,
                7 * 24 * 60 * 60,
                token
            );
        }
        
        res.json({
            message: '登录成功',
            token,
            user
        });
    } catch (error) {
        console.error('登录错误:', error);
        res.status(500).json({ message: '登录失败，请稍后重试' });
    }
});

// 登出
router.post('/logout', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // 从Redis删除session
            if (redisClient?.isReady) {
                await redisClient.del(`session:${decoded.userId}`);
            }
        }
        
        res.json({ message: '登出成功' });
    } catch (error) {
        res.json({ message: '登出成功' });
    }
});

module.exports = router;
