export default function admin(req, res, next) {
  if (req.user && req.user.role === 'Admin') {
    return next();
  }
  return res.status(403).json({ message: 'Access denied. Admins only.' });
} 