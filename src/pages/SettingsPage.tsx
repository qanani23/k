import { useState, useEffect } from 'react';
import { 
  Settings, 
  Moon, 
  Sun, 
  Shield, 
  HardDrive, 
  Info, 
  Download,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { AppConfig, DiagnosticsData } from '../types';
import { getAppConfig, updateSettings, getDiagnostics, openExternal } from '../lib/api';
import { formatFileSize } from '../lib/api';

interface SettingsForm {
  theme: 'dark' | 'light';
  encrypt_downloads: boolean;
  auto_upgrade_quality: boolean;
  cache_ttl_minutes: number;
  max_cache_items: number;
}

export default function SettingsPage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const [settings, setSettings] = useState<SettingsForm>({
    theme: 'dark',
    encrypt_downloads: false,
    auto_upgrade_quality: true,
    cache_ttl_minutes: 30,
    max_cache_items: 200,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'downloads' | 'advanced' | 'about'>('general');

  // Load configuration and diagnostics
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        const [configData, diagnosticsData] = await Promise.all([
          getAppConfig(),
          getDiagnostics()
        ]);
        
        setConfig(configData);
        setDiagnostics(diagnosticsData);
        
        setSettings({
          theme: configData.theme as 'dark' | 'light',
          encrypt_downloads: configData.encrypt_downloads,
          auto_upgrade_quality: configData.auto_upgrade_quality,
          cache_ttl_minutes: configData.cache_ttl_minutes,
          max_cache_items: configData.max_cache_items,
        });
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Handle settings change
  const handleSettingChange = (key: keyof SettingsForm, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  // Save settings
  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      
      const settingsToSave = {
        theme: settings.theme,
        encrypt_downloads: settings.encrypt_downloads.toString(),
        auto_upgrade_quality: settings.auto_upgrade_quality.toString(),
        cache_ttl_minutes: settings.cache_ttl_minutes.toString(),
        max_cache_items: settings.max_cache_items.toString(),
      };
      
      await updateSettings(settingsToSave);
      
      // Apply theme immediately
      document.documentElement.className = settings.theme;
      localStorage.setItem('kiyya-theme', settings.theme);
      
      // Reload config to reflect changes
      const newConfig = await getAppConfig();
      setConfig(newConfig);
      
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  // Refresh diagnostics
  const handleRefreshDiagnostics = async () => {
    try {
      const diagnosticsData = await getDiagnostics();
      setDiagnostics(diagnosticsData);
    } catch (error) {
      console.error('Failed to refresh diagnostics:', error);
    }
  };

  // Open external links
  const handleOpenExternal = (url: string) => {
    openExternal(url);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="loading-skeleton h-8 w-48 rounded mb-8"></div>
        <div className="glass rounded-xl p-6">
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="loading-skeleton h-12 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-text-primary mb-2">Settings</h1>
        <p className="text-text-secondary">
          Customize your Kiyya experience
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-8 bg-white/5 rounded-lg p-1">
        {[
          { key: 'general', label: 'General', icon: Settings },
          { key: 'downloads', label: 'Downloads', icon: Download },
          { key: 'advanced', label: 'Advanced', icon: Shield },
          { key: 'about', label: 'About', icon: Info },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-white/10 text-text-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            aria-label={`View ${label} settings`}
            aria-pressed={activeTab === key}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* General Tab */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          <div className="glass rounded-xl p-6">
            <h3 className="text-lg font-medium text-text-primary mb-4">Appearance</h3>
            
            {/* Theme Selection */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-3">
                  Theme
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleSettingChange('theme', 'dark')}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-colors ${
                      settings.theme === 'dark'
                        ? 'border-accent-cyan bg-accent-cyan/10'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                    aria-label="Select dark theme"
                    aria-pressed={settings.theme === 'dark'}
                  >
                    <Moon className="w-5 h-5" />
                    <div className="text-left">
                      <div className="font-medium">Dark</div>
                      <div className="text-sm text-text-secondary">Easy on the eyes</div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => handleSettingChange('theme', 'light')}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-colors ${
                      settings.theme === 'light'
                        ? 'border-accent-cyan bg-accent-cyan/10'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                    aria-label="Select light theme"
                    aria-pressed={settings.theme === 'light'}
                  >
                    <Sun className="w-5 h-5" />
                    <div className="text-left">
                      <div className="font-medium">Light</div>
                      <div className="text-sm text-text-secondary">Bright and clean</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Video Playback */}
          <div className="glass rounded-xl p-6">
            <h3 className="text-lg font-medium text-text-primary mb-4">Video Playback</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-text-primary">Auto Quality Upgrade</div>
                  <div className="text-sm text-text-secondary">
                    Automatically upgrade video quality when network improves
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.auto_upgrade_quality}
                    onChange={(e) => handleSettingChange('auto_upgrade_quality', e.target.checked)}
                    className="sr-only peer"
                    aria-label="Auto quality upgrade"
                  />
                  <div className="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-cyan"></div>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Downloads Tab */}
      {activeTab === 'downloads' && (
        <div className="space-y-6">
          <div className="glass rounded-xl p-6">
            <h3 className="text-lg font-medium text-text-primary mb-4">Download Settings</h3>
            
            <div className="space-y-6">
              {/* Encryption */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-text-primary">Encrypt Downloads</div>
                  <div className="text-sm text-text-secondary">
                    Encrypt downloaded files for additional security
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.encrypt_downloads}
                    onChange={(e) => handleSettingChange('encrypt_downloads', e.target.checked)}
                    className="sr-only peer"
                    aria-label="Encrypt downloads"
                  />
                  <div className="w-11 h-6 bg-white/20 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-cyan"></div>
                </label>
              </div>

              {/* Storage Location */}
              <div>
                <div className="font-medium text-text-primary mb-2">Storage Location</div>
                <div className="bg-white/5 rounded-lg p-3 text-sm text-text-secondary font-mono">
                  {config?.vault_path}
                </div>
              </div>
            </div>
          </div>

          {/* Storage Info */}
          {diagnostics && (
            <div className="glass rounded-xl p-6">
              <h3 className="text-lg font-medium text-text-primary mb-4">Storage Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <HardDrive className="w-5 h-5 text-blue-400" />
                    <span className="font-medium">Free Space</span>
                  </div>
                  <div className="text-2xl font-bold text-text-primary">
                    {formatFileSize(diagnostics.free_disk_bytes)}
                  </div>
                </div>
                
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Download className="w-5 h-5 text-green-400" />
                    <span className="font-medium">Cache Items</span>
                  </div>
                  <div className="text-2xl font-bold text-text-primary">
                    {diagnostics.cache_stats.total_items}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Advanced Tab */}
      {activeTab === 'advanced' && (
        <div className="space-y-6">
          <div className="glass rounded-xl p-6">
            <h3 className="text-lg font-medium text-text-primary mb-4">Cache Settings</h3>
            
            <div className="space-y-6">
              {/* Cache TTL */}
              <div>
                <label htmlFor="cache-ttl" className="block text-sm font-medium text-text-primary mb-2">
                  Cache Duration (minutes)
                </label>
                <input
                  id="cache-ttl"
                  type="number"
                  min="5"
                  max="1440"
                  value={settings.cache_ttl_minutes}
                  onChange={(e) => handleSettingChange('cache_ttl_minutes', parseInt(e.target.value))}
                  className="search-input w-32"
                />
                <p className="text-sm text-text-secondary mt-1">
                  How long to keep content in cache before refreshing
                </p>
              </div>

              {/* Max Cache Items */}
              <div>
                <label htmlFor="max-cache-items" className="block text-sm font-medium text-text-primary mb-2">
                  Maximum Cache Items
                </label>
                <input
                  id="max-cache-items"
                  type="number"
                  min="50"
                  max="1000"
                  value={settings.max_cache_items}
                  onChange={(e) => handleSettingChange('max_cache_items', parseInt(e.target.value))}
                  className="search-input w-32"
                />
                <p className="text-sm text-text-secondary mt-1">
                  Maximum number of items to keep in cache
                </p>
              </div>
            </div>
          </div>

          {/* Diagnostics */}
          {diagnostics && (
            <div className="glass rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-text-primary">System Diagnostics</h3>
                <button
                  onClick={handleRefreshDiagnostics}
                  className="btn-ghost flex items-center gap-2"
                  aria-label="Refresh diagnostics"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Gateway Health */}
                <div>
                  <h4 className="font-medium text-text-primary mb-2">Gateway Status</h4>
                  <div className="space-y-2">
                    {diagnostics.gateway_health.map((gateway, index) => (
                      <div key={index} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${
                            gateway.status === 'healthy' ? 'bg-green-400' :
                            gateway.status === 'degraded' ? 'bg-yellow-400' : 'bg-red-400'
                          }`} />
                          <span className="text-sm font-mono">{gateway.url}</span>
                        </div>
                        <div className="text-sm text-text-secondary">
                          {gateway.response_time_ms && `${gateway.response_time_ms}ms`}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Server Status */}
                <div>
                  <h4 className="font-medium text-text-primary mb-2">Local Server</h4>
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span>Status</span>
                      <span className={`text-sm ${
                        diagnostics.local_server_status.running ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {diagnostics.local_server_status.running ? 'Running' : 'Stopped'}
                      </span>
                    </div>
                    {diagnostics.local_server_status.port && (
                      <div className="flex items-center justify-between mt-2">
                        <span>Port</span>
                        <span className="text-sm text-text-secondary">
                          {diagnostics.local_server_status.port}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cache Performance */}
                <div>
                  <h4 className="font-medium text-text-primary mb-2">Cache Performance</h4>
                  <div className="bg-white/5 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span>Total Items</span>
                      <span className="text-sm text-text-secondary">
                        {diagnostics.cache_stats.total_items}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Cache Size</span>
                      <span className="text-sm text-text-secondary">
                        {formatFileSize(diagnostics.cache_stats.cache_size_bytes)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Hit Rate</span>
                      <span className={`text-sm font-medium ${
                        diagnostics.cache_stats.hit_rate >= 0.8 ? 'text-green-400' :
                        diagnostics.cache_stats.hit_rate >= 0.5 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {(diagnostics.cache_stats.hit_rate * 100).toFixed(1)}%
                      </span>
                    </div>
                    {diagnostics.cache_stats.last_cleanup && (
                      <div className="flex items-center justify-between">
                        <span>Last Cleanup</span>
                        <span className="text-sm text-text-secondary">
                          {new Date(diagnostics.cache_stats.last_cleanup * 1000).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Download Statistics */}
                <div>
                  <h4 className="font-medium text-text-primary mb-2">Download Statistics</h4>
                  <div className="bg-white/5 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span>Total Downloads</span>
                      <span className="text-sm text-text-secondary">
                        {diagnostics.download_stats.total_downloads}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Total Downloaded</span>
                      <span className="text-sm text-text-secondary">
                        {formatFileSize(diagnostics.download_stats.total_bytes_downloaded)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Avg Throughput</span>
                      <span className="text-sm text-text-secondary">
                        {(diagnostics.download_stats.average_throughput_bytes_per_sec / (1024 * 1024)).toFixed(2)} MB/s
                      </span>
                    </div>
                    {diagnostics.download_stats.last_download_timestamp && (
                      <div className="flex items-center justify-between">
                        <span>Last Download</span>
                        <span className="text-sm text-text-secondary">
                          {new Date(diagnostics.download_stats.last_download_timestamp * 1000).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* About Tab */}
      {activeTab === 'about' && (
        <div className="space-y-6">
          <div className="glass rounded-xl p-6">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-gradient mb-2">Kiyya</h2>
              <p className="text-text-secondary">Desktop Streaming Application</p>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Version</span>
                <span className="font-mono text-text-secondary">{config?.version}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span>Database Version</span>
                <span className="font-mono text-text-secondary">{diagnostics?.database_version}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span>Last Update Check</span>
                <span className="text-text-secondary">
                  {diagnostics?.last_manifest_fetch 
                    ? new Date(diagnostics.last_manifest_fetch * 1000).toLocaleString()
                    : 'Never'
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="glass rounded-xl p-6">
            <h3 className="text-lg font-medium text-text-primary mb-4">Links</h3>
            
            <div className="space-y-3">
              <button
                onClick={() => handleOpenExternal('https://github.com/kiyya/desktop')}
                className="flex items-center justify-between w-full p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Open GitHub repository in external browser"
              >
                <span>GitHub Repository</span>
                <ExternalLink className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => handleOpenExternal('https://kiyya.app/support')}
                className="flex items-center justify-between w-full p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Open support and documentation in external browser"
              >
                <span>Support & Documentation</span>
                <ExternalLink className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => handleOpenExternal('https://kiyya.app/privacy')}
                className="flex items-center justify-between w-full p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Open privacy policy in external browser"
              >
                <span>Privacy Policy</span>
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      {activeTab !== 'about' && (
        <div className="flex justify-end">
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="btn-primary"
            aria-label="Save settings"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      )}
    </div>
  );
}