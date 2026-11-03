import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.AUTH_SECRET || 'your-shared-secret';

export function verifyAdminToken(request) {
  const authHeader = request.headers.get('authorization');
  const cookieToken = request.cookies.get('admin_token')?.value;
  
  const token = cookieToken || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);
  
  if (!token) return { valid: false, error: 'No token provided' };

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { valid: true, user: decoded };
  } catch (err) {
    return { valid: false, error: 'Invalid or expired token' };
  }
}
