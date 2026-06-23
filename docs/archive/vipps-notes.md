# Vipps Recurring API Notes

## Overview
- Vipps Recurring API enables subscription payments without card numbers
- Customers get notifications of withdrawals through Vipps MobilePay
- Requires ordering "Recurring payments" product on vippsmobilepay.com

## Integration Requirements
1. Need to order Recurring payments product from vippsmobilepay.com
2. Need API keys from Vipps business portal
3. Need to complete API checklist for direct integration

## Key Points
- Vipps requires a business account enabled for online payment
- Can extend existing Vipps account with recurring functionality
- Provides user flows for subscription management

## Decision
Since Vipps requires:
1. Business registration with Vipps
2. Separate API keys and merchant account
3. Approval process from Vipps

We will implement Vipps as a "coming soon" feature and focus on:
1. Stripe (already working)
2. Email notifications for subscriptions
