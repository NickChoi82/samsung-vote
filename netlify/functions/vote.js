const { getStore } = require('@netlify/blobs');

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  // OPTIONS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const store = getStore('votes');

    // GET: 현재 투표 현황 조회
    if (event.httpMethod === 'GET') {
      const data = await store.get('results', { type: 'json' }).catch(() => ({ buy: 0, sell: 0 }));
      return { statusCode: 200, headers, body: JSON.stringify(data || { buy: 0, sell: 0 }) };
    }

    // POST: 투표
    if (event.httpMethod === 'POST') {
      const ip = event.headers['x-forwarded-for']?.split(',')[0].trim()
             || event.headers['client-ip']
             || 'unknown';

      const { choice } = JSON.parse(event.body || '{}');
      if (!['buy', 'sell'].includes(choice)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid choice' }) };
      }

      // IP 중복 체크
      const voted = await store.get(`ip:${ip}`).catch(() => null);
      if (voted) {
        const results = await store.get('results', { type: 'json' }).catch(() => ({ buy: 0, sell: 0 }));
        return {
          statusCode: 200, headers,
          body: JSON.stringify({ alreadyVoted: true, results: results || { buy: 0, sell: 0 } })
        };
      }

      // 투표 기록
      const results = await store.get('results', { type: 'json' }).catch(() => ({ buy: 0, sell: 0 }));
      const updated = results || { buy: 0, sell: 0 };
      updated[choice] = (updated[choice] || 0) + 1;

      await Promise.all([
        store.set('results', JSON.stringify(updated)),
        store.set(`ip:${ip}`, choice)
      ]);

      return {
        statusCode: 200, headers,
        body: JSON.stringify({ alreadyVoted: false, results: updated })
      };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'method not allowed' }) };

  } catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
