const { getStore } = require("@netlify/blobs");

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const store = getStore({ name: 'votes', consistency: 'strong' });

    if (event.httpMethod === 'GET') {
      const raw = await store.get('results');
      const data = raw ? JSON.parse(raw) : { buy: 0, sell: 0 };
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    if (event.httpMethod === 'POST') {
      const ip = (event.headers['x-forwarded-for'] || '').split(',')[0].trim()
               || event.headers['client-ip']
               || 'unknown';

      const { choice } = JSON.parse(event.body || '{}');
      if (!['buy', 'sell'].includes(choice)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid choice' }) };
      }

      const ipKey = 'ip_' + ip.replace(/[^a-zA-Z0-9]/g, '_');
      const voted = await store.get(ipKey);
      if (voted) {
        const raw = await store.get('results');
        const results = raw ? JSON.parse(raw) : { buy: 0, sell: 0 };
        return { statusCode: 200, headers, body: JSON.stringify({ alreadyVoted: true, results }) };
      }

      const raw = await store.get('results');
      const results = raw ? JSON.parse(raw) : { buy: 0, sell: 0 };
      results[choice] = (results[choice] || 0) + 1;

      await Promise.all([
        store.set('results', JSON.stringify(results)),
        store.set(ipKey, choice)
      ]);

      return { statusCode: 200, headers, body: JSON.stringify({ alreadyVoted: false, results }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'method not allowed' }) };

  } catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
