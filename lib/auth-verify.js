import jwt from 'jsonwebtoken';

export async function verifyAdminToken(request) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      console.log('❌ No auth header provided');
      return null;
    }

    // Handle both "Bearer <token>" and just "<token>"
    let token = authHeader;
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // Verify using the secret from .env.local
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    return decoded;
  } catch (error) {
    console.log('❌ Token verification failed:', error.message);
    return null;
  }
}