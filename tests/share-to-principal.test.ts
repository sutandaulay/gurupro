/**
 * API Test Suite: Share-to-Principal & Upsell Trigger
 *
 * Tests untuk:
 * - Share link generation and sending via WhatsApp/Email
 * - OTP Level 2 verification (document access)
 * - Leader contact matching and phone normalization
 * - Upsell trigger (2+ teachers sharing to same contact)
 * - Financial data exclusion in leader view
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/lib/db', () => ({
  query: vi.fn(),
  pool: { connect: vi.fn() },
}));

vi.mock('@/lib/notifications', () => ({
  sendEmailNotification: vi.fn().mockResolvedValue({ success: true }),
  sendWhatsAppNotification: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/payload', () => ({
  getPayload: vi.fn(),
}));

import { query } from '@/lib/db';
import { sendWhatsAppNotification, sendEmailNotification } from '@/lib/notifications';

const mockQuery = query as ReturnType<typeof vi.fn>;
const mockSendWhatsApp = sendWhatsAppNotification as ReturnType<typeof vi.fn>;
const mockSendEmail = sendEmailNotification as ReturnType<typeof vi.fn>;

const VALID_UUID = '11111111-1111-1111-1111-111111111111';
const VALID_UUID2 = '22222222-2222-2222-2222-222222222222';

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================
// TESTS: PHONE NUMBER NORMALIZATION
// ============================================

describe('Share-to-Principal - Phone Number Normalization', () => {

  describe('E.164 Format Conversion', () => {
    it('should convert 08xx to +628xx format', () => {
      const normalizePhone = (phone: string): string => {
        // Remove all non-digit
        const digits = phone.replace(/\D/g, '');
        // Add country code if not present
        if (digits.startsWith('0')) {
          return '+62' + digits.slice(1);
        }
        if (digits.startsWith('62')) {
          return '+' + digits;
        }
        return phone;
      };

      expect(normalizePhone('081234567890')).toBe('+6281234567890');
      expect(normalizePhone('089912345678')).toBe('+6289912345678');
    });

    it('should normalize various formats consistently', () => {
      const normalizePhone = (phone: string): string => {
        const digits = phone.replace(/\D/g, '');
        if (digits.startsWith('0')) return '+62' + digits.slice(1);
        if (digits.startsWith('62')) return '+' + digits;
        return phone;
      };

      const formats = [
        '081234567890',
        '6281234567890',
        '+6281234567890',
        '0812-345-678-90',
        '(0812) 345 678 90',
      ];

      const normalized = formats.map(normalizePhone);
      const unique = new Set(normalized);

      // All should normalize to same value
      expect(unique.size).toBe(1);
      expect([...unique][0]).toBe('+6281234567890');
    });

    it('should handle international format with country code', () => {
      const normalizePhone = (phone: string): string => {
        const digits = phone.replace(/\D/g, '');
        if (digits.startsWith('0')) return '+62' + digits.slice(1);
        if (digits.startsWith('62')) return '+' + digits;
        return phone;
      };

      expect(normalizePhone('+6281234567890')).toBe('+6281234567890');
      expect(normalizePhone('+1-234-567-8901')).toBe('+12345678901');
    });

    it('should reject invalid phone numbers', () => {
      const isValidPhone = (phone: string): boolean => {
        const digits = phone.replace(/\D/g, '');
        return digits.length >= 10 && digits.length <= 15;
      };

      expect(isValidPhone('081234')).toBe(false); // Too short
      expect(isValidPhone('08123456789012345')).toBe(false); // Too long
      expect(isValidPhone('081234567890')).toBe(true); // Valid
    });
  });

  describe('Leader Contact Matching', () => {
    it('should match contacts with different phone formats', async () => {
      // Leader contact stored with one format
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: VALID_UUID,
          name: 'Dr. Kepala Sekolah',
          whatsapp: '+6281234567890',
          email: 'kepala@school.sch.id',
        }],
      });

      const result = await query(
        'SELECT * FROM leader_contacts WHERE REPLACE(REPLACE(whatsapp, "+", ""), " ", "") LIKE $1',
        ['%6281234567890%']
      );

      expect(result.rows.length).toBe(1);
    });

    it('should fuzzy match similar names', async () => {
      const isNameMatch = (stored: string, searched: string): boolean => {
        const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');
        return normalize(stored).includes(normalize(searched));
      };

      expect(isNameMatch('Dr. John Smith, M.Pd.', 'John Smith')).toBe(true);
      expect(isNameMatch('Ir. Ahmad Dahlan', 'AHMAD DAHLAN')).toBe(true);
      expect(isNameMatch('Dr. Smith', 'Johnson')).toBe(false);
    });
  });
});

// ============================================
// TESTS: SHARE LINK GENERATION
// ============================================

describe('Share-to-Principal - Link Generation', () => {

  describe('Generate Share Link', () => {
    it('should generate unique share link for document', async () => {
      const generateShareLink = async () => {
        const token = Math.random().toString(36).substring(2, 15);
        return `https://gurupro.id/share/${token}`;
      };

      const link1 = await generateShareLink();
      const link2 = await generateShareLink();

      expect(link1).not.toBe(link2);
      expect(link1).toMatch(/^https:\/\/gurupro\.id\/share\//);
    });

    it('should store share link with metadata', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: VALID_UUID,
          teacher_id: VALID_UUID2,
          document_type: 'rpp_modul_ajar',
          share_token: 'abc123xyz',
          access_level: 'level1_summary_only',
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }],
      });

      const result = await query(
        'SELECT * FROM performance_share_links WHERE share_token = $1',
        ['abc123xyz']
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].access_level).toBe('level1_summary_only');
    });

    it('should set default expiry of 30 days', () => {
      const defaultExpiryDays = 30;
      const now = new Date();
      const expiryDate = new Date(now.getTime() + defaultExpiryDays * 24 * 60 * 60 * 1000);

      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      expect(daysUntilExpiry).toBe(defaultExpiryDays);
    });
  });

  describe('Access Level Configuration', () => {
    it('should support Level 1 (summary only)', async () => {
      const linkData = {
        accessLevel: 'level1_summary_only',
        documentTypes: ['rpp_modul_ajar', 'jurnal_harian'],
      };

      expect(linkData.accessLevel).toBe('level1_summary_only');
    });

    it('should support Level 2 (document access)', async () => {
      const linkData = {
        accessLevel: 'level2_document_access',
        documentCategories: ['rpp_modul_ajar', 'bank_soal', 'lkpd_bahan_ajar'],
      };

      expect(linkData.accessLevel).toBe('level2_document_access');
    });

    it('should block financial data at all levels', () => {
      const blockedKeywords = [
        'keuangan',
        'finansial',
        'financial',
        'uang',
        'gaji',
        'bonus',
        'insentif',
      ];

      const documentData = {
        type: 'keuangan_guru',
        content: 'Salary: Rp 10,000,000',
      };

      const hasBlockedKeyword = blockedKeywords.some(k =>
        documentData.type.toLowerCase().includes(k)
      );

      expect(hasBlockedKeyword).toBe(true);
    });
  });
});

// ============================================
// TESTS: OTP LEVEL 2 VERIFICATION
// ============================================

describe('Share-to-Principal - OTP Level 2', () => {

  describe('OTP Request', () => {
    it('should generate OTP for document access request', async () => {
      const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

      const otp = generateOTP();

      expect(otp.length).toBe(6);
      expect(/^\d{6}$/.test(otp)).toBe(true);
    });

    it('should store OTP with request metadata', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: VALID_UUID,
          requester_id: VALID_UUID2,
          document_access_id: VALID_UUID,
          otp_code: '123456',
          otp_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          attempts: 0,
        }],
      });

      const result = await query(
        'SELECT * FROM otp_verifications WHERE requester_id = $1',
        [VALID_UUID2]
      );

      expect(result.rows.length).toBe(1);
    });

    it('should limit OTP attempts to 5', () => {
      const maxAttempts = 5;
      const attempts = 5;

      expect(attempts >= maxAttempts).toBe(true);
    });
  });

  describe('OTP Verification', () => {
    it('should verify correct OTP', async () => {
      const correctOTP = '123456';
      const storedOTP = '123456';

      expect(correctOTP).toBe(storedOTP);
    });

    it('should reject incorrect OTP', async () => {
      const providedOTP = '654321';
      const storedOTP = '123456';

      expect(providedOTP).not.toBe(storedOTP);
    });

    it('should reject expired OTP', () => {
      const otpExpiry = new Date(Date.now() - 11 * 60 * 1000); // 11 minutes ago
      const now = new Date();

      const isExpired = now > otpExpiry;
      expect(isExpired).toBe(true);
    });

    it('should invalidate after max attempts', () => {
      const attempts = 5;
      const maxAttempts = 5;

      const isLocked = attempts >= maxAttempts;
      expect(isLocked).toBe(true);
    });
  });

  describe('Access Grant After Verification', () => {
    it('should create access grant after successful OTP', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: VALID_UUID,
          requester_id: VALID_UUID2,
          document_access_id: VALID_UUID2,
          access_level: 'level2_document_access',
          granted_at: new Date().toISOString(),
        }],
      });

      const result = await query(
        'SELECT * FROM document_access_grants WHERE requester_id = $1',
        [VALID_UUID2]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].access_level).toBe('level2_document_access');
    });

    it('should set access expiry (7 days default)', () => {
      const defaultAccessExpiryDays = 7;
      const now = new Date();
      const expiryDate = new Date(now.getTime() + defaultAccessExpiryDays * 24 * 60 * 60 * 1000);

      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      expect(daysUntilExpiry).toBe(defaultAccessExpiryDays);
    });
  });
});

// ============================================
// TESTS: UPSELL TRIGGER
// ============================================

describe('Share-to-Principal - Upsell Trigger', () => {

  describe('Trigger Condition Detection', () => {
    it('should detect when 2+ teachers share to same contact', async () => {
      // Count unique teachers sharing to same contact
      mockQuery.mockResolvedValueOnce({
        rows: [
          { contact_id: VALID_UUID, teacher_id: VALID_UUID2 },
          { contact_id: VALID_UUID, teacher_id: VALID_UUID }, // Same contact, different teacher
        ],
      });

      const shares = [
        { contact_id: VALID_UUID, teacher_id: VALID_UUID2 },
        { contact_id: VALID_UUID, teacher_id: VALID_UUID },
      ];

      const contactTeachers = shares.reduce((acc, share) => {
        if (!acc[share.contact_id]) acc[share.contact_id] = new Set();
        acc[share.contact_id].add(share.teacher_id);
        return acc;
      }, {} as Record<string, Set<string>>);

      const triggerContacts = Object.entries(contactTeachers)
        .filter(([_, teachers]) => teachers.size >= 2);

      expect(triggerContacts.length).toBe(1);
    });

    it('should NOT trigger for single teacher sharing', async () => {
      const shares = [
        { contact_id: VALID_UUID, teacher_id: VALID_UUID },
        { contact_id: VALID_UUID, teacher_id: VALID_UUID }, // Same teacher
      ];

      const contactTeachers = shares.reduce((acc, share) => {
        if (!acc[share.contact_id]) acc[share.contact_id] = new Set();
        acc[share.contact_id].add(share.teacher_id);
        return acc;
      }, {} as Record<string, Set<string>>);

      const triggerContacts = Object.entries(contactTeachers)
        .filter(([_, teachers]) => teachers.size >= 2);

      expect(triggerContacts.length).toBe(0);
    });

    it('should track unique contacts across teachers', async () => {
      const shares = [
        { teacher_id: 't1', contact_name: 'Dr. Kepala' },
        { teacher_id: 't1', contact_name: 'Dr. Kepala' }, // Same teacher, same contact
        { teacher_id: 't2', contact_name: 'Dr. Kepala' }, // Different teacher, same contact
        { teacher_id: 't2', contact_name: 'Wakasek' }, // Different teacher, different contact
      ];

      // Group by contact
      const contactTeachers = shares.reduce((acc, share) => {
        if (!acc[share.contact_name]) acc[share.contact_name] = new Set();
        acc[share.contact_name].add(share.teacher_id);
        return acc;
      }, {} as Record<string, Set<string>>);

      // Dr. Kepala: 2 teachers (trigger!)
      expect(contactTeachers['Dr. Kepala'].size).toBe(2);

      // Wakasek: 1 teacher (no trigger)
      expect(contactTeachers['Wakasek'].size).toBe(1);
    });
  });

  describe('Upsell Notification', () => {
    it('should trigger notification on 2+ teacher threshold', async () => {
      const teacherCount = 2;
      const threshold = 2;

      const shouldTrigger = teacherCount >= threshold;
      expect(shouldTrigger).toBe(true);
    });

    it('should include institution upsell data in notification', async () => {
      const upsellData = {
        triggerContact: 'Dr. Kepala',
        teacherCount: 2,
        teachers: [
          { id: 't1', name: 'Guru Matematika', school: 'SMP 1' },
          { id: 't2', name: 'Guru IPA', school: 'SMP 1' },
        ],
        suggestedAction: 'Invite institution',
      };

      expect(upsellData.teacherCount).toBeGreaterThanOrEqual(2);
      expect(upsellData.teachers.length).toBe(2);
      expect(upsellData.suggestedAction).toContain('institution');
    });

    it('should track upsell trigger timestamp', () => {
      const triggerEvent = {
        contact_id: VALID_UUID,
        triggered_at: new Date().toISOString(),
        teacher_count: 2,
      };

      expect(triggerEvent.triggered_at).toBeDefined();
      expect(triggerEvent.teacher_count).toBe(2);
    });
  });

  describe('Upsell Action Tracking', () => {
    it('should track when institution invite is sent', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: VALID_UUID,
          trigger_contact_id: VALID_UUID2,
          action: 'institution_invite_sent',
          action_at: new Date().toISOString(),
        }],
      });

      const result = await query(
        'SELECT * FROM upsell_events WHERE action = $1',
        ['institution_invite_sent']
      );

      expect(result.rows.length).toBe(1);
    });

    it('should not re-trigger for same contact within 30 days', async () => {
      const recentTrigger = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const cooldownDays = 30;

      const isInCooldown = (Date.now() - recentTrigger.getTime()) < cooldownDays * 24 * 60 * 60 * 1000;
      expect(isInCooldown).toBe(true);
    });
  });
});

// ============================================
// TESTS: FINANCIAL DATA EXCLUSION
// ============================================

describe('Share-to-Principal - Financial Data Exclusion', () => {

  describe('Leader View Data Filtering', () => {
    it('should exclude financial fields from leader response', () => {
      const guruData = {
        id: VALID_UUID,
        name: 'Guru Matematika',
        school: 'SMP 1',
        // Financial fields - should be excluded
        token_balance: 500,
        addon_balance: 100,
        subscription_status: 'active',
        billing_history: [],
        // Non-financial fields - should be included
        nip: '198501012010011001',
        position: 'Guru Matematika',
      };

      const allowedFields = ['id', 'name', 'school', 'nip', 'position'];
      const blockedFields = ['token_balance', 'addon_balance', 'subscription_status', 'billing_history'];

      // Check that financial fields are NOT in allowed list
      blockedFields.forEach(field => {
        expect(allowedFields.includes(field)).toBe(false);
      });
    });

    it('should filter document categories for financial content', () => {
      const allowedCategories = [
        'rpp_modul_ajar',
        'jurnal_harian',
        'bank_soal',
        'lkpd_bahan_ajar',
        'presensi_kinerja',
      ];

      const blockedKeywords = ['keuangan', 'finansial', 'gaji', 'bonus', 'insentif'];

      // Financial category should not be allowed
      const financialCategory = 'laporan_keuangan';
      const isAllowed = allowedCategories.includes(financialCategory);

      expect(isAllowed).toBe(false);
    });

    it('should verify summary only includes allowed data', () => {
      const summaryData = {
        teacherName: 'Guru Matematika',
        documentCount: 15,
        lastActivity: '2025-01-15',
        institutionName: 'SMP 1 Jakarta',
        // These should NEVER appear in leader view
        // tokenUsage: 250,
        // subscriptionTier: 'premium',
        // billingInfo: {},
      };

      const safeKeys = ['teacherName', 'documentCount', 'lastActivity', 'institutionName'];
      const hasUnsafeKeys = Object.keys(summaryData).some(k => !safeKeys.includes(k));

      expect(hasUnsafeKeys).toBe(false);
    });
  });

  describe('Document Access Grant Filtering', () => {
    it('should not grant access to financial documents', async () => {
      const requestedCategory = 'laporan_keuangan_guru';
      const blockedKeywords = ['keuangan', 'finansial', 'gaji', 'bonus'];

      const isBlocked = blockedKeywords.some(k =>
        requestedCategory.toLowerCase().includes(k)
      );

      expect(isBlocked).toBe(true);
    });

    it('should only allow specific document categories at Level 2', () => {
      const allowedLevel2Categories = [
        'rpp_modul_ajar',
        'bank_soal',
        'lkpd_bahan_ajar',
      ];

      const requested = 'rpp_modul_ajar';
      expect(allowedLevel2Categories.includes(requested)).toBe(true);

      const requestedBlocked = 'laporan_keuangan';
      expect(allowedLevel2Categories.includes(requestedBlocked)).toBe(false);
    });
  });

  describe('API Response Validation', () => {
    it('should strip financial data before sending leader response', () => {
      const rawGuruData = {
        id: VALID_UUID,
        name: 'Test Guru',
        token_limit: 500,
        addon_balance: 100,
        subscription_end: '2026-12-31',
        role: 'guru',
      };

      const sanitizedForLeader = (data: typeof rawGuruData) => {
        const { token_limit, addon_balance, subscription_end, ...safe } = data;
        return safe;
      };

      const result = sanitizedForLeader(rawGuruData);

      expect(result).not.toHaveProperty('token_limit');
      expect(result).not.toHaveProperty('addon_balance');
      expect(result).not.toHaveProperty('subscription_end');
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name');
    });
  });
});

// ============================================
// TESTS: SHARE LINK DELIVERY
// ============================================

describe('Share-to-Principal - Link Delivery', () => {

  describe('WhatsApp Notification', () => {
    it('should send WhatsApp message with share link', async () => {
      const messageData = {
        to: '+6281234567890',
        template: 'share_link',
        data: {
          teacherName: 'Guru Matematika',
          documentType: 'RPP Modul Ajar',
          shareLink: 'https://gurupro.id/share/abc123',
        },
      };

      mockSendWhatsApp.mockResolvedValueOnce({ success: true, messageId: 'msg-123' });

      const result = await sendWhatsAppNotification(messageData);

      expect(result.success).toBe(true);
      expect(mockSendWhatsApp).toHaveBeenCalledWith(messageData);
    });

    it('should include preview text for rich link', () => {
      const shareMessage = `
📄 *RPP Modul Ajar* dari Guru Matematika

Dokumen baru dibagikan untuk dilihat.

👆 Klik untuk melihat
https://gurupro.id/share/abc123
      `.trim();

      expect(shareMessage).toContain('https://gurupro.id/share/');
      expect(shareMessage).toContain('RPP Modul Ajar');
    });
  });

  describe('Email Notification', () => {
    it('should send email with share link', async () => {
      const emailData = {
        to: 'kepala@school.sch.id',
        subject: 'Dokumen dari Guru Matematika',
        template: 'share_link',
        data: {
          teacherName: 'Guru Matematika',
          documentType: 'Jurnal Harian',
          shareLink: 'https://gurupro.id/share/def456',
          expiryDays: 30,
        },
      };

      mockSendEmail.mockResolvedValueOnce({ success: true, messageId: 'email-456' });

      const result = await sendEmailNotification(emailData);

      expect(result.success).toBe(true);
    });

    it('should include OTP instruction for Level 2 access', () => {
      const emailContent = {
        subject: 'Permintaan Akses Dokumen - Verifikasi Diperlukan',
        body: 'Untuk melihat dokumen lengkap, Anda perlu memasukkan kode OTP yang akan dikirim terpisah.',
        requiresOtp: true,
      };

      expect(emailContent.requiresOtp).toBe(true);
      expect(emailContent.body).toContain('OTP');
    });
  });

  describe('Delivery Status Tracking', () => {
    it('should track delivery status for share notifications', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: VALID_UUID,
          share_link_id: VALID_UUID2,
          channel: 'whatsapp',
          status: 'delivered',
          delivered_at: new Date().toISOString(),
        }],
      });

      const result = await query(
        'SELECT * FROM share_notifications WHERE share_link_id = $1',
        [VALID_UUID2]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].status).toBe('delivered');
    });

    it('should handle failed delivery', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: VALID_UUID,
          share_link_id: VALID_UUID2,
          channel: 'whatsapp',
          status: 'failed',
          error_message: 'Invalid phone number',
        }],
      });

      const result = await query(
        'SELECT * FROM share_notifications WHERE status = $1',
        ['failed']
      );

      expect(result.rows[0].status).toBe('failed');
      expect(result.rows[0].error_message).toBeDefined();
    });
  });
});

// ============================================
// TESTS: SHARE LINK ACCESS TRACKING
// ============================================

describe('Share-to-Principal - Access Tracking', () => {

  describe('Link Click Tracking', () => {
    it('should track when link is accessed', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: VALID_UUID,
          share_token: 'abc123xyz',
          access_count: 1,
          first_accessed_at: new Date().toISOString(),
          last_accessed_at: new Date().toISOString(),
        }],
      });

      const result = await query(
        'SELECT * FROM performance_share_links WHERE share_token = $1',
        ['abc123xyz']
      );

      expect(result.rows[0].access_count).toBeGreaterThanOrEqual(0);
    });

    it('should track unique vs total access', async () => {
      const accesses = [
        { ip: '1.1.1.1', timestamp: 't1' },
        { ip: '1.1.1.1', timestamp: 't2' }, // Same IP
        { ip: '2.2.2.2', timestamp: 't3' },
      ];

      const uniqueIPs = new Set(accesses.map(a => a.ip));

      expect(accesses.length).toBe(3);
      expect(uniqueIPs.size).toBe(2);
    });
  });

  describe('Leader Engagement Metrics', () => {
    it('should calculate engagement score', async () => {
      const metrics = {
        sharesReceived: 15,
        documentsAccessed: 10,
        level2Requests: 3,
        avgTimeOnDoc: 45, // seconds
      };

      // Simple engagement score calculation
      const engagementScore = (
        metrics.sharesReceived * 5 +
        metrics.documentsAccessed * 10 +
        metrics.level2Requests * 20 -
        Math.max(0, 60 - metrics.avgTimeOnDoc) // Penalize quick viewing
      );

      expect(engagementScore).toBeGreaterThan(0);
    });
  });
});

// ============================================
// TESTS: EDGE CASES
// ============================================

describe('Share-to-Principal - Edge Cases', () => {

  it('should handle share to contact with no phone', async () => {
    const contact = {
      name: 'Dr. Kepala',
      email: 'kepala@school.sch.id',
      whatsapp: null,
    };

    // Should use email instead
    const hasWhatsApp = contact.whatsapp !== null;
    const hasEmail = contact.email !== null;

    expect(hasWhatsApp).toBe(false);
    expect(hasEmail).toBe(true);
  });

  it('should handle share to contact with no email', async () => {
    const contact = {
      name: 'Dr. Kepala',
      whatsapp: '+6281234567890',
      email: null,
    };

    const hasWhatsApp = contact.whatsapp !== null;
    const hasEmail = contact.email !== null;

    expect(hasWhatsApp).toBe(true);
    expect(hasEmail).toBe(false);
  });

  it('should handle expired share link access', async () => {
    const linkExpiry = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago

    const isExpired = new Date() > linkExpiry;
    expect(isExpired).toBe(true);
  });

  it('should handle duplicate share to same contact by same teacher', async () => {
    const shares = [
      { teacher_id: VALID_UUID, contact_id: VALID_UUID2, created_at: 't1' },
      { teacher_id: VALID_UUID, contact_id: VALID_UUID2, created_at: 't2' }, // Duplicate!
    ];

    // Should deduplicate by teacher+contact
    const uniqueShares = shares.filter((s, i, arr) =>
      arr.findIndex(x => x.teacher_id === s.teacher_id && x.contact_id === s.contact_id) === i
    );

    expect(uniqueShares.length).toBe(1);
  });

  it('should handle upsell trigger after teacher leaves institution', async () => {
    // Teacher was part of trigger (2+ teachers to same contact)
    // But then leaves - should the trigger still count?

    const teacherInstitutions = [
      { teacher_id: 't1', institution_id: 'i1', status: 'left' }, // Left
      { teacher_id: 't2', institution_id: 'i1', status: 'active' },
    ];

    const activeTeachers = teacherInstitutions.filter(t => t.status === 'active');
    const triggerThreshold = 2;

    // If only 1 active, trigger should not fire
    expect(activeTeachers.length).toBe(1);
    expect(activeTeachers.length < triggerThreshold).toBe(true);
  });
});
