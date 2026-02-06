import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, ChildrenOutletContexts } from '@angular/router';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminLayoutComponent } from './admin-layout.component';
import { AuthService } from '@core/auth/auth.service';
import { ThemeService } from '@core/services/theme.service';
import { BreakpointService } from '@core/services/breakpoint.service';

describe('AdminLayoutComponent', () => {
  let component: AdminLayoutComponent;
  let fixture: ComponentFixture<AdminLayoutComponent>;
  let mockAuthService: {
    isAdmin: ReturnType<typeof signal<boolean>>;
    currentUser: ReturnType<typeof signal<{ username: string; role: string } | null>>;
    logout: ReturnType<typeof vi.fn>;
  };
  let mockThemeService: {
    isDarkMode: ReturnType<typeof signal<boolean>>;
    toggleTheme: ReturnType<typeof vi.fn>;
  };
  let mockBreakpointService: {
    isSmallScreen: ReturnType<typeof signal<boolean>>;
    isMobile: ReturnType<typeof signal<boolean>>;
  };

  beforeEach(() => {
    localStorage.clear();

    mockAuthService = {
      isAdmin: signal(true),
      currentUser: signal({ username: 'admin', role: 'ADMIN' }),
      logout: vi.fn(),
    };

    mockThemeService = {
      isDarkMode: signal(false),
      toggleTheme: vi.fn(),
    };

    mockBreakpointService = {
      isSmallScreen: signal(false),
      isMobile: signal(false),
    };

    TestBed.configureTestingModule({
      imports: [AdminLayoutComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: ThemeService, useValue: mockThemeService },
        { provide: BreakpointService, useValue: mockBreakpointService },
      ],
    });

    fixture = TestBed.createComponent(AdminLayoutComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('sidenavOpen initialization', () => {
    it('should default to true when no localStorage value is set', () => {
      expect(component.sidenavOpen()).toBe(true);
    });

    it('should read false from localStorage', () => {
      localStorage.setItem('sidenav-open', 'false');

      // Recreate the component so it reads the updated localStorage during construction
      fixture = TestBed.createComponent(AdminLayoutComponent);
      component = fixture.componentInstance;

      expect(component.sidenavOpen()).toBe(false);
    });

    it('should read true from localStorage when explicitly set', () => {
      localStorage.setItem('sidenav-open', 'true');

      fixture = TestBed.createComponent(AdminLayoutComponent);
      component = fixture.componentInstance;

      expect(component.sidenavOpen()).toBe(true);
    });
  });

  describe('toggleSidenav', () => {
    it('should toggle the signal from true to false', () => {
      expect(component.sidenavOpen()).toBe(true);

      component.toggleSidenav();

      expect(component.sidenavOpen()).toBe(false);
    });

    it('should toggle the signal from false to true', () => {
      component.sidenavOpen.set(false);

      component.toggleSidenav();

      expect(component.sidenavOpen()).toBe(true);
    });

    it('should save the new state to localStorage', () => {
      component.toggleSidenav();

      expect(localStorage.getItem('sidenav-open')).toBe('false');

      component.toggleSidenav();

      expect(localStorage.getItem('sidenav-open')).toBe('true');
    });
  });

  describe('closeSidenavOnMobile', () => {
    it('should close sidenav when isSmallScreen is true', () => {
      mockBreakpointService.isSmallScreen.set(true);
      expect(component.sidenavOpen()).toBe(true);

      component.closeSidenavOnMobile();

      expect(component.sidenavOpen()).toBe(false);
    });

    it('should not close sidenav when isSmallScreen is false', () => {
      mockBreakpointService.isSmallScreen.set(false);
      expect(component.sidenavOpen()).toBe(true);

      component.closeSidenavOnMobile();

      expect(component.sidenavOpen()).toBe(true);
    });
  });

  describe('logout', () => {
    it('should call authService.logout()', () => {
      component.logout();

      expect(mockAuthService.logout).toHaveBeenCalledOnce();
    });
  });

  describe('getRouteAnimationData', () => {
    it('should return empty string when no context is available', () => {
      const contexts = TestBed.inject(ChildrenOutletContexts);
      vi.spyOn(contexts, 'getContext').mockReturnValue(null);

      expect(component.getRouteAnimationData()).toBe('');
    });

    it('should return empty string when context has no route', () => {
      const contexts = TestBed.inject(ChildrenOutletContexts);
      vi.spyOn(contexts, 'getContext').mockReturnValue({ route: null } as any);

      expect(component.getRouteAnimationData()).toBe('');
    });

    it('should return the url string from the route snapshot', () => {
      const contexts = TestBed.inject(ChildrenOutletContexts);
      vi.spyOn(contexts, 'getContext').mockReturnValue({
        route: {
          snapshot: {
            url: ['admin', 'dashboard'],
          },
        },
      } as any);

      expect(component.getRouteAnimationData()).toBe('admin,dashboard');
    });
  });

  describe('template rendering', () => {
    it('should show Users nav link when authService.isAdmin() is true', async () => {
      mockAuthService.isAdmin.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      const navLinks = fixture.nativeElement.querySelectorAll('a[mat-list-item]');
      const usersLink = Array.from(navLinks).find(
        (link: any) => link.textContent?.includes('Users')
      );

      expect(usersLink).toBeTruthy();
    });

    it('should hide Users nav link when authService.isAdmin() is false', async () => {
      mockAuthService.isAdmin.set(false);
      fixture.detectChanges();
      await fixture.whenStable();

      const navLinks = fixture.nativeElement.querySelectorAll('a[mat-list-item]');
      const usersLink = Array.from(navLinks).find(
        (link: any) => link.textContent?.includes('Users')
      );

      expect(usersLink).toBeFalsy();
    });

    it('should show username when not on mobile', async () => {
      mockBreakpointService.isMobile.set(false);
      fixture.detectChanges();
      await fixture.whenStable();

      const usernameEl = fixture.nativeElement.querySelector('.username');

      expect(usernameEl).toBeTruthy();
      expect(usernameEl.textContent).toContain('admin');
    });

    it('should hide username when on mobile', async () => {
      mockBreakpointService.isMobile.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      const usernameEl = fixture.nativeElement.querySelector('.username');

      expect(usernameEl).toBeFalsy();
    });

    it('should call themeService.toggleTheme when theme button is clicked', async () => {
      fixture.detectChanges();
      await fixture.whenStable();

      const buttons = fixture.nativeElement.querySelectorAll('button[mat-icon-button]');
      // Find the theme toggle button (has dark_mode or light_mode icon)
      const themeButton = Array.from(buttons).find(
        (btn: any) => btn.getAttribute('aria-label') === 'Toggle dark mode'
      ) as HTMLButtonElement;

      expect(themeButton).toBeTruthy();
      themeButton.click();

      expect(mockThemeService.toggleTheme).toHaveBeenCalledOnce();
    });

    it('should always show logout button regardless of screen size', async () => {
      mockBreakpointService.isMobile.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      const logoutBtn = fixture.nativeElement.querySelector('button[mat-button]');
      expect(logoutBtn).toBeTruthy();
    });

    it('should show "Logout" text on desktop but not on mobile', async () => {
      // Desktop: should show text
      mockBreakpointService.isMobile.set(false);
      fixture.detectChanges();
      await fixture.whenStable();

      const logoutBtn = fixture.nativeElement.querySelector('button[mat-button]');
      expect(logoutBtn.textContent).toContain('Logout');

      // Mobile: text should be hidden
      mockBreakpointService.isMobile.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      const mobileLogoutBtn = fixture.nativeElement.querySelector('button[mat-button]');
      // On mobile, only the icon is shown, no "Logout" text
      expect(mobileLogoutBtn.textContent.trim()).not.toContain('Logout');
    });
  });
});
