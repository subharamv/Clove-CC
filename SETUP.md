# Clovians Cafeteria - Setup Guide

## Environment Configuration

The application requires the following environment variables to be configured in `.env.local`:

### Required Variables

```env
VITE_SUPABASE_URL=https://rzudkvuovoehruxfrlaz.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6dWRrdnVvdm9laHJ1eGZybGF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MTY0NzksImV4cCI6MjA4NjI5MjQ3OX0.oywJX8RHdMzIPicPavN9l7JruhKXonPnmp4yahmiNrY
```

### Optional Variables

```env
GEMINI_API_KEY=your_api_key_here
```

## Architecture

### Backend Integration

- **Supabase**: Real-time database and authentication
  - Handles user authentication (email/password)
  - Stores employee/coupon data in `coupons` table
  - Manages user profiles and settings
  - Provides RLS (Row Level Security) for data protection

- **Google Gemini**: AI features (optional)
  - Can be used for AI-assisted coupon management
  - Configured via `GEMINI_API_KEY`

### Frontend Structure

```
src/
├── pages/          # View pages
│   ├── Landing.tsx   # Welcome page
│   ├── Login.tsx     # Authentication
│   ├── Dashboard.tsx # Main dashboard
│   ├── Dishes.tsx    # Menu management
│   ├── Settings.tsx  # App configuration
│   └── ...
├── components/     # Reusable components
│   ├── Layout.tsx   # App shell with navigation
│   ├── Sidebar.tsx  # Navigation sidebar
│   └── ...
├── App.tsx         # App router and state management
├── main.tsx        # Vite entry point
└── types.ts        # TypeScript definitions
```

## How It Works

### Authentication Flow

1. User lands on **Landing** page with info about the app
2. Click "Get Started" → navigates to **Login**
3. User enters email and password
4. Supabase authenticates and issues session token
5. On success, redirects to **Dashboard**
6. Session persists using `localStorage`

### Data Flow

1. **Dashboard** displays employee list from Supabase `coupons` table
2. Users can:
   - Upload CSV file with employees
   - Issue coupons
   - View issued history
   - Manage settings
3. All data writes sync to Supabase in real-time

### Settings

- Coupon prefix/suffix configuration
- Validity period settings
- Payment settings (optional)
- Custom coupon template image

## Development

### Install Dependencies
```bash
npm install
```

### Start Dev Server
```bash
npm run dev
```

Visit `http://localhost:5173`

### Build for Production
```bash
npm run build
```

### Available Views

- **Landing**: Welcome screen with feature highlights
- **Login**: Email/password authentication with forgot password
- **Dashboard**: Employee list, CSV upload, coupon issuance
- **Issue Coupons**: Main section for creating coupons
- **Issued History**: View all issued coupons with details
- **Pending**: Coupons waiting to be received
- **Settings**: Configure app, manage users, upload templates

## Troubleshooting

### Supabase Connection Failed
- Verify `.env.local` has correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Check your internet connection
- Ensure Supabase project is active

### Login Not Working
- Verify user exists in Supabase Auth
- Check email/password are correct
- Look for error message in browser console

### Environment Variables Not Loading
- Restart dev server after changing `.env.local`
- Ensure variable names start with `VITE_` (required by Vite)
- Check that `.env.local` file exists in root directory

### CSS Not Loading
- Make sure `postcss.config.js` exists
- Tailwind CSS is configured in `tailwind.config.ts`
- PostCSS plugins are installed: `npm install -D postcss autoprefixer`
