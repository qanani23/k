import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import OfflineIndicator from '../../src/components/OfflineIndicator';
import * as useOfflineModule from '../../src/hooks/useOffline';

vi.mock('../../src/hooks/useOffline');

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('OfflineIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when online', () => {
    vi.spyOn(useOfflineModule, 'useOffline').mockReturnValue({
      isOnline: true,
      isOffline: false,
      wasOffline: false,
      checkOnlineStatus: () => true,
    });

    const { container } = renderWithRouter(<OfflineIndicator />);
    expect(container.firstChild).toBeNull();
  });

  it('should render when offline', () => {
    vi.spyOn(useOfflineModule, 'useOffline').mockReturnValue({
      isOnline: false,
      isOffline: true,
      wasOffline: true,
      checkOnlineStatus: () => false,
    });

    renderWithRouter(<OfflineIndicator />);
    expect(screen.getByText(/Offline Mode/i)).toBeInTheDocument();
    expect(screen.getByText(/Only downloaded content is available/i)).toBeInTheDocument();
  });

  it('should show downloads link when enabled', () => {
    vi.spyOn(useOfflineModule, 'useOffline').mockReturnValue({
      isOnline: false,
      isOffline: true,
      wasOffline: true,
      checkOnlineStatus: () => false,
    });

    const onNavigate = vi.fn();
    renderWithRouter(
      <OfflineIndicator 
        showDownloadsLink={true}
        onNavigateToDownloads={onNavigate}
      />
    );

    const downloadsButton = screen.getByText(/View Downloads/i);
    expect(downloadsButton).toBeInTheDocument();

    fireEvent.click(downloadsButton);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('should not show downloads link when disabled', () => {
    vi.spyOn(useOfflineModule, 'useOffline').mockReturnValue({
      isOnline: false,
      isOffline: true,
      wasOffline: true,
      checkOnlineStatus: () => false,
    });

    renderWithRouter(
      <OfflineIndicator showDownloadsLink={false} />
    );

    expect(screen.queryByText(/View Downloads/i)).not.toBeInTheDocument();
  });

  it('should display wifi off icon', () => {
    vi.spyOn(useOfflineModule, 'useOffline').mockReturnValue({
      isOnline: false,
      isOffline: true,
      wasOffline: true,
      checkOnlineStatus: () => false,
    });

    const { container } = renderWithRouter(<OfflineIndicator />);
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });
});
