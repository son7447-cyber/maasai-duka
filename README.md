# Maasai Duka V1.1

Johnson's mobile-first Simple Sales & Credit Book.

## Core functions
- Products
- Cash / M-Pesa Sale
- Credit Sale
- Repayment
- Customers and balances
- Dashboard
- Transaction history

## Deployment
Static site suitable for Vercel.

## Security note
`config.js` contains only the browser-safe Supabase publishable key. Never add a secret/service_role key to this repository.

## V1 photo note
Product photos are stored locally in the browser for the first test version. A later version can use Supabase Storage so photos follow Johnson across devices.
