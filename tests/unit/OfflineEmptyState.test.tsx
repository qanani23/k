import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import OfflineEmptyState from '../../src/components/OfflineEmptyState';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const renderWithRouter = (component: React.ReactElement) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('OfflineEmptyState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with default props', () => {
    renderWithRouter(<OfflineEmptyState />);

    expect(screen.getByText('No Internet Connection')).toBeInTheDocument();
    expect(screen.getByText(/You are currently offline/i)).toBeInTheDocument();
    expect(screen.getByText(/View Downloaded Content/i)).toBeInTheDocument();
  });

  it('should render with custom title and message', () => {
    renderWithRouter(
      <OfflineEmptyState 
        title="Custom Title"
        message="Custom message for offline state"
      />
    );

    expect(screen.getByText('Custom Title')).toBeInTheDocument();
    expect(screen.getByText('Custom message for offline state')).toBeInTheDocument();
  });

  it('should navigate to downloads when button clicked', () => {
    renderWithRouter(<OfflineEmptyState />);

    const button = screen.getByText(/View Downloaded Content/i);
    fireEvent.click(button);

    expect(mockNavigate).toHaveBeenCalledWith('/downloads');
  });

  it('should not show downloads button when disabled', () => {
    renderWithRouter(
      <OfflineEmptyState showDownloadsButton={false} />
    );

    expect(screen.queryByText(/View Downloaded Content/i)).not.toBeInTheDocument();
  });

  it('should display wifi off icon', () => {
    const { container } = renderWithRouter(<OfflineEmptyState />);
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('should have proper styling classes', () => {
    const { container } = renderWithRouter(<OfflineEmptyState />);
    const wrapper = container.querySelector('.glass');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass('rounded-xl', 'p-12', 'text-center');
  });
});
