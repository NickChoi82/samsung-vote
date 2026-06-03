exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { blobs } = context;

    // GET: 현재 투표 현황
    if (event.httpMethod === 'GET') {
      const raw = await blobs.get('results');
      const data = raw ? JSON.parse(raw) : { buy: 0, sell: 0 };
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    // POST: 투표
    if (event.httpMethod === 'POST') {
      const ip = (event.headers['x-forwarded-for'] || '').split(',')[0].trim()
               || event.headers['client-ip']
               || 'unknown';

      const { choice } = JSON.parse(event.body || '{}');
      if (!['buy', 'sell'].includes(choice)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid choice' }) };
      }

      const voted = await blobs.get('ip_' + ip.replace(/[^a-zA-Z0-9]/g, '_'));
      if (voted) {
        const raw = await blobs.get('results');
        const results = raw ? JSON.parse(raw) : { buy: 0, sell: 0 };
        return { statusCode: 200, headers, body: JSON.stringify({ alreadyVoted: true, results }) };
      }

      const raw = await blobs.get('results');
      const results = raw ? JSON.parse(raw) : { buy: 0, sell: 0 };
      results[choice] = (results[choice] || 0) + 1;

      await blobs.set('results', JSON.stringify(results));
      await blobs.set('ip_' + ip.replace(/[^a-zA-Z0-9]/g, '_'), choice);

      return { statusCode: 200, headers, body: JSON.stringify({ alreadyVoted: false, results }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'method not allowed' }) };

  } catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
