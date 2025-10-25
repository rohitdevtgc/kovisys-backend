const express = require('express');
const router = express.Router();
const axios = require('axios');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Generate Instagram Login URL
router.get('/instagram', (req, res) => {
  const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${process.env.APP_ID}&redirect_uri=${process.env.REDIRECT_URI}&scope=pages_show_list,pages_read_engagement,pages_manage_metadata,instagram_basic,instagram_manage_insights,instagram_manage_comments&response_type=code&auth_type=rerequest`;
  
  res.json({ authUrl });
});

// Handle OAuth Callback and Save to Database
router.get('/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'No code provided' });
  }

  try {
    // Exchange code for access token
    const tokenResponse = await axios.get('https://graph.facebook.com/v21.0/oauth/access_token', {
      params: {
        client_id: process.env.APP_ID,
        client_secret: process.env.APP_SECRET,
        redirect_uri: process.env.REDIRECT_URI,
        code: code
      }
    });

    const accessToken = tokenResponse.data.access_token;

    // Debug token to get page ID
    const debugResponse = await axios.get('https://graph.facebook.com/v21.0/debug_token', {
      params: {
        input_token: accessToken,
        access_token: `${process.env.APP_ID}|${process.env.APP_SECRET}`
      }
    });

    const granularScopes = debugResponse.data.data.granular_scopes || [];
    const pageScope = granularScopes.find(scope => scope.scope === 'pages_show_list');
    
    if (!pageScope || !pageScope.target_ids || pageScope.target_ids.length === 0) {
      return res.status(400).json({ 
        error: 'No page access granted'
      });
    }

    const pageId = pageScope.target_ids[0];

    // Get page info and Instagram account
    const pageTokenResponse = await axios.get(`https://graph.facebook.com/v21.0/${pageId}`, {
      params: {
        fields: 'access_token,name,instagram_business_account',
        access_token: accessToken
      }
    });

    const pageAccessToken = pageTokenResponse.data.access_token;
    const pageName = pageTokenResponse.data.name;
    const instagramAccountId = pageTokenResponse.data.instagram_business_account?.id;

    if (!instagramAccountId) {
      return res.status(400).json({ 
        error: 'No Instagram Business Account connected'
      });
    }

    // Get Instagram username
    const igResponse = await axios.get(`https://graph.facebook.com/v21.0/${instagramAccountId}`, {
      params: {
        fields: 'username',
        access_token: pageAccessToken
      }
    });

    const instagramUsername = igResponse.data.username;

    // Store in session temporarily for registration
    res.json({
      success: true,
      needsRegistration: true,
      tempData: {
        accessToken: pageAccessToken,
        instagramAccountId: instagramAccountId,
        instagramUsername: instagramUsername,
        pageId: pageId,
        pageName: pageName
      }
    });

  } catch (error) {
    console.error('Auth error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Authentication failed'
    });
  }
});

// Register User (after Instagram connection)
// Register User (after Instagram connection)
router.post('/register', async (req, res) => {
  try {
    const { email, password, tempData } = req.body;

    console.log('📝 Registration attempt for:', email);

    // Check if user exists
    let user = await User.findOne({ email });
    
    if (user) {
      console.log('❌ User already exists');
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    // Check if Instagram account is already connected
    user = await User.findOne({ instagramAccountId: tempData.instagramAccountId });
    
    if (user) {
      console.log('❌ Instagram account already connected');
      return res.status(400).json({ error: 'This Instagram account is already connected to another user' });
    }

    console.log('✅ Validation passed, creating user...');

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    console.log('✅ Password hashed');

    // Create user
    user = new User({
      email,
      password: hashedPassword,
      instagramAccountId: tempData.instagramAccountId,
      instagramUsername: tempData.instagramUsername,
      accessToken: tempData.accessToken,
      pageId: tempData.pageId,
      pageName: tempData.pageName
    });

    await user.save();
    console.log('✅ User saved to database');

    // Check if JWT_SECRET exists
    if (!process.env.JWT_SECRET) {
      console.error('❌ JWT_SECRET is not set in .env file!');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    console.log('✅ Generating JWT token...');

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log('✅ Token generated successfully');

    res.json({
      success: true,
      token,
      user: {
        email: user.email,
        instagramUsername: user.instagramUsername,
        instagramAccountId: user.instagramAccountId,
        accessToken: user.accessToken
      }
    });

    console.log('✅ Registration successful for:', email);

  } catch (error) {
    console.error('❌ Registration error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Registration failed: ' + error.message });
  }
});

// Login User
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      user: {
        email: user.email,
        instagramUsername: user.instagramUsername,
        instagramAccountId: user.instagramAccountId,
        accessToken: user.accessToken
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get Current User
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        email: user.email,
        instagramUsername: user.instagramUsername,
        instagramAccountId: user.instagramAccountId,
        accessToken: user.accessToken
      }
    });

  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;