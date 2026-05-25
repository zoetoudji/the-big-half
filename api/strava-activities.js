export default async function handler(req, res) {
  const { token, after, before } = req.query;

  if (!token) {
    return res.status(401).json({ error: 'No Strava token provided' });
  }

  try {
    const url = new URL('https://www.strava.com/api/v3/athlete/activities');
    if (after)  url.searchParams.set('after',    after);
    if (before) url.searchParams.set('before',   before);
    url.searchParams.set('per_page', '100');

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401) {
      return res.status(401).json({ error: 'Strava token expired' });
    }

    const activities = await response.json();
    res.json(activities);
  } catch (err) {
    console.error('Strava activities error:', err);
    res.status(500).json({ error: 'Failed to fetch Strava activities' });
  }
}
