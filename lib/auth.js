import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.AUTH_SECRET || 'your-shared-secret';

export function verifyAdminToken(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'No token provided' };
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Optional: Check if decoded.role is an admin role
    if (!decoded.role || !decoded.role.toLowerCase().includes('admin')) {
      return { valid: false, error: 'Insufficient permissions' };
    }
    return { valid: true, user: decoded };
  } catch (err) {
    return { valid: false, error: 'Invalid token' };
  }
}