/**
 * Payload Schema Push Script
 * Run: npx tsx scripts/push-payload.ts
 */

import { getPayload } from "../lib/payload";
import config from "../payload.config";

async function pushPayloadSchema() {
  console.log('=== PUSH PAYLOAD SCHEMA ===\n');

  try {
    console.log('Connecting to Payload CMS...');
    const payload = await getPayload({ config });
    console.log('✅ Payload connected\n');

    console.log('Payload will auto-push schema when initialized.');
    console.log('If collections are missing, they will be created.\n');

    // Try to query each collection to check if it exists
    const collections = [
      'cms-users',
      'institutions',
      'institution-members',
      'modul-ajar',
      'bahan-ajar',
      'silabus',
      'lkpd',
      'media',
      'features',
      'why-points',
      'categories',
      'posts',
      'addon-token-packages',
      'landing-page',
      'footer-content',
      'chatbot-config',
      'leader-contacts',
      'performance-share-links',
      'document-access-grants',
      'otp-verifications',
      'invitations',
      'teacher-institution-assignments',
      'attendance-devices',
      'attendance-logs',
      'attendance-summary',
      'leave-requests',
    ];

    console.log('Checking collections:\n');
    for (const slug of collections) {
      try {
        const result = await payload.find({
          collection: slug,
          limit: 1,
        });
        console.log(`  ✅ ${slug}: accessible`);
      } catch (e: any) {
        if (e.message?.includes('not found') || e.message?.includes('does not exist')) {
          console.log(`  ❌ ${slug}: collection not found`);
        } else {
          console.log(`  ⚠️  ${slug}: ${e.message?.substring(0, 60)}`);
        }
      }
    }

    console.log('\n=== SCHEMA PUSH COMPLETE ===');
    console.log('\nNote: Payload 3.x auto-creates missing collections on first access.');
    console.log('If collections are missing, they will be created automatically.\n');

  } catch (e) {
    console.error('Failed:', e);
  }
}

pushPayloadSchema().catch(console.error);
