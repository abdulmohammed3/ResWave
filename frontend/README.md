# ResWave Frontend

## Authentication with Clerk

This application uses [Clerk](https://clerk.dev) for authentication and user management.

### Setup

1. Create a Clerk account and application at [https://dashboard.clerk.dev](https://dashboard.clerk.dev)
2. Copy your Clerk keys from the dashboard
3. Create a `.env.local` file with the following variables:
   ```env
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_publishable_key
   CLERK_SECRET_KEY=your_secret_key
   ```

### Features

- Protected routes with middleware
- Sign in/sign up pages
- User profile management
- Session handling
- Secure API requests with authentication headers

### Protected Routes

The following routes require authentication:
- `/optimizer` - Resume optimization page
- `/api/*` - API routes (except webhooks)

Public routes:
- `/` - Home page
- `/pricing` - Pricing page
- `/sign-in` - Sign in page
- `/sign-up` - Sign up page

### Authentication Flow

1. Users sign in through Clerk's UI
2. Clerk provides a session token
3. Frontend includes token in API requests:
   ```typescript
   const { getToken } = useAuth();
   
   // Example API request
   const headers = {
     'Authorization': `Bearer ${await getToken()}`
   };
   const response = await fetch('/api/v1/files', { headers });
   ```

### Components

- `NavBar` - Navigation bar with authentication state and user menu
- `EnhancedFileManager` - Protected component with authenticated API requests
- Authentication pages (`sign-in`, `sign-up`)

### Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.local.example .env.local
   # Add your Clerk keys
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

### Testing Authentication

To test protected routes:
1. Create a test account through the sign-up page
2. Sign in with the test account
3. Try accessing protected routes and API endpoints

### Notes

- Make sure both frontend and backend are running for full functionality
- Backend expects Clerk session tokens in the Authorization header
- All API requests from authenticated components automatically include the session token
