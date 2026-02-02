# 🔍 Stripe Checkout Debugging Analysis

**Date:** 2025-01-21  
**Issue:** Stripe Checkout was working but now failing  
**Status:** ✅ Debug logging added, root cause analysis

---

## ✅ Changes Made

### **1. Enhanced Error Logging**

**File:** `src/app/api/stripe/checkout/route.ts`

**Added logging at each failure point:**
- ✅ Auth token missing/invalid
- ✅ JWT secret missing
- ✅ User not found
- ✅ Email not verified
- ✅ Environment variables missing
- ✅ Invalid plan code
- ✅ Plan not found in database
- ✅ Missing/invalid Stripe price ID
- ✅ Stripe API errors (with details)
- ✅ Session created but URL missing

**Log Format:**
- All logs prefixed with `[CHECKOUT]` for easy filtering
- Includes relevant context (userId, planCode, etc.)
- No secrets logged (only error messages)

---

## 🔍 Root Cause Analysis

### **Most Likely Issues (in order of probability):**

#### **1. Email Verification Blocking (NEW REQUIREMENT)**
**Symptom:** Users see "Please verify your email before purchasing a plan"  
**Check:** 
- User's `emailVerified` field in database
- If `false`, user must verify email first
- This is a NEW requirement added recently

**Fix:** User must verify email via `/verify-email?token=...` link

#### **2. Missing Stripe Price IDs in Database**
**Symptom:** Generic "Stripe checkout failed" error (500)  
**Check:**
```sql
SELECT code, name, "stripePriceId" FROM "Plan" WHERE code IN ('BASIC', 'ADVANCED', 'PRO');
```
**Expected:** All paid plans should have `stripePriceId` starting with `price_`

**Fix:** Add valid Stripe price IDs to Plan records

#### **3. Invalid/Missing Stripe Secret Key**
**Symptom:** Generic "Stripe checkout failed" error (500)  
**Check:**
- `STRIPE_SECRET_KEY` in `.env` or `.env.local`
- Key format: `sk_test_...` or `sk_live_...`
- Key matches the Stripe account with the price IDs

**Fix:** Set correct `STRIPE_SECRET_KEY` in environment

#### **4. Stripe API Errors**
**Symptom:** Generic "Stripe checkout failed" error (500)  
**Check:** Server logs for `[CHECKOUT] Stripe API error`  
**Common errors:**
- "No such price" - Price ID doesn't exist in Stripe account
- "Invalid API Key" - Wrong Stripe key
- Network/timeout errors

**Fix:** Check Stripe dashboard, verify price IDs exist

#### **5. Environment Variable Issues**
**Symptom:** Generic "Stripe checkout failed" error (500)  
**Check:**
- `NEXT_PUBLIC_APP_URL` set correctly
- `STRIPE_SECRET_KEY` set correctly
- No conflicts between `.env` and `.env.local`

**Fix:** Ensure all required env vars are set

---

## 🧪 Verification Steps

### **Step 1: Check Server Logs**

When checkout fails, check server console for:
```
[CHECKOUT] <error message>
```

This will tell you exactly where it's failing.

### **Step 2: Verify Database Plans**

```bash
# Via Prisma Studio
npx prisma studio

# Or via SQL
psql -d nexbuddy_saas -c "SELECT code, name, \"stripePriceId\" FROM \"Plan\" WHERE code IN ('BASIC', 'ADVANCED', 'PRO');"
```

**Expected:**
- All plans have `stripePriceId` set
- Price IDs start with `price_`
- Price IDs are valid in your Stripe account

### **Step 3: Verify Environment Variables**

```bash
# Check if variables are loaded
node -e "console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? 'SET' : 'MISSING');"
```

**Required:**
- `STRIPE_SECRET_KEY` - Must be set
- `NEXT_PUBLIC_APP_URL` - Must be set (e.g., `http://localhost:3000`)

### **Step 4: Test Checkout Flow**

1. **Login as verified user:**
   - Register → Verify email → Login
   - Or use existing verified user

2. **Click "Buy Now" on paid plan:**
   - Should redirect to Stripe Checkout
   - If error, check server logs for `[CHECKOUT]` messages

3. **Check browser console:**
   - Look for network errors
   - Check response status codes

### **Step 5: Verify Stripe Configuration**

1. **Check Stripe Dashboard:**
   - Products → Prices
   - Verify price IDs match database
   - Verify prices are active

2. **Test Stripe Key:**
   ```bash
   # Using Stripe CLI
   stripe prices list --api-key sk_test_...
   ```

---

## 🔧 Common Fixes

### **Fix 1: Plans Missing Stripe Price IDs**

**Problem:** Plans exist but `stripePriceId` is NULL

**Solution:**
1. Create prices in Stripe Dashboard
2. Update Plan records:
   ```sql
   UPDATE "Plan" SET "stripePriceId" = 'price_xxxxx' WHERE code = 'BASIC';
   UPDATE "Plan" SET "stripePriceId" = 'price_xxxxx' WHERE code = 'ADVANCED';
   UPDATE "Plan" SET "stripePriceId" = 'price_xxxxx' WHERE code = 'PRO';
   ```

### **Fix 2: Email Verification Required**

**Problem:** User not verified, checkout blocked

**Solution:**
- User must verify email first
- Or in development: Auto-verify is enabled (see registration code)

### **Fix 3: Wrong Stripe Environment**

**Problem:** Using test key with live prices (or vice versa)

**Solution:**
- Ensure `STRIPE_SECRET_KEY` matches the environment of your price IDs
- Test keys: `sk_test_...`
- Live keys: `sk_live_...`

### **Fix 4: Invalid Price ID Format**

**Problem:** Price ID doesn't start with `price_`

**Solution:**
- Stripe recurring prices must start with `price_`
- Product IDs (`prod_...`) won't work
- Update database with correct price IDs

---

## 📋 Debugging Checklist

- [ ] Check server logs for `[CHECKOUT]` messages
- [ ] Verify user is authenticated (JWT valid)
- [ ] Verify user email is verified (`emailVerified = true`)
- [ ] Verify plan exists in database
- [ ] Verify plan has `stripePriceId` set
- [ ] Verify `stripePriceId` starts with `price_`
- [ ] Verify `STRIPE_SECRET_KEY` is set
- [ ] Verify `NEXT_PUBLIC_APP_URL` is set
- [ ] Verify Stripe price ID exists in Stripe account
- [ ] Verify Stripe key matches price ID environment
- [ ] Test Stripe API directly (via Stripe CLI or dashboard)

---

## 🎯 Next Steps

1. **Run the app and attempt checkout**
2. **Check server console for `[CHECKOUT]` logs**
3. **Identify the exact failure point from logs**
4. **Apply the appropriate fix from above**

---

## ✅ What Was NOT Changed

- ✅ Webhook logic unchanged
- ✅ Free plan logic unchanged
- ✅ Auth logic unchanged (only added logging)
- ✅ Database schema unchanged
- ✅ Frontend unchanged
- ✅ Pricing page unchanged

**Only change:** Added comprehensive error logging to identify failure point.

---

**Status:** Ready for testing. Check server logs to identify exact failure point.
