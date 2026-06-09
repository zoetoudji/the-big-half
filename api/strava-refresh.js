export default async function handler(req, res) {
    const { refresh_token } = req.query;
  
    if (!refresh_token) {
      return res.status(400).json({ error: 'No refresh token provided' });
    }
  
    if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) {
      return res.status(500).json({ error: 'Strava not configured' });
    }
  
    try {
      const response = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.STRAVA_CLIENT_ID,
          client_secret: process.env.STRAVA_CLIENT_SECRET,
          grant_type: 'refresh_token',
          refresh_token,
        }),
      });
  
      const data = await response.json();
  
      if (!data.access_token) {
        return res.status(401).json({ error: 'Token refresh failed' });
      }
  
      res.json({
        access_token:  data.access_token,
        refresh_token: data.refresh_token,
        expires_at:    data.expires_at,
      });
    } catch (err) {
      console.error('Strava refresh error:', err);
      res.status(500).json({ error: 'Server error during token refresh' });
    }
  }