const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  instagramAccountId: {
    type: String,
    required: true
  },
  instagramUsername: {
    type: String
  },
  accessToken: {
    type: String,
    required: true
  },
  pageId: {
    type: String,
    required: true
  },
  pageName: {
    type: String
  },
  connectedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);