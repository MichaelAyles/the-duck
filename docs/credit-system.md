# Credit Usage Tracking System

## Overview

The Duck now includes a comprehensive credit usage tracking system that allows users to set spending limits and monitor their AI usage across different models. This system helps prevent unexpected costs and provides detailed insights into usage patterns.

## Features

### 🏦 Credit Management
- **Flexible Limits**: Set custom credit limits from $1 to $100
- **Reset Periods**: Choose daily, weekly, monthly, or never reset
- **Automatic Reset**: Credits automatically reset based on the selected period
- **Real-time Tracking**: Live updates of credit usage during conversations

### 📊 Usage Analytics
- **Token Tracking**: Monitor prompt and completion tokens for each request
- **Cost Calculation**: Accurate cost tracking based on OpenRouter model pricing
- **Model Analytics**: See which models you use most and their costs
- **Historical Data**: View usage trends and patterns over time

### 🛡️ Protection Features
- **Usage Limits**: Automatically blocks requests when credit limit is exceeded
- **Low Credit Warnings**: Alerts when approaching credit limit (< 10% remaining)
- **Graceful Degradation**: System continues to work even if tracking fails

## Database Schema

### `user_credits` Table
```sql
- user_id: UUID (Primary Key)
- credit_limit: DECIMAL(10,2) DEFAULT 10.00
- credits_used: DECIMAL(10,2) DEFAULT 0.00
- reset_period: TEXT DEFAULT 'monthly'
- last_reset: TIMESTAMP DEFAULT NOW()
- created_at: TIMESTAMP DEFAULT NOW()
- updated_at: TIMESTAMP DEFAULT NOW()
```

### `user_usage` Table
```sql
- id: UUID (Primary Key)
- user_id: UUID (Foreign Key)
- session_id: TEXT (Optional)
- model: TEXT (Model used)
- prompt_tokens: INTEGER
- completion_tokens: INTEGER
- total_tokens: INTEGER
- prompt_cost: DECIMAL(10,6)
- completion_cost: DECIMAL(10,6)
- total_cost: DECIMAL(10,6)
- created_at: TIMESTAMP DEFAULT NOW()
```

## API Endpoints

### `/api/credits`
- **GET**: Fetch user credit information and current usage
- **PUT**: Update credit settings (limit, reset period)

### `/api/usage`
- **GET**: Fetch detailed usage statistics with filtering options
  - Query params: `period` (7d, 30d, all), `groupBy` (day, model)

## Usage in UI

### Preferences Tab
The usage summary is accessible through the **Usage** tab in the preferences dialog, which displays:

1. **Credit Overview**
   - Current usage vs. limit
   - Remaining credits
   - Usage percentage with color-coded progress bar

2. **Credit Settings**
   - Adjustable credit limit slider ($1-$100)
   - Reset period selection (daily/weekly/monthly/never)

3. **Usage by Model**
   - Top 3 most used models
   - Cost and token statistics per model
   - Average cost per request

### Real-time Protection
- **HTTP 402 (Payment Required)** response when credit limit exceeded
- **Console warnings** when credits are running low
- **Toast notifications** for credit-related errors

## Token Estimation

Since OpenRouter doesn't always provide exact token counts in streaming responses, the system uses approximation:
- **1 token ≈ 4 characters** (rough estimate for English text)
- **Prompt tokens**: Calculated from input message content
- **Completion tokens**: Accumulated during streaming response

## Setup Instructions

### 1. Database Setup
Run the SQL migration to create the required tables:
```bash
# Execute sql/create_usage_tables.sql in your Supabase dashboard
```

### 2. Environment Variables
No additional environment variables required - uses existing Supabase and OpenRouter configurations.

### 3. Default Configuration
- **New users**: $10 monthly credit limit
- **Reset period**: Monthly (1st of each month)
- **Tracking**: Automatic for all authenticated users

## Error Handling

The system is designed to be non-blocking:
- **Usage tracking failures**: Logged but don't prevent chat requests
- **Credit updates**: Retried with fallback mechanisms
- **Missing pricing data**: Uses fallback rates (prompt: $0.0001, completion: $0.0002 per 1K tokens)

## Security & Privacy

- **Row Level Security (RLS)**: Users can only access their own usage data
- **Authentication required**: All credit endpoints require valid authentication
- **Input validation**: Credit limits and reset periods are validated
- **No PII stored**: Only usage metrics and costs are tracked

## Future Enhancements

- **Payment integration**: Connect to Stripe or similar for automatic credit top-ups
- **Usage alerts**: Email notifications for credit limits
- **Advanced analytics**: More detailed usage charts and trends
- **Team management**: Shared credit pools for organizations
- **Model recommendations**: Suggest cost-effective models based on usage patterns