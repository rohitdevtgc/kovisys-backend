const express = require('express');
const router = express.Router();
const axios = require('axios');

// Get Instagram Account Info
router.get('/account/:accountId', async (req, res) => {
  const { accountId } = req.params;
  const { accessToken } = req.query;

  try {
    const response = await axios.get(`https://graph.facebook.com/v21.0/${accountId}`, {
      params: {
        fields: 'username,followers_count,follows_count,media_count,profile_picture_url',
        access_token: accessToken
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Account fetch error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch account info' });
  }
});

// Get All Media (Posts, Reels, Videos)
router.get('/media/:accountId', async (req, res) => {
  const { accountId } = req.params;
  const { accessToken } = req.query;

  try {
    const response = await axios.get(`https://graph.facebook.com/v21.0/${accountId}/media`, {
      params: {
        fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
        access_token: accessToken,
        limit: 25
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Media fetch error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch media' });
  }
});

// Get Insights for a Specific Media
router.get('/media/:mediaId/insights', async (req, res) => {
  const { mediaId } = req.params;
  const { accessToken, mediaType } = req.query;

  try {
    let metrics;
    
    // Different metrics for different media types
    if (mediaType === 'VIDEO' || mediaType === 'REELS') {
      metrics = 'plays,reach,total_interactions,saved,shares';
    } else {
      metrics = 'reach,engagement,impressions,saved';
    }

    const response = await axios.get(`https://graph.facebook.com/v21.0/${mediaId}/insights`, {
      params: {
        metric: metrics,
        access_token: accessToken
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Insights fetch error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch insights' });
  }
});

module.exports = router;