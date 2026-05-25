export default async function handler(req, res) {
  const { code, error, error_description } = req.query;

  if (error || !code) {
    console.error('Strava OAuth error:', error_description);
    return res.redirect('/?strava_error=access_denied');
  }

  if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) {
    return res.redirect('/?strava_error=not_configured');
  }

  try {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    });

    const data = await response.json();

    if (!data.access_token) {
      console.error('Strava token exchange failed:', data);
      return res.redirect('/?strava_error=token_failed');
    }

    // Pass token info back to the app via URL params
    // (stored immediately in localStorage, then URL is cleaned)
    const params = new URLSearchParams({
      strava_token:    data.access_token,
      strava_refresh:  data.refresh_token,
      strava_expires:  data.expires_at,
      strava_athlete:  data.athlete?.firstname || 'Athlete',
    });

    res.redirect(`/?${params.toString()}`);
  } catch (err) {
    console.error('Strava auth error:', err);
    res.redirect('/?strava_error=server_error');
  }
}
