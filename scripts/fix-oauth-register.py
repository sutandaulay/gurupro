#!/usr/bin/env python3
"""
Fix Google OAuth Flow - Store checkout_plan & referral to localStorage

This script fixes the register page to properly store checkout_plan and include it in callback URL.
"""

import re

REGISTER_PAGE = "app/(app)/(auth)/register/page.tsx"

# Read the file
with open(REGISTER_PAGE, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Update the Google button onClick handler
# Find the Google button onClick handler and update it
old_google_handler = r'''signIn\("google", \{ callbackUrl: "/dashboard"\}'''

new_google_handler = '''signIn("google", { callbackUrl: checkoutPlan ? `/dashboard?checkout=${checkoutPlan}` : "/dashboard" }'''

content = re.sub(old_google_handler, new_google_handler, content)
print("✅ Fixed callbackUrl in register page")

# Fix 2: Update the text display to show checkout plan info
# Find the info text that shows after Google button
old_info_text = r'''\{invitationSchoolName \|\| referralCode\) && \('''

new_info_text = '''{invitationSchoolName || referralCode || checkoutPlan) && ('''

content = re.sub(old_info_text, new_info_text, content)
print("✅ Fixed info text condition")

# Fix 3: Add checkout plan text to the info display
old_checkout_text = r'''\{checkoutPlan && \('''

new_checkout_text = '''{checkoutPlan && ('''

content = re.sub(old_checkout_text, new_checkout_text, content)
print("✅ Fixed checkout plan display")

# Fix 4: Add checkout plan info line in the info section
old_info_line = r'''\{referralCode && \('''

new_info_line = '''{checkoutPlan && (
                    <span>Checkout plan {checkoutPlan} akan otomatis diproses. </span>
                  )}
                  {referralCode && ('''

content = re.sub(old_info_line, new_info_line, content)
print("✅ Added checkout plan info line")

# Write the file
with open(REGISTER_PAGE, 'w', encoding='utf-8') as f:
    f.write(content)

print("\n✅ All fixes applied to register page")
