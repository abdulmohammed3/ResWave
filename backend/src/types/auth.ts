import { Request } from 'express';
import { User, EmailAddress } from '@clerk/clerk-sdk-node';

export interface ClerkUser {
  id: string;
  emailAddresses: EmailAddress[];
  firstName?: string | null;
  lastName?: string | null;
}

export interface AuthUser {
  id: string;
  primaryEmail?: string;
  firstName?: string;
  lastName?: string;
}

// Augment the Express Request type
declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        user?: ClerkUser;
      };
    }
  }
}

export type AuthRequest = Request & {
  auth: {
    userId: string;
    user?: ClerkUser;
  };
};

// Helper function to get primary email from Clerk's EmailAddress array
export function getPrimaryEmail(emailAddresses: EmailAddress[]): string | undefined {
  const primaryEmail = emailAddresses.find(email => 
    email.verification?.status === 'verified'
  );
  return primaryEmail?.emailAddress;
}

// For type checking if a request is authenticated
export function isAuthRequest(req: Request): req is AuthRequest {
  return 'auth' in req && 'userId' in (req.auth || {});
}