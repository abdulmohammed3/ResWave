import { NextFunction, Request, Response } from 'express';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { expressjwt, Request as JWTRequest } from 'express-jwt';
import { OptimizationError } from '../utils/errors';
import { AuthRequest, ClerkUser } from '../types/auth';

// Custom error class for authentication failures
export class AuthenticationError extends OptimizationError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, {
      stage: 'authentication',
      processingStatus: 'auth_failed',
      timestamp: new Date().toISOString(),
      ...metadata,
      errorCode: 'AUTH_FAILURE'
    });
  }
}

// Get Clerk secret key from environment
const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) {
  throw new Error('CLERK_SECRET_KEY is not set in environment variables');
}

// JWT middleware configuration
const requireAuth = expressjwt({
  secret: secretKey,
  algorithms: ['HS256'],
  requestProperty: 'auth',
  getToken: (req: Request): string | undefined => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.split(' ')[0] === 'Bearer') {
      return authHeader.split(' ')[1];
    }
    return undefined;
  }
});

// Additional middleware to transform Clerk auth data to our format
export const validateAuthData = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const jwtReq = req as JWTRequest;
    if (!jwtReq.auth?.sub) {
      throw new AuthenticationError('Invalid authentication data');
    }

    // Get full user data from Clerk
    const user = await clerkClient.users.getUser(jwtReq.auth.sub);
    
    // Transform to our AuthRequest format
    (req as AuthRequest).auth = {
      userId: user.id,
      user: {
        id: user.id,
        emailAddresses: user.emailAddresses,
        firstName: user.firstName,
        lastName: user.lastName
      }
    };

    next();
  } catch (error) {
    next(
      new AuthenticationError('Failed to validate auth data', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    );
  }
};

// Error handling middleware for auth errors
const handleAuthError = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err.name === 'UnauthorizedError') {
    next(new AuthenticationError('Authentication required'));
    return;
  }
  next(err);
};

// Combined middleware for authentication flow
export const authenticate = [
  requireAuth,
  handleAuthError,
  validateAuthData
];

// Export the individual middleware for flexibility
export { requireAuth };