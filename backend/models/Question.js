// ~/studypath/backend/models/Question.js
const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
    // 基本信息
    school: {
        type: String,
        required: true,
        index: true
    },
    subject: {
        type: String,
        required: true,
        index: true
    },
    year: Number,
    examType: String, // EJU, 修士入试等
    
    // 题目内容
    questionText: {
        type: String,
        required: true
    },
    questionImages: [String],
    formulas: [String], // LaTeX格式的公式
    
    // 选项（选择题）
    options: [{
        label: String,
        content: String,
        isCorrect: Boolean,
        image: String
    }],
    
    // 答案和解析
    correctAnswer: String,
    solution: {
        text: String,
        steps: [String],
        images: [String],
        videoUrl: String
    },
    
    // 元数据
    difficulty: {
        type: Number,
        min: 1,
        max: 5,
        default: 3
    },
    tags: [String],
    topics: [String],
    
    // AI生成相关
    aiGenerated: {
        type: Boolean,
        default: false
    },
    parentQuestionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question'
    },
    generationPrompt: String,
    
    // 验证状态
    verificationStatus: {
        type: String,
        enum: ['pending', 'verified', 'rejected'],
        default: 'pending'
    },
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    verifiedAt: Date,
    
    // 统计数据
    stats: {
        attempts: { type: Number, default: 0 },
        correctAttempts: { type: Number, default: 0 },
        avgTime: Number, // 平均答题时间（秒）
        reportCount: { type: Number, default: 0 }
    },
    
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: Date
});

// 索引
questionSchema.index({ school: 1, subject: 1, year: -1 });
questionSchema.index({ aiGenerated: 1 });
questionSchema.index({ verificationStatus: 1 });
questionSchema.index({ tags: 1 });

module.exports = mongoose.model('Question', questionSchema);
