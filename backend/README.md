# ResWave Backend

## Authentication

This application uses [Clerk](https://clerk.dev/) for authentication. The implementation provides secure user authentication and session management for all API endpoints.


### Authentication Flow

1. Frontend obtains session token from Clerk
2. Include token in requests to backend:
   ```javascript
   headers: {
     'Authorization': 'Bearer your_session_token'
   }
   ```
3. Backend validates token and provides access to protected resources

### Protected Routes

All routes in `/api/v1/files` are protected and require authentication. The middleware chain:

1. Validates the JWT token
2. Ensures user exists
3. Provides user data to the request object

### Error Handling

Authentication errors are handled consistently throughout the application:

- Invalid/missing token: 401 Unauthorized
- Invalid session: 401 Unauthorized
- Token expired: 401 Unauthorized
- Server errors: 500 Internal Server Error

### Development

For local development:

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Add your Clerk keys to .env
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

### Testing Protected Routes

You can test protected routes using curl:

```bash
curl -H "Authorization: Bearer your_session_token" \
     -H "X-Session-Id: your_session_id" \
     http://localhost:3001/api/v1/files
```

Or using the Clerk React SDK in your frontend application.

## API Reference

All endpoints require authentication unless specified otherwise.

### Endpoints

- `GET /api/v1/files` - Get all files for authenticated user
- `POST /api/v1/files` - Upload a new file
- `GET /api/v1/files/:fileId/versions` - Get versions of a file
- `POST /api/v1/files/:fileId/versions/:versionId/restore` - Restore a specific version
- `GET /api/v1/files/:fileId/download` - Download latest version of a file
- `GET /api/v1/files/:fileId/versions/:versionId/download` - Download specific version
- `GET /api/v1/files/:fileId/analytics` - Get file analytics
- `POST /api/v1/files/:fileId/optimize` - Optimize a file

For detailed API documentation, refer to the [API Documentation](./docs/api.md).