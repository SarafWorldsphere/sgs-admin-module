import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

// Native fetch rewrites Host to the upstream address. The tenant resolver needs
// the incoming school Host, so use Node's HTTP transport for this bounded call.
export function plannerRequest(url, { method, headers, body, timeout = 15000 }) {
  return new Promise((resolve, reject) => {
    const request = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = request(url, { method, headers, servername: url.hostname, timeout }, res => {
      const chunks = [];
      let bytes = 0;
      res.on('data', chunk => {
        bytes += chunk.length;
        if (bytes > 2 * 1024 * 1024) {
          req.destroy(new Error('Planner response exceeds limit.'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('error', reject);
      res.on('end', () => resolve({ status: res.statusCode || 502, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('timeout', () => req.destroy(new Error('Planner request timed out.')));
    req.on('error', reject);
    req.end(body);
  });
}
