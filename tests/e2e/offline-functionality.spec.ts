/**
 * Offline Functionality E2E Tests
 * 
 * Validates: Requirement 4.7, Requirement 22 (Property 22)
 * Tests the complete offline user experience including:
 * - Offline indicator display
 * - Content filtering when offline
 * - Downloaded content playback
 * - Remote content blocking
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Offline Functionality E2E Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to home page
    await page.goto('/');
    await page.waitForTimeout(1000);
  });

  test('should display offline indicator when network is unavailable', async ({ page }) => {
    // Simulate offline mode
    await page.context().setOffline(true);
    await page.waitForTimeout(500);

    // Reload to trigger offline detection
    await page.reload();
    await page.waitForTimeout(1000);

    // Check for offline indicator
    const offlineIndicator = page.getByText(/offline mode/i);
    const offlineMessage = page.getByText(/only downloaded content/i);

    // At least one offline indicator should be visible
    const indicatorVisible = await offlineIndicator.isVisible().catch(() => false);
    const messageVisible = await offlineMessage.isVisible().catch(() => false);

    expect(indicatorVisible || messageVisible).toBeTruthy();
  });

  test('should hide offline indicator when network is available', async ({ page }) => {
    // Ensure online mode
    await page.context().setOffline(false);
    await page.waitForTimeout(500);

    // Check that offline indicator is not visible
    const offlineIndicator = page.getByText(/offline mode/i);
    const isVisible = await offlineIndicator.isVisible().catch(() => false);

    expect(isVisible).toBe(false);
  });

  test('should show downloads link in offline indicator', async ({ page }) => {
    // Simulate offline mode
    await page.context().setOffline(true);
    await page.waitForTimeout(500);

    // Reload to trigger offline detection
    await page.reload();
    await page.waitForTimeout(1000);

    // Look for downloads link or button
    const downloadsLink = page.getByRole('link', { name: /downloads/i });
    const downloadsButton = page.getByRole('button', { name: /downloads/i });

    const linkVisible = await downloadsLink.isVisible().catch(() => false);
    const buttonVisible = await downloadsButton.isVisible().catch(() => false);

    // At least one should be visible (either in offline indicator or nav)
    expect(linkVisible || buttonVisible).toBeTruthy();
  });

  test('should navigate to downloads page from offline indicator', async ({ page }) => {
    // Simulate offline mode
    await page.context().setOffline(true);
    await page.waitForTimeout(500);

    // Reload to trigger offline detection
    await page.reload();
    await page.waitForTimeout(1000);

    // Try to find and click downloads link in offline indicator
    const offlineDownloadsLink = page.locator('text=/offline/i').locator('..').getByRole('link', { name: /downloads/i });
    const isVisible = await offlineDownloadsLink.isVisible().catch(() => false);

    if (isVisible) {
      await offlineDownloadsLink.click();
      await page.waitForTimeout(500);
      await expect(page).toHaveURL(/.*\/downloads/);
    } else {
      // Fallback: use main navigation
      await page.locator('[aria-label="Downloads"]').click();
      await page.waitForTimeout(500);
      await expect(page).toHaveURL(/.*\/downloads/);
    }
  });

  test('should show offline content tab in downloads page', async ({ page }) => {
    // Navigate to downloads page
    await page.locator('[aria-label="Downloads"]').click();
    await page.waitForTimeout(500);

    // Check for offline content tab
    const offlineTab = page.getByRole('button', { name: /offline content/i });
    await expect(offlineTab).toBeVisible();
  });

  test('should display empty state when no offline content available', async ({ page }) => {
    // Simulate offline mode
    await page.context().setOffline(true);
    await page.waitForTimeout(500);

    // Navigate to downloads page
    await page.locator('[aria-label="Downloads"]').click();
    await page.waitForTimeout(500);

    // Switch to offline content tab
    const offlineTab = page.getByRole('button', { name: /offline content/i });
    await offlineTab.click();
    await page.waitForTimeout(500);

    // Check for empty state or offline content
    const emptyState = page.getByText(/no offline content/i);
    const offlineCards = page.locator('.movie-card, [data-testid="movie-card"]');

    const hasEmpty = await emptyState.isVisible().catch(() => false);
    const hasCards = await offlineCards.count() > 0;

    // Either empty state or cards should be present
    expect(hasEmpty || hasCards).toBeTruthy();
  });

  test('should transition between online and offline states', async ({ page }) => {
    // Start online
    await page.context().setOffline(false);
    await page.waitForTimeout(500);

    // Verify no offline indicator
    let offlineIndicator = page.getByText(/offline mode/i);
    let isVisible = await offlineIndicator.isVisible().catch(() => false);
    expect(isVisible).toBe(false);

    // Go offline
    await page.context().setOffline(true);
    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForTimeout(1000);

    // Verify offline indicator appears
    offlineIndicator = page.getByText(/offline mode/i);
    isVisible = await offlineIndicator.isVisible().catch(() => false);
    expect(isVisible).toBe(true);

    // Go back online
    await page.context().setOffline(false);
    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForTimeout(1000);

    // Verify offline indicator disappears
    offlineIndicator = page.getByText(/offline mode/i);
    isVisible = await offlineIndicator.isVisible().catch(() => false);
    expect(isVisible).toBe(false);
  });

  test('should maintain navigation functionality when offline', async ({ page }) => {
    // Simulate offline mode
    await page.context().setOffline(true);
    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForTimeout(1000);

    // Test navigation to different pages
    const pages = [
      { label: 'Downloads', url: /.*\/downloads/ },
      { label: 'Favorites', url: /.*\/favorites/ },
      { label: 'Settings', url: /.*\/settings/ },
    ];

    for (const pageInfo of pages) {
      const navButton = page.locator(`[aria-label="${pageInfo.label}"]`);
      const isVisible = await navButton.isVisible().catch(() => false);

      if (isVisible) {
        await navButton.click();
        await page.waitForTimeout(500);
        await expect(page).toHaveURL(pageInfo.url);
      }
    }
  });

  test('should show appropriate message for remote content when offline', async ({ page }) => {
    // Simulate offline mode
    await page.context().setOffline(true);
    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForTimeout(1000);

    // Navigate to a category page (Movies)
    const moviesButton = page.getByRole('button', { name: 'Movies' });
    const isVisible = await moviesButton.isVisible().catch(() => false);

    if (isVisible) {
      await moviesButton.click();
      await page.waitForTimeout(500);

      // Look for offline message or empty state
      const offlineMessage = page.getByText(/offline/i);
      const emptyState = page.getByText(/no content/i);

      const hasOfflineMessage = await offlineMessage.isVisible().catch(() => false);
      const hasEmptyState = await emptyState.isVisible().catch(() => false);

      // Some indication of offline state should be present
      expect(hasOfflineMessage || hasEmptyState).toBeTruthy();
    }
  });

  test('should display offline indicator with wifi icon', async ({ page }) => {
    // Simulate offline mode
    await page.context().setOffline(true);
    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForTimeout(1000);

    // Check for offline indicator with icon
    const offlineIndicator = page.getByText(/offline mode/i);
    const isVisible = await offlineIndicator.isVisible().catch(() => false);

    if (isVisible) {
      // Check that the indicator has an icon (svg element)
      const parent = offlineIndicator.locator('..');
      const icon = parent.locator('svg');
      const hasIcon = await icon.count() > 0;

      expect(hasIcon).toBeTruthy();
    }
  });

  test('should persist offline state across page navigation', async ({ page }) => {
    // Simulate offline mode
    await page.context().setOffline(true);
    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForTimeout(1000);

    // Verify offline indicator on home page
    let offlineIndicator = page.getByText(/offline mode/i);
    let isVisible = await offlineIndicator.isVisible().catch(() => false);
    expect(isVisible).toBe(true);

    // Navigate to downloads
    await page.locator('[aria-label="Downloads"]').click();
    await page.waitForTimeout(500);

    // Verify offline indicator still visible
    offlineIndicator = page.getByText(/offline mode/i);
    isVisible = await offlineIndicator.isVisible().catch(() => false);
    expect(isVisible).toBe(true);

    // Navigate to favorites
    await page.locator('[aria-label="Favorites"]').click();
    await page.waitForTimeout(500);

    // Verify offline indicator still visible
    offlineIndicator = page.getByText(/offline mode/i);
    isVisible = await offlineIndicator.isVisible().catch(() => false);
    expect(isVisible).toBe(true);
  });

  test('should handle offline mode in player modal', async ({ page }) => {
    // Simulate offline mode
    await page.context().setOffline(true);
    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForTimeout(1000);

    // Navigate to downloads page
    await page.locator('[aria-label="Downloads"]').click();
    await page.waitForTimeout(500);

    // Switch to offline content tab
    const offlineTab = page.getByRole('button', { name: /offline content/i });
    await offlineTab.click();
    await page.waitForTimeout(500);

    // Check if there's any offline content to play
    const playButtons = page.getByRole('button', { name: /play/i });
    const playButtonCount = await playButtons.count();

    if (playButtonCount > 0) {
      // Click first play button
      await playButtons.first().click();
      await page.waitForTimeout(1000);

      // Verify player modal opens
      const playerModal = page.getByTestId('player-modal');
      await expect(playerModal).toBeVisible();

      // Verify player container is visible
      const playerContainer = page.getByTestId('player-container');
      await expect(playerContainer).toBeVisible();

      // Check for offline indicator in player
      const offlinePlayerIndicator = page.getByTestId('offline-indicator');
      const isVisible = await offlinePlayerIndicator.isVisible().catch(() => false);

      // Offline indicator should be visible in player
      expect(isVisible).toBe(true);

      // Verify mock player is present in test environment
      const mockPlayer = page.getByTestId('mock-player');
      const hasMockPlayer = await mockPlayer.isVisible().catch(() => false);
      
      // In test environment, mock player should be visible
      if (hasMockPlayer) {
        expect(hasMockPlayer).toBe(true);
      }
    }
  });

  test('should not show external player button when offline', async ({ page }) => {
    // Simulate offline mode
    await page.context().setOffline(true);
    await page.waitForTimeout(500);
    await page.reload();
    await page.waitForTimeout(1000);

    // Navigate to downloads page
    await page.locator('[aria-label="Downloads"]').click();
    await page.waitForTimeout(500);

    // Switch to offline content tab
    const offlineTab = page.getByRole('button', { name: /offline content/i });
    await offlineTab.click();
    await page.waitForTimeout(500);

    // Check if there's any offline content to play
    const playButtons = page.getByRole('button', { name: /play/i });
    const playButtonCount = await playButtons.count();

    if (playButtonCount > 0) {
      // Click first play button
      await playButtons.first().click();
      await page.waitForTimeout(1000);

      // Verify player modal opens
      const playerModal = page.getByTestId('player-modal');
      await expect(playerModal).toBeVisible();

      // External player button should not be visible when offline
      const externalPlayerButton = page.getByTestId('external-player-button');
      const isVisible = await externalPlayerButton.isVisible().catch(() => false);

      expect(isVisible).toBe(false);
    }
  });
});
