#!/usr/bin/env node

/**
 * Security Configuration Checker
 * Verifies that all security measures are properly configured
 */

const fs = require('fs');
const path = require('path');

console.log('🔒 Security Configuration Checker\n');
console.log('=================================\n');

let errors = 0;
let warnings = 0;
let passed = 0;

// Check 1: .env.local exists
console.log('1. Checking .env.local file...');
if (fs.existsSync('.env.local')) {
  console.log('   ✅ .env.local exists');
  passed++;
  
  const envContent = fs.readFileSync('.env.local', 'utf8');
  
  // Check API keys are set
  if (envContent.includes('GOOGLE_AI_API_KEY=') && !envContent.includes('your_google_ai_studio_api_key_here')) {
    console.log('   ✅ GOOGLE_AI_API_KEY is set');
    passed++;
  } else {
    console.log('   ❌ GOOGLE_AI_API_KEY not configured');
    errors++;
  }
  
  if (envContent.includes('GOOGLE_MAPS_API_KEY=') && !envContent.includes('your_google_maps_api_key_here')) {
    console.log('   ✅ GOOGLE_MAPS_API_KEY is set');
    passed++;
  } else {
    console.log('   ❌ GOOGLE_MAPS_API_KEY not configured');
    errors++;
  }
} else {
  console.log('   ❌ .env.local not found');
  console.log('   💡 Create .env.local from .env.local.example');
  errors++;
}

console.log('');

// Check 2: .gitignore includes .env.local
console.log('2. Checking .gitignore...');
if (fs.existsSync('.gitignore')) {
  const gitignoreContent = fs.readFileSync('.gitignore', 'utf8');
  if (gitignoreContent.includes('.env') || gitignoreContent.includes('.env.local')) {
    console.log('   ✅ .env files are ignored by Git');
    passed++;
  } else {
    console.log('   ⚠️  .env.local not in .gitignore');
    console.log('   💡 Add .env.local to .gitignore to prevent leaking keys');
    warnings++;
  }
} else {
  console.log('   ⚠️  .gitignore not found');
  warnings++;
}

console.log('');

// Check 3: Security files exist
console.log('3. Checking security documentation...');
const securityFiles = [
  'SECURITY.md',
  'SECURITY_CONFIGURATION.md',
  'SECURITY_QUICK_REFERENCE.md',
  'ENABLE_DIRECTIONS_API.md'
];

securityFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`   ✅ ${file} exists`);
    passed++;
  } else {
    console.log(`   ⚠️  ${file} not found`);
    warnings++;
  }
});

console.log('');

// Check 4: Rate limiter exists
console.log('4. Checking rate limiter...');
if (fs.existsSync('lib/rateLimiter.ts')) {
  const rateLimiterContent = fs.readFileSync('lib/rateLimiter.ts', 'utf8');
  if (rateLimiterContent.includes('RateLimiter')) {
    console.log('   ✅ Rate limiter implemented');
    passed++;
  }
  if (rateLimiterContent.includes('aiChatLimiter')) {
    console.log('   ✅ AI chat rate limiter configured');
    passed++;
  }
  if (rateLimiterContent.includes('mapsLimiter')) {
    console.log('   ✅ Maps rate limiter configured');
    passed++;
  }
} else {
  console.log('   ❌ lib/rateLimiter.ts not found');
  errors++;
}

console.log('');

// Check 5: Middleware exists
console.log('5. Checking security middleware...');
if (fs.existsSync('middleware.ts')) {
  const middlewareContent = fs.readFileSync('middleware.ts', 'utf8');
  if (middlewareContent.includes('X-Content-Type-Options')) {
    console.log('   ✅ Security headers configured');
    passed++;
  }
  if (middlewareContent.includes('Access-Control-Allow-Origin')) {
    console.log('   ✅ CORS headers configured');
    passed++;
  }
} else {
  console.log('   ⚠️  middleware.ts not found');
  console.log('   💡 Consider adding middleware for security headers');
  warnings++;
}

console.log('');

// Check 6: Validation exists
console.log('6. Checking input validation...');
if (fs.existsSync('lib/validation.ts')) {
  console.log('   ✅ Input validation implemented');
  passed++;
} else {
  console.log('   ❌ lib/validation.ts not found');
  errors++;
}

console.log('');

// Check 7: Audit logger exists
console.log('7. Checking audit logger...');
if (fs.existsSync('lib/auditLogger.ts')) {
  console.log('   ✅ Audit logger implemented');
  passed++;
} else {
  console.log('   ❌ lib/auditLogger.ts not found');
  errors++;
}

console.log('');

// Check 8: API routes have rate limiting
console.log('8. Checking API routes...');
const apiRoutes = [
  'app/api/chat/route.ts',
  'app/api/places/route.ts',
  'app/api/place-photo/route.ts',
  'app/api/maps-key/route.ts'
];

apiRoutes.forEach(route => {
  if (fs.existsSync(route)) {
    const routeContent = fs.readFileSync(route, 'utf8');
    if (routeContent.includes('Limiter') || routeContent.includes('rateLimi')) {
      console.log(`   ✅ ${route.split('/').pop()} has rate limiting`);
      passed++;
    } else {
      console.log(`   ⚠️  ${route.split('/').pop()} missing rate limiting`);
      warnings++;
    }
  }
});

console.log('');

// Summary
console.log('=================================');
console.log('Summary:');
console.log(`✅ Passed: ${passed}`);
console.log(`⚠️  Warnings: ${warnings}`);
console.log(`❌ Errors: ${errors}`);
console.log('');

// Action items
if (errors > 0 || warnings > 0) {
  console.log('📋 Action Items:');
  console.log('');
  
  if (errors > 0) {
    console.log('🔴 Critical (Fix immediately):');
    console.log('   1. Set up API keys in .env.local');
    console.log('   2. Ensure all security libraries are present');
    console.log('');
  }
  
  if (warnings > 0) {
    console.log('🟡 Recommended:');
    console.log('   1. Add .env.local to .gitignore');
    console.log('   2. Verify rate limiting on all API routes');
    console.log('   3. Review security documentation');
    console.log('');
  }
  
  console.log('🔒 Google Cloud Console Actions (REQUIRED):');
  console.log('   1. Restrict API keys with HTTP referrers');
  console.log('   2. Enable Directions API');
  console.log('   3. Set usage quotas');
  console.log('   4. Configure billing alerts');
  console.log('');
  console.log('📖 See: SECURITY_QUICK_REFERENCE.md for detailed instructions');
} else {
  console.log('✨ All security checks passed!');
  console.log('');
  console.log('⚠️  Don\'t forget to:');
  console.log('   1. Restrict API keys in Google Cloud Console');
  console.log('   2. Enable Directions API');
  console.log('   3. Set usage quotas');
  console.log('   4. Configure billing alerts');
  console.log('');
  console.log('📖 See: SECURITY_QUICK_REFERENCE.md for details');
}

console.log('');

// Exit with appropriate code
process.exit(errors > 0 ? 1 : 0);
