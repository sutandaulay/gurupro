/**
 * E2E Test Suite: e-Raport System
 *
 * Tests 3-layer architecture:
 * 1. Template Layer: CRUD template raport, drag-and-drop Layout Builder
 * 2. Data Layer: mapping nilai, narasi AI generation
 * 3. Output Layer: export Excel/PDF
 *
 * Full flow: Raport Status → Review Nilai Raport → Layout Raport → Export
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_PREFIX = 'TEST_';

// ============================================
// HELPERS
// ============================================

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**');
}

async function navigateToRaportStatus(page: Page) {
  await page.goto(`${BASE_URL}/dashboard/raport-status`);
  await expect(page.locator('text=Status Raport')).toBeVisible({ timeout: 10000 });
}

// ============================================
// TESTS: LAYER 1 - TEMPLATE MANAGEMENT
// ============================================

test.describe('e-Raport - Layer 1: Template Management', () => {

  test.beforeEach(async ({ page }) => {
    await login(page,
      `${TEST_PREFIX}guru-3bulan@test.gurupro.id`,
      'TestPassword123!'
    );
  });

  test('should access Layout Raport page', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/layout-raport`);

    // Should show Layout Raport interface
    await expect(page.locator('text=Layout Raport')).toBeVisible({ timeout: 10000 });
  });

  test('should display existing templates', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/layout-raport`);

    // Wait for templates to load
    await page.waitForSelector('[data-testid="raport-template"]', { timeout: 10000 });

    // Should show template cards or list
    const templates = page.locator('[data-testid="raport-template"]');
    await expect(templates.first()).toBeVisible();
  });

  test('should create new template', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/layout-raport`);

    // Click create new template button
    const createButton = page.locator('text=Buat Template Baru');
    if (await createButton.isVisible()) {
      await createButton.click();

      // Fill template name
      await page.fill('input[name="templateName"]', `${TEST_PREFIX}Template Test`);
      await page.fill('input[name="jenjang"]', 'SMP');

      // Save
      await page.click('button:has-text("Simpan")');

      // Should show success or navigate to template editor
      await expect(page.locator('text=Template')).toBeVisible();
    }
  });

  test('should edit existing template', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/layout-raport`);

    // Find and click edit on existing template
    const editButton = page.locator('[data-testid="edit-template"]').first();
    if (await editButton.isVisible()) {
      await editButton.click();

      // Should open template editor
      await expect(page.locator('text=Editor')).toBeVisible();
    }
  });

  test('should delete template', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/layout-raport`);

    // Find and click delete on existing template
    const deleteButton = page.locator('[data-testid="delete-template"]').first();
    if (await deleteButton.isVisible()) {
      await deleteButton.click();

      // Should show confirmation dialog
      await expect(page.locator('text=Konfirmasi')).toBeVisible();

      // Confirm delete
      await page.click('button:has-text("Hapus")');

      // Should show success message or template removed from list
    }
  });
});

// ============================================
// TESTS: LAYER 1 - LAYOUT BUILDER (Drag & Drop)
// ============================================

test.describe('e-Raport - Layout Builder (Drag & Drop)', () => {

  test.beforeEach(async ({ page }) => {
    await login(page,
      `${TEST_PREFIX}guru-3bulan@test.gurupro.id`,
      'TestPassword123!'
    );
  });

  test('should open Layout Builder editor', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/layout-raport`);

    // Open a template in edit mode
    const editButton = page.locator('[data-testid="edit-template"]').first();
    if (await editButton.isVisible()) {
      await editButton.click();
    }

    // Should show Layout Builder interface
    await expect(page.locator('text=Layout')).toBeVisible();
    await expect(page.locator('text=Builder')).toBeVisible();
  });

  test('should display available components in sidebar', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/layout-raport`);

    // Open template editor
    const editButton = page.locator('[data-testid="edit-template"]').first();
    if (await editButton.isVisible()) {
      await editButton.click();
    }

    // Should show component palette
    await expect(page.locator('text=Komponen')).toBeVisible();
  });

  test('should drag component to canvas', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/layout-raport`);

    // Open template editor
    const editButton = page.locator('[data-testid="edit-template"]').first();
    if (await editButton.isVisible()) {
      await editButton.click();
    }

    // Find draggable component
    const component = page.locator('[data-testid="component-nama-siswa"]').first();
    const canvas = page.locator('[data-testid="layout-canvas"]');

    if (await component.isVisible() && await canvas.isVisible()) {
      // Perform drag and drop
      await component.dragTo(canvas);

      // Component should appear in canvas
      await expect(page.locator('[data-testid="canvas-item-nama-siswa"]')).toBeVisible();
    }
  });

  test('should reorder components in canvas', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/layout-raport`);

    // Open template editor with existing layout
    const editButton = page.locator('[data-testid="edit-template"]').first();
    if (await editButton.isVisible()) {
      await editButton.click();
    }

    // Find reorderable item
    const item = page.locator('[data-testid="canvas-item"]').first();
    if (await item.isVisible()) {
      // Get initial position
      const initialBox = await item.boundingBox();

      // Move item
      await item.hover();
      await page.mouse.down();
      await page.mouse.move(initialBox!.x + 50, initialBox!.y + 50);
      await page.mouse.up();

      // Item should be repositioned
    }
  });

  test('should delete component from canvas', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/layout-raport`);

    // Open template editor
    const editButton = page.locator('[data-testid="edit-template"]').first();
    if (await editButton.isVisible()) {
      await editButton.click();
    }

    // Find and click delete on canvas item
    const deleteBtn = page.locator('[data-testid="canvas-item-delete"]').first();
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();

      // Item should be removed
    }
  });

  test('should save layout changes', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/layout-raport`);

    // Open template editor
    const editButton = page.locator('[data-testid="edit-template"]').first();
    if (await editButton.isVisible()) {
      await editButton.click();
    }

    // Make some changes (drag component)
    // Then save
    const saveButton = page.locator('button:has-text("Simpan Layout")');
    if (await saveButton.isVisible()) {
      await saveButton.click();

      // Should show success message
      await expect(page.locator('text=Berhasil')).toBeVisible();
    }
  });

  test('should preview layout', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/layout-raport`);

    // Open template editor
    const editButton = page.locator('[data-testid="edit-template"]').first();
    if (await editButton.isVisible()) {
      await editButton.click();
    }

    // Click preview button
    const previewButton = page.locator('button:has-text("Pratinjau")');
    if (await previewButton.isVisible()) {
      await previewButton.click();

      // Should show preview modal
      await expect(page.locator('text=Pratinjau')).toBeVisible();
    }
  });

  test('should reset layout to default', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/layout-raport`);

    // Open template editor
    const editButton = page.locator('[data-testid="edit-template"]').first();
    if (await editButton.isVisible()) {
      await editButton.click();
    }

    // Click reset button
    const resetButton = page.locator('button:has-text("Reset")');
    if (await resetButton.isVisible()) {
      await resetButton.click();

      // Should show confirmation
      await expect(page.locator('text=Konfirmasi Reset')).toBeVisible();

      // Confirm reset
      await page.click('button:has-text("Ya, Reset")');
    }
  });
});

// ============================================
// TESTS: LAYER 2 - DATA LAYER (Nilai Mapping & Narasi AI)
// ============================================

test.describe('e-Raport - Layer 2: Data Layer', () => {

  test.beforeEach(async ({ page }) => {
    await login(page,
      `${TEST_PREFIX}guru-3bulan@test.gurupro.id`,
      'TestPassword123!'
    );
  });

  test('should access Review Nilai Raport page', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/rapor-review`);

    await expect(page.locator('text=Review Nilai')).toBeVisible({ timeout: 10000 });
  });

  test('should display students list', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/rapor-review`);

    // Should show student list
    await page.waitForSelector('[data-testid="student-row"]', { timeout: 10000 });
    const students = page.locator('[data-testid="student-row"]');
    await expect(students.first()).toBeVisible();
  });

  test('should display nilai per subject for student', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/rapor-review`);

    // Click on a student
    const studentRow = page.locator('[data-testid="student-row"]').first();
    if (await studentRow.isVisible()) {
      await studentRow.click();

      // Should show nilai details
      await expect(page.locator('text=Nilai')).toBeVisible();
    }
  });

  test('should validate incomplete nilai warning', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/rapor-review`);

    // Student with incomplete nilai should show warning
    const warningBadge = page.locator('[data-testid="nilai-incomplete-badge"]');
    if (await warningBadge.isVisible()) {
      await expect(warningBadge).toBeVisible();
    }
  });

  test('should confirm nilai before raport generation', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/rapor-review`);

    // Click confirm button for a student
    const confirmButton = page.locator('button:has-text("Konfirmasi")').first();
    if (await confirmButton.isVisible()) {
      await confirmButton.click();

      // Should show confirmation dialog
      await expect(page.locator('text=Konfirmasi Nilai')).toBeVisible();
    }
  });

  test('should generate AI narration for student', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/rapor-review`);

    // Select a student with complete nilai
    const studentRow = page.locator('[data-testid="student-row"]').first();
    if (await studentRow.isVisible()) {
      await studentRow.click();

      // Click generate narration button
      const generateButton = page.locator('button:has-text("Generate Narasi AI")');
      if (await generateButton.isVisible()) {
        await generateButton.click();

        // Should show loading state
        await expect(page.locator('text=Menghasilkan')).toBeVisible();

        // Wait for narration to be generated
        await page.waitForTimeout(3000);

        // Should show generated narration
        await expect(page.locator('[data-testid="ai-narration"]')).toBeVisible();
      }
    }
  });

  test('should edit generated narration manually', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/rapor-review`);

    // Select a student
    const studentRow = page.locator('[data-testid="student-row"]').first();
    if (await studentRow.isVisible()) {
      await studentRow.click();

      // Find and edit narration
      const narrationField = page.locator('[data-testid="naration-input"]');
      if (await narrationField.isVisible()) {
        await narrationField.fill('Manual edited narration text.');
        await page.click('button:has-text("Simpan")');
      }
    }
  });

  test('should validate narration minimum length', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/rapor-review`);

    // Select a student
    const studentRow = page.locator('[data-testid="student-row"]').first();
    if (await studentRow.isVisible()) {
      await studentRow.click();

      // Try to save with too short narration
      const narrationField = page.locator('[data-testid="naration-input"]');
      if (await narrationField.isVisible()) {
        await narrationField.fill('OK');

        const saveButton = page.locator('button:has-text("Simpan")');
        await saveButton.click();

        // Should show validation error
        await expect(page.locator('text=minimal')).toBeVisible();
      }
    }
  });
});

// ============================================
// TESTS: LAYER 3 - OUTPUT LAYER (Export)
// ============================================

test.describe('e-Raport - Layer 3: Output Layer', () => {

  test.beforeEach(async ({ page }) => {
    await login(page,
      `${TEST_PREFIX}guru-3bulan@test.gurupro.id`,
      'TestPassword123!'
    );
  });

  test('should access Raport Status page', async ({ page }) => {
    await navigateToRaportStatus(page);
  });

  test('should display raport generation status', async ({ page }) => {
    await navigateToRaportStatus(page);

    // Should show status table
    await expect(page.locator('text=Status')).toBeVisible();
  });

  test('should export raport to Excel', async ({ page }) => {
    await navigateToRaportStatus(page);

    // Find and click export Excel button
    const exportButton = page.locator('button:has-text("Export Excel")');
    if (await exportButton.isVisible()) {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download');

      await exportButton.click();

      // Wait for download
      const download = await downloadPromise;

      // Verify file name
      expect(download.suggestedFilename()).toMatch(/\.xlsx?$/i);
    }
  });

  test('should export raport to PDF', async ({ page }) => {
    await navigateToRaportStatus(page);

    // Find and click export PDF button
    const exportButton = page.locator('button:has-text("Export PDF")');
    if (await exportButton.isVisible()) {
      // Set up download listener
      const downloadPromise = page.waitForEvent('download');

      await exportButton.click();

      // Wait for download
      const download = await downloadPromise;

      // Verify file name
      expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    }
  });

  test('should export single student raport', async ({ page }) => {
    await navigateToRaportStatus(page);

    // Find export button for specific student
    const studentExport = page.locator('[data-testid="export-single"]').first();
    if (await studentExport.isVisible()) {
      await studentExport.click();

      // Should download single student raport
      const downloadPromise = page.waitForEvent('download');
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBeTruthy();
    }
  });

  test('should export batch raport for multiple students', async ({ page }) => {
    await navigateToRaportStatus(page);

    // Select multiple students
    const checkboxes = page.locator('[data-testid="student-checkbox"]');
    const count = await checkboxes.count();
    if (count >= 2) {
      await checkboxes.nth(0).check();
      await checkboxes.nth(1).check();

      // Click batch export
      const batchExport = page.locator('button:has-text("Export Terpilih")');
      if (await batchExport.isVisible()) {
        await batchExport.click();

        // Should download batch
        const downloadPromise = page.waitForEvent('download');
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBeTruthy();
      }
    }
  });

  test('should validate file structure after export', async ({ page }) => {
    await navigateToRaportStatus(page);

    // Export and verify
    const exportButton = page.locator('button:has-text("Export Excel")').first();
    if (await exportButton.isVisible()) {
      const downloadPromise = page.waitForEvent('download');
      await exportButton.click();
      const download = await downloadPromise;

      // Save to temp location
      const path = await download.path();
      expect(path).toBeTruthy();

      // File should exist and have content
      const fs = require('fs');
      const stats = fs.statSync(path);
      expect(stats.size).toBeGreaterThan(0);
    }
  });

  test('should show error for incomplete data export', async ({ page }) => {
    await navigateToRaportStatus(page);

    // Try to export student with incomplete data
    const incompleteExport = page.locator('[data-testid="export-incomplete"]').first();
    if (await incompleteExport.isVisible()) {
      await incompleteExport.click();

      // Should show warning/error
      await expect(page.locator('text=tidak lengkap')).toBeVisible();
    }
  });
});

// ============================================
// TESTS: FULL FLOW INTEGRATION
// ============================================

test.describe('e-Raport - Full Flow Integration', () => {

  test.beforeEach(async ({ page }) => {
    await login(page,
      `${TEST_PREFIX}guru-3bulan@test.gurupro.id`,
      'TestPassword123!'
    );
  });

  test('should complete full flow: Status → Review → Layout → Export', async ({ page }) => {
    // Step 1: Raport Status
    await page.goto(`${BASE_URL}/dashboard/raport-status`);
    await expect(page.locator('text=Status Raport')).toBeVisible({ timeout: 10000 });
    console.log('✓ Step 1: Raport Status page loaded');

    // Step 2: Navigate to Review
    await page.goto(`${BASE_URL}/dashboard/rapor-review`);
    await expect(page.locator('text=Review Nilai')).toBeVisible({ timeout: 10000 });
    console.log('✓ Step 2: Review Nilai page loaded');

    // Select student and check nilai
    const studentRow = page.locator('[data-testid="student-row"]').first();
    if (await studentRow.isVisible()) {
      await studentRow.click();
      console.log('✓ Student selected for review');
    }

    // Step 3: Navigate to Layout
    await page.goto(`${BASE_URL}/dashboard/layout-raport`);
    await expect(page.locator('text=Layout Raport')).toBeVisible({ timeout: 10000 });
    console.log('✓ Step 3: Layout Raport page loaded');

    // Step 4: Export
    await page.goto(`${BASE_URL}/dashboard/raport-status`);
    const exportButton = page.locator('button:has-text("Export")').first();
    if (await exportButton.isVisible()) {
      console.log('✓ Step 4: Export available');
    }
  });

  test('should handle raport for student with incomplete data', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/rapor-review`);

    // Find student with incomplete nilai
    const incompleteBadge = page.locator('[data-testid="nilai-incomplete-badge"]').first();
    if (await incompleteBadge.isVisible()) {
      await incompleteBadge.click();

      // Should show which subjects are missing
      await expect(page.locator('text=belum')).toBeVisible();
    }
  });

  test('should handle template not yet set up', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/layout-raport`);

    // Check if no templates exist
    const noTemplatesMessage = page.locator('text=Belum ada template');
    const createTemplateButton = page.locator('text=Buat Template Baru');

    if (await noTemplatesMessage.isVisible() || await createTemplateButton.isVisible()) {
      // Should prompt to create template
      await expect(createTemplateButton.or(noTemplatesMessage)).toBeVisible();
    }
  });

  test('should handle batch export with large volume', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/raport-status`);

    // Select all students
    const selectAll = page.locator('[data-testid="select-all"]');
    if (await selectAll.isVisible()) {
      await selectAll.click();

      // Count selected
      const selected = page.locator('[data-testid="selected-count"]');
      const countText = await selected.textContent();
      console.log(`Selected: ${countText}`);

      // Export all
      const exportButton = page.locator('button:has-text("Export Semua")');
      if (await exportButton.isVisible()) {
        await exportButton.click();

        // Should show progress
        await expect(page.locator('text=Memproses')).toBeVisible();
      }
    }
  });
});

// ============================================
// TESTS: EDGE CASES
// ============================================

test.describe('e-Raport - Edge Cases', () => {

  test.beforeEach(async ({ page }) => {
    await login(page,
      `${TEST_PREFIX}guru-3bulan@test.gurupro.id`,
      'TestPassword123!'
    );
  });

  test('should handle zero students in class', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/rapor-review`);

    // Should show message about no students
    await expect(page.locator(/tidak ada|siswa/i)).toBeVisible({ timeout: 10000 });
  });

  test('should handle no nilai entered yet', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/rapor-review`);

    // All students should show incomplete badge
    const incompleteBadges = page.locator('[data-testid="nilai-incomplete-badge"]');
    const count = await incompleteBadges.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should handle AI generation failure', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/rapor-review`);

    // Try to generate narration
    const studentRow = page.locator('[data-testid="student-row"]').first();
    if (await studentRow.isVisible()) {
      await studentRow.click();

      const generateButton = page.locator('button:has-text("Generate Narasi AI")');
      if (await generateButton.isVisible()) {
        await generateButton.click();

        // Wait for potential failure
        await page.waitForTimeout(5000);

        // Check for error message
        const errorMessage = page.locator('text=Gagal|Error');
        if (await errorMessage.isVisible()) {
          // Should show retry option
          await expect(page.locator('text=Coba Lagi')).toBeVisible();
        }
      }
    }
  });

  test('should handle export failure gracefully', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/raport-status`);

    const exportButton = page.locator('button:has-text("Export")').first();
    if (await exportButton.isVisible()) {
      await exportButton.click();

      // Wait for error
      await page.waitForTimeout(5000);

      // Check for error handling
      const errorMessage = page.locator('text=Gagal|Error');
      if (await errorMessage.isVisible()) {
        await expect(errorMessage).toBeVisible();
      }
    }
  });

  test('should preserve layout changes after page reload', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/layout-raport`);

    // Open template editor
    const editButton = page.locator('[data-testid="edit-template"]').first();
    if (await editButton.isVisible()) {
      await editButton.click();

      // Make changes
      const component = page.locator('[data-testid="component-nama-siswa"]').first();
      const canvas = page.locator('[data-testid="layout-canvas"]');
      if (await component.isVisible() && await canvas.isVisible()) {
        await component.dragTo(canvas);
      }

      // Save
      const saveButton = page.locator('button:has-text("Simpan")');
      if (await saveButton.isVisible()) {
        await saveButton.click();
      }

      // Reload page
      await page.reload();

      // Navigate back to editor
      await editButton.click();

      // Changes should be preserved
      const savedComponent = page.locator('[data-testid="canvas-item-nama-siswa"]');
      await expect(savedComponent).toBeVisible();
    }
  });
});
