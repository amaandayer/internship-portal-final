'use strict';

function logRequests(handler) {
  return function (req, res) {
    const start = process.hrtime.bigint();
    const id = Math.random().toString(36).slice(2, 10);
    res.setHeader('X-Request-Id', id);

    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      const status = res.statusCode;
      const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          level,
          id,
          method: req.method,
          path: String(req.url).split('?')[0],
          status,
          ms: Math.round(ms * 10) / 10,
        })
      );
    });

    return handler(req, res);
  };
}

module.exports = { logRequests };
