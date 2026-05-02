const jwt = require('jsonwebtoken');
const { isBlacklisted } = require('../services/tokenBlacklist');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && req.query.token) {
    // Fallback fuer Datei-Downloads (<a href>) – nur fuer GET-Requests sinnvoll.
    token = String(req.query.token);
  }
  if (!token) {
    return res.status(401).json({ error: 'Kein Token angegeben' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.jti && isBlacklisted(decoded.jti)) {
      return res.status(401).json({ error: 'Token wurde widerrufen' });
    }
    req.user = decoded;
    req.tokenJti = decoded.jti || null;
    req.tokenExp = decoded.exp || null;
    next();
  } catch {
    return res.status(401).json({ error: 'Ungültiges Token' });
  }
}

module.exports = authMiddleware;
module.exports.authMiddleware = authMiddleware;
