// ~/studypath/backend/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    role: {
        type: String,
        enum: ['student', 'admin'],
        default: 'student'
    },
    subscription: {
        plan: {
            type: String,
            enum: ['free', 'basic', 'advanced', 'professional'],
            default: 'free'
        },
        startDate: Date,
        endDate: Date,
        paymentMethod: String,
        autoRenew: {
            type: Boolean,
            default: false
        }
    },
    profile: {
        avatar: String,
        phone: String,
        school: String,
        targetSchools: [String],
        subjects: [String]
    },
    studyProgress: {
        totalQuestions: { type: Number, default: 0 },
        correctQuestions: { type: Number, default: 0 },
        streakDays: { type: Number, default: 0 },
        lastStudyDate: Date,
        weakPoints: [String]
    },
    settings: {
        notifications: {
            email: { type: Boolean, default: true },
            push: { type: Boolean, default: true }
        },
        language: {
            type: String,
            default: 'zh-CN'
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: Date,
    isActive: {
        type: Boolean,
        default: true
    }
});

// 密码加密
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// 验证密码
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// 移除敏感信息
userSchema.methods.toJSON = function() {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};

module.exports = mongoose.model('User', userSchema);
