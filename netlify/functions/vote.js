const JSONBIN_KEY = '$2a$10$qWQV2m9uKwP3kulUipXILO3i9KBk.l3ebzXnWeq9HF.IZvOpdKhmm';

async function getOrCreateBin() {
  const listRes = await fetch('https://api.jsonbin.io/v3/b', {
    headers: { 'X-Master-Key': JSONBIN_KEY }
  });
  const bins = await listRes.json();

  if (Array.isArray(bins)) {
    const found = bins.find(b => b.metadata?.name === 'samsung-vote');
    if (found) return found.metadata.id;
  }

  const createRes = await fetch('https://api.jsonbin.io/v3/b', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': JSONBIN_KEY,
      'X-Bin-Name': 'samsung-vote'
    },
    body: JSON.stringify({ buy: 0, sell: 0, ips: [] })
  });
  const created = await createRes.json();
  return created.metadata.id;
}

async function getRecord(binId) {
  const res = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
    headers: { 'X-Master-Key': JSONBIN_KEY }
  });
  const data = await res.json();
  return data.record;
}

async function saveRecord(binId, record) {
  await fetch(`https://api.jsonbin.io/v3/b/${binId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': JSONBIN_KEY
    },
    body: JSON.stringify(record)
  });
}

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const binId = await getOrCreateBin();

    if (event.httpMethod === 'GET') {
      const record = await getRecord(binId);
      return { statusCode: 200, headers, body: JSON.stringify({ buy: record.buy || 0, sell: record.sell || 0 }) };
    }

    if (event.httpMethod === 'POST') {
      const ip = (event.headers['x-forwarded-for'] || '').split(',')[0].trim()
               || event.headers['client-ip']
               || 'unknown';

      const { choice } = JSON.parse(event.body || '{}');
      if (!['buy', 'sell'].includes(choice)) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'invalid choice' }) };
      }

      const record = await getRecord(binId);
      const ips = record.ips || [];

      if (ips.includes(ip)) {
        return { statusCode: 200, headers, body: JSON.stringify({ alreadyVoted: true, results: { buy: record.buy || 0, sell: record.sell || 0 } }) };
      }

      record[choice] = (record[choice] || 0) + 1;
      record.ips = [...ips, ip];
      await saveRecord(binId, record);

      return { statusCode: 200, headers, body: JSON.stringify({ alreadyVoted: false, results: { buy: record.buy, sell: record.sell } }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ error: 'method not allowed' }) };

  } catch(e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
