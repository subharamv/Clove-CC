#!/bin/bash

echo "=== Supabase Auth AbortError Debug Script ==="
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "❌ node_modules not found. Run 'npm install' first."
    exit 1
fi

# Check environment variables
echo "🔍 Checking environment variables..."
if [ -f ".env" ]; then
    echo "✅ .env file found"
    if grep -q "VITE_SUPABASE_URL" .env && grep -q "VITE_SUPABASE_ANON_KEY" .env; then
        echo "✅ Supabase environment variables found"
    else
        echo "❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env"
        echo "Add these to your .env file:"
        echo "VITE_SUPABASE_URL=your_supabase_url"
        echo "VITE_SUPABASE_ANON_KEY=your_supabase_anon_key"
    fi
else
    echo "⚠️  No .env file found - checking for environment variables..."
    if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
        echo "❌ Environment variables not set"
    else
        echo "✅ Environment variables found"
    fi
fi

echo ""

# Check package.json for correct Supabase version
echo "📦 Checking Supabase version..."
if grep -q "@supabase/supabase-js" package.json; then
    VERSION=$(grep "@supabase/supabase-js" package.json | sed 's/.*"\^//g' | sed 's/".*//g')
    echo "✅ Found @supabase/supabase-js version: $VERSION"
    
    # Check if version has known issues
    if [[ "$VERSION" == "2.39"* ]] || [[ "$VERSION" == "2.40"* ]] || [[ "$VERSION" == "2.41"* ]]; then
        echo "⚠️  Version $VERSION may have auth deadlock issues. Consider upgrading to 2.42+"
    fi
else
    echo "❌ @supabase/supabase-js not found in package.json"
fi

echo ""

# Run development server check
echo "🚀 Testing development startup..."
echo "Starting dev server for 10 seconds to check for immediate errors..."

timeout 10s npm run dev 2>&1 | head -20

echo ""
echo "=== Debugging Complete ==="
echo ""
echo "📝 Next steps:"
echo "1. Run the SQL script 'debug_admin_users.sql' in your Supabase dashboard"
echo "2. Check the browser console for detailed error messages"
echo "3. If issues persist, try clearing browser storage and refreshing"
echo ""
echo "🔧 Common fixes:"
echo "- Ensure admin_users table exists and contains your user"
echo "- Check Row Level Security policies"
echo "- Verify environment variables are correct"
echo "- Try upgrading @supabase/supabase-js to latest version"