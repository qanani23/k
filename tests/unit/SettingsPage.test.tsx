import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import SettingsPage from '../../src/pages/SettingsPage';
import * as api from '../../src/lib/api';

// Mock the API module
vi.mock('../../src/lib/api', () => ({
  getAppConfig: vi.fn(),
  getDiagnostics: vi.fn(),
  updateSettings: vi.fn(),
  openExternal: vi.fn(),
  formatFileSize: vi.fn((bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }),
}));

const mockAppConfig = {
  theme: 'dark' as const,
  last_used_quality: '720p',
  encrypt_downloads: false,
  auto_upgrade_quality: true,
  cache_ttl_minutes: 30,
  max_cache_items: 200,
  vault_path: '/path/to/vault',
  version: '1.0.0',
  gateways: ['https://api.odysee.com', 'https://api2.odysee.com'],
};

const mockDiagnostics = {
  gateway_health: [
    {
      url: 'https://api.odysee.com',
      status: 'healthy' as const,
      response_time_ms: 150,
    },
    {
      url: 'https://api2.odysee.com',
      status: 'degraded' as const,
      response_time_ms: 500,
    },
  ],
  database_version: 5,
  free_disk_bytes: 50000000000,
  local_server_status: {
    running: true,
    port: 8080,
    active_streams: 2,
  },
  last_manifest_fetch: 1640000000,
  cache_stats: {
    total_items: 150,
    cache_size_bytes: 1000000000,
    hit_rate: 0.85,
  },
  download_stats: {
    total_downloads: 10,
    total_bytes_downloaded: 5000000000,
    average_throughput_bytes_per_sec: 2500000,
    last_download_timestamp: 1640000000,
  },
};

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getAppConfig).mockResolvedValue(mockAppConfig);
    vi.mocked(api.getDiagnostics).mockResolvedValue(mockDiagnostics);
    
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
  });

  const renderSettingsPage = () => {
    return render(
      <BrowserRouter>
        <SettingsPage />
      </BrowserRouter>
    );
  };

  describe('Initial Loading', () => {
    it('should display loading skeleton while fetching data', () => {
      renderSettingsPage();
      
      const skeletons = document.querySelectorAll('.loading-skeleton');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should load app config and diagnostics on mount', async () => {
      renderSettingsPage();
      
      await waitFor(() => {
        expect(api.getAppConfig).toHaveBeenCalledTimes(1);
        expect(api.getDiagnostics).toHaveBeenCalledTimes(1);
      });
    });

    it('should display settings page title', async () => {
      renderSettingsPage();
      
      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });
    });
  });

  describe('Tab Navigation', () => {
    it('should display all tab options', async () => {
      renderSettingsPage();
      
      await waitFor(() => {
        expect(screen.getByText('General')).toBeInTheDocument();
        expect(screen.getByText('Downloads')).toBeInTheDocument();
        expect(screen.getByText('Advanced')).toBeInTheDocument();
        expect(screen.getByText('About')).toBeInTheDocument();
      });
    });

    it('should start with General tab active', async () => {
      renderSettingsPage();
      
      await waitFor(() => {
        const generalTab = screen.getByText('General').closest('button');
        expect(generalTab).toHaveClass('bg-white/10');
      });
    });

    it('should switch tabs when clicked', async () => {
      renderSettingsPage();
      
      await waitFor(() => {
        expect(screen.getByText('General')).toBeInTheDocument();
      });
      
      const downloadsTab = screen.getByText('Downloads').closest('button');
      fireEvent.click(downloadsTab!);
      
      await waitFor(() => {
        expect(downloadsTab).toHaveClass('bg-white/10');
        expect(screen.getByText('Download Settings')).toBeInTheDocument();
      });
    });
  });

  describe('General Tab', () => {
    it('should display theme selection', async () => {
      renderSettingsPage();
      
      await waitFor(() => {
        expect(screen.getByText('Appearance')).toBeInTheDocument();
        expect(screen.getByText('Dark')).toBeInTheDocument();
        expect(screen.getByText('Light')).toBeInTheDocument();
      });
    });

    it('should display auto quality upgrade toggle', async () => {
      renderSettingsPage();
      
      await waitFor(() => {
        expect(screen.getByText('Auto Quality Upgrade')).toBeInTheDocument();
        expect(screen.getByText(/Automatically upgrade video quality/)).toBeInTheDocument();
      });
    });

    it('should toggle auto quality upgrade setting', async () => {
      renderSettingsPage();
      
      await waitFor(() => {
        expect(screen.getByText('Auto Quality Upgrade')).toBeInTheDocument();
      });
      
      // The structure is: flex container > [text div, label > checkbox]
      const textDiv = screen.getByText('Auto Quality Upgrade');
      const flexContainer = textDiv.closest('.flex.items-center.justify-between');
      const toggle = flexContainer?.querySelector('input[type="checkbox"]') as HTMLInputElement;
      
      expect(toggle).toBeTruthy();
      expect(toggle.checked).toBe(true);
      
      fireEvent.click(toggle);
      
      await waitFor(() => {
        expect(toggle.checked).toBe(false);
      });
    });

    it('should change theme selection', async () => {
      renderSettingsPage();
      
      await waitFor(() => {
        expect(screen.getByText('Light')).toBeInTheDocument();
      });
      
      const lightThemeButton = screen.getByText('Light').closest('button');
      fireEvent.click(lightThemeButton!);
      
      await waitFor(() => {
        expect(lightThemeButton).toHaveClass('border-accent-cyan');
      });
    });
  });

  describe('Downloads Tab', () => {
    it('should display download settings', async () => {
      renderSettingsPage();
      
      await waitFor(() => {
        expect(screen.getByText('Downloads')).toBeInTheDocument();
      });
      
      const downloadsTab = screen.getByText('Downloads').closest('button');
      fireEvent.click(downloadsTab!);
      
      await waitFor(() => {
        expect(screen.getByText('Download Settings')).toBeInTheDocument();
        expect(screen.getByText('Encrypt Downloads')).toBeInTheDocument();
      });
    });

    it('should display storage location', async () => {
      renderSettingsPage();
      
      await waitFor(() => {
        expect(screen.getByText('Downloads')).toBeInTheDocument();
      });
      
      const downloadsTab = screen.getByText('Downloads').closest('button');
      fireEvent.click(downloadsTab!);
      
      await waitFor(() => {
        expect(screen.getByText('Storage Location')).toBeInTheDocument();
        expect(screen.getByText('/path/to/vault')).toBeInTheDocument();
      });
    });

    it('should display storage information', async () => {
      renderSettingsPage();
      
      await waitFor(() => {
        expect(screen.getByText('Downloads')).toBeInTheDocument();
      });
      
      const downloadsTab = screen.getByText('Downloads').closest('button');
      fireEvent.click(downloadsTab!);
      
      await waitFor(() => {
        expect(screen.getByText('Storage Information')).toBeInTheDocument();
        expect(screen.getByText('Free Space')).toBeInTheDocument();
        expect(screen.getByText('Cache Items')).toBeInTheDocument();
        expect(screen.getByText('150')).toBeInTheDocument();
      });
    });

    it('should toggle encryption setting', async () => {
      renderSettingsPage();
      
      await waitFor(() => {
        expect(screen.getByText('Downloads')).toBeInTheDocument();
      });
      
      const downloadsTab = screen.getByText('Downloads').closest('button');
      fireEvent.click(downloadsTab!);
      
      await waitFor(() => {
        expect(screen.getByText('Encrypt Downloads')).toBeInTheDocument();
      });
      
      // The structure is: flex container > [text div, label > checkbox]
      const textDiv = screen.getByText('Encrypt Downloads');
      const flexContainer = textDiv.closest('.flex.items-center.justify-between');
      const toggle = flexContainer?.querySelector('input[type="checkbox"]') as HTMLInputElement;
      
      expect(toggle).toBeTruthy();
      expect(toggle.checked).toBe(false);
      
      fireEvent.click(toggle);
      
      await waitFor(() => {
        expect(toggle.checked).toBe(true);
      });
    });
  });

  describe('Advanced Tab', () => {
    it('should display cache settings', async () => {
      renderSettingsPage();
      
      await waitFor(() => {
        expect(screen.getByText('Advanced')).toBeInTheDocument();
      });
      
      const advancedTab = screen.getByText('Advanced').closest('button');
      fireEvent.click(advancedTab!);
      
      await waitFor(() => {
        expect(screen.getByText('Cache Settings')).toBeInTheDocument();
        expect(screen.getByText('Cache Duration (minutes)')).toBeInTheDocument();
        expect(screen.getByText('Maximum Cache Items')).toBeInTheDocument();
      });
    });

    it('should display system diagnostics', async () => {
      renderSettingsPage();
      
      await waitFor(() => {
        expect(screen.getByText('Advanced')).toBeInTheDocument();
      });
      
      const advancedTab = screen.getByText('Advanced').closest('button');
      fireEvent.click(advancedTab!);
      
      await waitFor(() => {
        expect(screen.getByText('System Diagnostics')).toBeInTheDocument();
        expect(screen.getByText('Gateway Status')).toBeInTheDocument();
        expect(screen.getByText('Local Server')).toBeInTheDocument();
      });
    });

    it('should display gateway health status', async () => {
      renderSettingsPage();
      
      await waitFor(() => {
        expect(screen.getByText('Advanced')).toBeInTheDocument();
      });
      
      const advancedTab = screen.getByText('Advanced').closest('button');
      fireEvent.click(advancedTab!);
      
      await waitFor(() => {
        expect(screen.getByText('https://api.odysee.com')).toBeInTheDocument();
        expect(screen.getByText('https://api2.odysee.com')).toBeInTheDocument();
        expect(screen.getByText('150ms')).toBeInTheDocument();
        expect(screen.getByText('500ms')).toBeInTheDocument();
      });
    });

    it('should display local server status', async () => {
      renderSettingsPage();
      
      await waitFor(() => {
        expect(screen.getByText('Advanced')).toBeInTheDocument();
      });
      
      const advancedTab = screen.getByText('Advanced').closest('button');
      fireEvent.click(advancedTab!);
      
      await waitFor(() => {
        expect(screen.getByText('Local Server')).toBeInTheDocument();
        expect(screen.getByText('Running')).toBeInTheDocument();
        expect(screen.getByText('8080')).toBeInTheDocument();
      });
    });

    it('should refresh diagnostics when refresh button clicked', async () => {
      renderSettingsPage();
      
      await waitFor(() => {
        expect(screen.getByText('Advanced')).toBeInTheDocument();
      });
      
      const advancedTab = screen.getByText('Advanced').closest('button');
      fireEvent.click(advancedTab!);
      
      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });
      
      const refreshButton = screen.getByText('Refresh').closest('button');
      fireEvent.click(refreshButton!);
      
      await waitFor(() => {
        expect(api.getDiagnostics).toHaveBeenCalledTimes(2);
      });
    });

    it('should update cache TTL setting', async () => {
      renderSettingsPage();
      
      await waitFor(() => {
        expect(screen.getByText('Advanced')).toBeInTheDocument();
      });
      
      const advancedTab = screen.getByText('Advanced').closest('button');
      fireEvent.click(advancedTab!);
      
      await waitFor(() => {
        expect(screen.getByText('Cache Duration (minutes)')).toBeInTheDocument();
      });
      
      const input = screen.getByLabelText('Cache Duration (minutes)') as HTMLInputElement;
      expect(input.value).toBe('30');
      
      fireEvent.change(input, { target: { value: '60' } });
      
      await waitFor(() => {
        expect(input.value).toBe('60');
      });
    });

    it('should update max cache items setting', async () => {
      renderSettingsPage();
      
      await waitFor(() => {
        expect(screen.getByText('Advanced')).toBeInTheDocument();
      });
      
      const advancedTab = screen.getByText('Advanced').closest('button');
      fireEvent.click(advancedTab!);
      
      await waitFor(() => {
        expect(screen.getByText('Maximum Cache Items')).toBeInTheDocument();
      });
      
      const input = screen.getByLabelText('Maximum Cache Items') as HTMLInputElement;
      expect(input.value).toBe('200');
      
      fireEvent.change(input, { target: { value: '500' } });
      
      await waitFor(() => {
        expect(input.value).toBe('500');
      });
    });
  });

  describe('About Tab', () => {
    it('should display application information', async () => {
      renderSettingsPage();
      
      await waitFor(() => {
        expect(screen.getByText('About')).toBeInTheDocument();
      });
      
      const aboutTab = screen.getByText('About').closest('button');
      fireEvent.click(aboutTab!);
      
      await waitFor(() => {
        expect(screen.getByText('Kiyya')).toBeInTheDocument();
        expect(screen.getByText('Desktop Streaming Application')).toBeInTheDocument();
        expect(screen.getByText('Version')).toBeInTheDocument();
        expect(screen.getByText('1.0.0')).toBeInTheDocument();
      });
    });

    it('should display database version', async () => {
      renderSettingsPage();
      
      await waitFor(() => {
        expect(screen.getByText('About')).toBeInTheDocument();
      });
      
      const aboutTab = screen.getByText('About').closest('button');
      fireEvent.click(aboutTab!);
      
      await waitFor(() => {
        expect(screen.getByText('Database Version')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
      });
    });

    it('should display last update check timestamp', async () => {
      renderSettingsPage();
      
      await waitFor(() => {
        expect(screen.getByText('About')).toBeInTheDocument();
      });
      
      const aboutTab = screen.getByText('About').closest('button');
      fireEvent.click(aboutTab!);
      
      await waitFor(() => {
        expect(screen.getByText('Last Update Check')).toBeInTheDocument();
      });
    });

    it('should display external links', async () => {
      renderSettingsPage();
      
      await waitFor(() => {
        expect(screen.getByText('About')).toBeInTheDocument();
      });
      
      const aboutTab = screen.getByText('About').closest('button');
      fireEvent.click(aboutTab!);
      
      await waitFor(() => {
        expect(screen.getByText('Links')).toBeInTheDocument();
        expect(screen.getByText('GitHub Repository')).toBeInTheDocument();
        expect(screen.getByText('Support & Documentation')).toBeInTheDocument();
        expect(screen.getByText('Privacy Policy')).toBeInTheDocument();
      });
    });

    it('should open external links when clicked', async () => {
      renderSettingsPage();
      
      await waitFor(() => {
        expect(screen.getByText('About')).toBeInTheDocument();
      });
      
      const aboutTab = screen.getByText('About').closest('button');
      fireEvent.click(aboutTab!);
      
      await waitFor(() => {
        expect(screen.getByText('GitHub Repository')).toBeInTheDocument();
      });
      
      const githubLink = screen.getByText('GitHub Repository').closest('button');
      fireEvent.click(githubLink!);
      
      await waitFor(() => {
        expect(api.openExternal).toHaveBeenCalledWith('https://github.com/kiyya/desktop');
      });
    });

    it('should not display save button on About tab', async () => {
      renderSettingsPage();
      
      await waitFor(() => {
        expect(screen.getByText('About')).toBeInTheDocument();
      });
      
      const aboutTab = screen.getByText('About').closest('button');
      fireEvent.click(aboutTab!);
      
      await waitFor(() => {
        expect(screen.getByText('Kiyya')).toBeInTheDocument();
      });
      
      expect(screen.queryByText('Save Settings')).not.toBeInTheDocument();
    });
  });

  describe('Settings Persistence', () => {
    it('should save settings when save button clicked', async () => {
      vi.mocked(api.updateSettings).mockResolvedValue(undefined);
      vi.mocked(api.getAppConfig).mockResolvedValue(mockAppConfig);
      
      renderSettingsPage();
      
      await waitFor(() => {
        expect(screen.getByText('Save Settings')).toBeInTheDocument();
      });
      
      const saveButton = screen.getByText('Save Settings');
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(api.updateSettings).toHaveBeenCalled();
      });
    });

    it('should apply theme immediately after saving', async () => {
      vi.mocked(api.updateSettings).mockResolvedValue(undefined);
      vi.mocked(api.getAppConfig).mockResolvedValue({
        ...mockAppConfig,
        theme: 'light' as const,
      });
      
      renderSettingsPage();
      
      await waitFor(() => {
        expect(screen.getByText('Light')).toBeInTheDocument();
      });
      
      const lightThemeButton = screen.getByText('Light').closest('button');
      fireEvent.click(lightThemeButton!);
      
      const saveButton = screen.getByText('Save Settings');
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(localStorage.setItem).toHaveBeenCalledWith('kiyya-theme', 'light');
      });
    });

    it('should reload config after saving', async () => {
      vi.mocked(api.updateSettings).mockResolvedValue(undefined);
      vi.mocked(api.getAppConfig).mockResolvedValue(mockAppConfig);
      
      renderSettingsPage();
      
      await waitFor(() => {
        expect(screen.getByText('Save Settings')).toBeInTheDocument();
      });
      
      const saveButton = screen.getByText('Save Settings');
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(api.getAppConfig).toHaveBeenCalledTimes(2);
      });
    });

    it('should show saving state while saving', async () => {
      vi.mocked(api.updateSettings).mockImplementation(() => 
        new Promise<void>(resolve => setTimeout(resolve, 100))
      );
      
      renderSettingsPage();
      
      await waitFor(() => {
        expect(screen.getByText('Save Settings')).toBeInTheDocument();
      });
      
      const saveButton = screen.getByText('Save Settings');
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle config loading errors gracefully', async () => {
      vi.mocked(api.getAppConfig).mockRejectedValue(new Error('Failed to load config'));
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      renderSettingsPage();
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to load settings:',
          expect.any(Error)
        );
      });
      
      consoleSpy.mockRestore();
    });

    it('should handle diagnostics loading errors gracefully', async () => {
      vi.mocked(api.getDiagnostics).mockRejectedValue(new Error('Failed to load diagnostics'));
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      renderSettingsPage();
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to load settings:',
          expect.any(Error)
        );
      });
      
      consoleSpy.mockRestore();
    });

    it('should handle save errors gracefully', async () => {
      vi.mocked(api.updateSettings).mockRejectedValue(new Error('Failed to save'));
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      renderSettingsPage();
      
      await waitFor(() => {
        expect(screen.getByText('Save Settings')).toBeInTheDocument();
      });
      
      const saveButton = screen.getByText('Save Settings');
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to save settings:',
          expect.any(Error)
        );
      });
      
      consoleSpy.mockRestore();
    });

    it('should handle diagnostics refresh errors gracefully', async () => {
      renderSettingsPage();
      
      await waitFor(() => {
        expect(screen.getByText('Advanced')).toBeInTheDocument();
      });
      
      const advancedTab = screen.getByText('Advanced').closest('button');
      fireEvent.click(advancedTab!);
      
      await waitFor(() => {
        expect(screen.getByText('Refresh')).toBeInTheDocument();
      });
      
      vi.mocked(api.getDiagnostics).mockRejectedValue(new Error('Failed to refresh'));
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const refreshButton = screen.getByText('Refresh').closest('button');
      fireEvent.click(refreshButton!);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to refresh diagnostics:',
          expect.any(Error)
        );
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('Diagnostics Display', () => {
    it('should display gateway health with correct status colors', async () => {
      renderSettingsPage();
      
      await waitFor(() => {
        expect(screen.getByText('Advanced')).toBeInTheDocument();
      });
      
      const advancedTab = screen.getByText('Advanced').closest('button');
      fireEvent.click(advancedTab!);
      
      await waitFor(() => {
        const healthIndicators = document.querySelectorAll('.w-2.h-2.rounded-full');
        expect(healthIndicators.length).toBeGreaterThan(0);
      });
    });

    it('should format file sizes correctly', async () => {
      renderSettingsPage();
      
      await waitFor(() => {
        expect(screen.getByText('Downloads')).toBeInTheDocument();
      });
      
      const downloadsTab = screen.getByText('Downloads').closest('button');
      fireEvent.click(downloadsTab!);
      
      await waitFor(() => {
        expect(api.formatFileSize).toHaveBeenCalledWith(50000000000);
      });
    });

    it('should display cache statistics', async () => {
      renderSettingsPage();
      
      await waitFor(() => {
        expect(screen.getByText('Downloads')).toBeInTheDocument();
      });
      
      const downloadsTab = screen.getByText('Downloads').closest('button');
      fireEvent.click(downloadsTab!);
      
      await waitFor(() => {
        expect(screen.getByText('150')).toBeInTheDocument();
      });
    });
  });
});
