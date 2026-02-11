import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Search, Download, Heart, Settings, Bell, X } from 'lucide-react';
import { CATEGORIES } from '../config/categories';
import { UpdateState } from '../types';
import { useDebouncedSearch } from '../hooks/useDebouncedSearch';
import { gsap } from 'gsap';

interface NavBarProps {
  updateState: UpdateState;
}

export default function NavBar({ updateState }: NavBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState(
    updateState.status === 'optional' && !updateState.deferred_until
  );
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const dropdownMenuRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  
  const { query, setQuery, clearSearch } = useDebouncedSearch();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when search is shown
  useEffect(() => {
    if (showSearch && searchRef.current) {
      searchRef.current.focus();
    }
  }, [showSearch]);

  // Handle search submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setShowSearch(false);
      clearSearch();
    }
  };

  // Handle dropdown toggle
  const handleDropdownToggle = (categoryKey: string) => {
    const newActiveDropdown = activeDropdown === categoryKey ? null : categoryKey;
    setActiveDropdown(newActiveDropdown);
  };

  // Handle keyboard navigation for dropdowns
  const handleDropdownKeyDown = (e: React.KeyboardEvent, categoryKey: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleDropdownToggle(categoryKey);
    } else if (e.key === 'Escape' && activeDropdown === categoryKey) {
      e.preventDefault();
      setActiveDropdown(null);
    } else if (e.key === 'ArrowDown' && activeDropdown === categoryKey) {
      e.preventDefault();
      // Focus first dropdown item
      const dropdown = dropdownMenuRefs.current.get(categoryKey);
      if (dropdown) {
        const firstButton = dropdown.querySelector('button');
        firstButton?.focus();
      }
    }
  };

  // Handle keyboard navigation within dropdown menu
  const handleDropdownMenuKeyDown = (e: React.KeyboardEvent, categoryKey: string) => {
    const dropdown = dropdownMenuRefs.current.get(categoryKey);
    if (!dropdown) return;

    const buttons = Array.from(dropdown.querySelectorAll('button'));
    const currentIndex = buttons.findIndex(btn => btn === document.activeElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % buttons.length;
      buttons[nextIndex]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = currentIndex <= 0 ? buttons.length - 1 : currentIndex - 1;
      buttons[prevIndex]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setActiveDropdown(null);
      // Return focus to the dropdown trigger button
      const triggerButton = document.querySelector(`button[aria-expanded="true"]`) as HTMLButtonElement;
      triggerButton?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      buttons[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      buttons[buttons.length - 1]?.focus();
    }
  };

  // GSAP animation for dropdown open/close (respecting prefers-reduced-motion)
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    dropdownMenuRefs.current.forEach((menu, key) => {
      if (activeDropdown === key) {
        // Opening animation
        if (!prefersReducedMotion) {
          gsap.fromTo(menu,
            { opacity: 0, y: -10 },
            { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' }
          );
        } else {
          // Immediate state for reduced motion
          gsap.set(menu, { opacity: 1, y: 0 });
        }
      }
    });
  }, [activeDropdown]);

  // Handle category navigation
  const handleCategoryClick = (categoryKey: string, filterTag?: string) => {
    const path = `/${categoryKey}${filterTag ? `?filter=${filterTag}` : ''}`;
    navigate(path);
    setActiveDropdown(null);
  };

  // Check if current path matches category
  const isActiveCategory = (categoryKey: string) => {
    return location.pathname === `/${categoryKey}`;
  };

  // Handle update banner actions
  const handleUpdateClick = () => {
    if (updateState.download_url) {
      window.open(updateState.download_url, '_blank');
    }
  };

  const handleDismissUpdate = () => {
    setShowUpdateBanner(false);
  };

  return (
    <>
      {/* Update Banner */}
      {showUpdateBanner && updateState.status === 'optional' && (
        <div className="bg-accent-gradient text-white px-4 py-2 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            <span>
              Kiyya {updateState.latest_version} is available! 
              {updateState.release_notes && (
                <span className="ml-1 opacity-90">- {updateState.release_notes}</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleUpdateClick}
              className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-xs font-medium transition-colors"
            >
              Update
            </button>
            <button
              onClick={handleDismissUpdate}
              className="hover:bg-white/20 p-1 rounded transition-colors"
              aria-label="Dismiss update notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-40 glass border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link 
              to="/" 
              className="text-2xl font-bold text-gradient hover:scale-105 transition-transform"
            >
              Kiyya
            </Link>

            {/* Main Navigation */}
            <div className="hidden md:flex items-center space-x-8" ref={dropdownRef}>
              {/* Home */}
              <Link
                to="/"
                className={`nav-item ${location.pathname === '/' ? 'active' : ''}`}
              >
                Home
              </Link>

              {/* Category Dropdowns */}
              {Object.entries(CATEGORIES).map(([key, category]) => (
                <div key={key} className="relative">
                  <button
                    onClick={() => handleDropdownToggle(key)}
                    onKeyDown={(e) => handleDropdownKeyDown(e, key)}
                    className={`nav-item flex items-center gap-1 ${isActiveCategory(key) ? 'active' : ''}`}
                    aria-expanded={activeDropdown === key}
                    aria-haspopup="true"
                  >
                    {category.label}
                    {category.filters.length > 0 && (
                      <ChevronDown 
                        className={`w-4 h-4 transition-transform ${
                          activeDropdown === key ? 'rotate-180' : ''
                        }`} 
                      />
                    )}
                  </button>

                  {/* Dropdown Menu */}
                  {activeDropdown === key && category.filters.length > 0 && (
                    <div 
                      ref={(el) => {
                        if (el) dropdownMenuRefs.current.set(key, el);
                        else dropdownMenuRefs.current.delete(key);
                      }}
                      className="absolute top-full left-0 mt-2 dropdown min-w-48"
                      role="menu"
                      onKeyDown={(e) => handleDropdownMenuKeyDown(e, key)}
                    >
                      <button
                        onClick={() => handleCategoryClick(key)}
                        className="dropdown-item"
                        role="menuitem"
                      >
                        All {category.label}
                      </button>
                      {category.filters.map((filter: any) => (
                        <button
                          key={filter.tag}
                          onClick={() => handleCategoryClick(key, filter.tag)}
                          className="dropdown-item"
                          role="menuitem"
                        >
                          {filter.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="relative">
                {showSearch ? (
                  <form onSubmit={handleSearchSubmit} className="flex items-center">
                    <input
                      ref={searchRef}
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search content..."
                      className="search-input w-64"
                      onBlur={() => {
                        // Delay hiding to allow form submission
                        setTimeout(() => setShowSearch(false), 150);
                      }}
                      aria-label="Search content"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowSearch(false);
                        clearSearch();
                      }}
                      className="ml-2 p-2 hover:bg-white/10 rounded-lg transition-colors"
                      aria-label="Close search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => setShowSearch(true)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    aria-label="Open search"
                  >
                    <Search className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Downloads */}
              <Link
                to="/downloads"
                className={`p-2 hover:bg-white/10 rounded-lg transition-colors ${
                  location.pathname === '/downloads' ? 'text-accent-cyan' : ''
                }`}
                aria-label="Downloads"
              >
                <Download className="w-5 h-5" />
              </Link>

              {/* Favorites */}
              <Link
                to="/favorites"
                className={`p-2 hover:bg-white/10 rounded-lg transition-colors ${
                  location.pathname === '/favorites' ? 'text-accent-cyan' : ''
                }`}
                aria-label="Favorites"
              >
                <Heart className="w-5 h-5" />
              </Link>

              {/* Settings */}
              <Link
                to="/settings"
                className={`p-2 hover:bg-white/10 rounded-lg transition-colors ${
                  location.pathname === '/settings' ? 'text-accent-cyan' : ''
                }`}
                aria-label="Settings"
              >
                <Settings className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden border-t border-white/10">
          <div className="px-4 py-2 space-y-1">
            <Link
              to="/"
              className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                location.pathname === '/' 
                  ? 'bg-white/10 text-text-primary' 
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
              }`}
            >
              Home
            </Link>
            
            {Object.entries(CATEGORIES).map(([key, category]) => (
              <Link
                key={key}
                to={`/${key}`}
                className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActiveCategory(key)
                    ? 'bg-white/10 text-text-primary' 
                    : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                }`}
              >
                {category.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </>
  );
}