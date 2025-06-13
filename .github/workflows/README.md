# GitHub Actions CI/CD Setup

This directory contains GitHub Actions workflows for automated testing and deployment.

## Workflows

### 1. CI (ci.yml)
Runs on every push to main and on all pull requests:
- Builds the project
- Runs ESLint
- Runs TypeScript type checking

### 2. Vercel Preview (vercel-preview.yml)
Deploys preview builds for branches other than main.

### 3. Vercel Production (vercel-production.yml)
Deploys to production when pushing to main branch.

## Required GitHub Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

### For CI workflow:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `OPENROUTER_API_KEY` - Your OpenRouter API key

### For Vercel workflows (optional):
- `VERCEL_TOKEN` - Your Vercel access token
- `VERCEL_ORG_ID` - Your Vercel organization ID
- `VERCEL_PROJECT_ID` - Your Vercel project ID

To get Vercel values:
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel link` in your project
3. Find values in `.vercel/project.json`
4. Get token from: https://vercel.com/account/tokens

## Benefits

- **Automated Quality Checks**: Ensures code quality before merging
- **Prevents Broken Builds**: Catches build errors before deployment
- **Consistent Standards**: Enforces linting and type safety
- **Preview Deployments**: Test changes before going to production
- **Automated Deployments**: Deploys automatically on merge to main