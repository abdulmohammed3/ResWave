import { NextFunction, Request, Response, RequestHandler, ErrorRequestHandler } from 'express';
import { ClerkExpressRequireAuth, AuthObject } from '@clerk/clerk-sdk-node';
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

// Clerk auth middleware
const requireAuth: RequestHandler = ClerkExpressRequireAuth({
  onError: (error: Error) => {
    throw new AuthenticationError('Authentication required', {
      originalError: error.message
    });
  }
});

// Additional middleware to transform Clerk auth data to our format
export const validateAuthData: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const clerkAuth = (req as any).auth as AuthObject;
    if (!clerkAuth?.userId) {
      throw new AuthenticationError('Invalid authentication data');
    }

    const token = await clerkAuth.getToken();
    const claims = token ? JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString()) : {};

    const emailAddresses = (claims.email || []).map((email: string) => ({
      emailAddress: email,
      verification: { status: 'verified' as const }
    }));

    // Transform to our AuthRequest format
    (req as AuthRequest).auth = {
      userId: clerkAuth.userId,
      user: {
        id: clerkAuth.userId,
        emailAddresses,
        firstName: claims.firstName as string | null,
        lastName: claims.lastName as string | null
      } as ClerkUser
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
const handleAuthError: ErrorRequestHandler = (
  err: Error,
  _req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (err instanceof AuthenticationError) {
    next(err);
    return;
  }
  next(new AuthenticationError('Authentication required'));
};

// Combined middleware for authentication flow
export const authenticate: Array<RequestHandler | ErrorRequestHandler> = [
  requireAuth,
  validateAuthData,
  handleAuthError
];

// Export the individual middleware for flexibility
export { requireAuth };