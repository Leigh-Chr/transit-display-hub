import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testTranslocoModule } from '../../../test-translations';
import { AdminLayoutComponent } from './admin-layout.component';
import { AuthService } from '@core/auth/auth.service';
import { ThemeService } from '@core/services/theme.service';
import { BreakpointService } from '@core/services/breakpoint.service';

const en = {
  admin: {
    navigation: {
      dashboard: 'Dashboard',
      sectionNetwork: 'Network',
      sectionCommunication: 'Communication',
      sectionAdministration: 'Administration',
      lines: 'Lines',
      stops: 'Stops',
      itineraries: 'Itineraries',
      schedules: 'Schedules',
      networkMap: 'Network Map',
      hubDisplay: 'Hub Display',
      messages: 'Messages',
      devices: 'Devices',
      realtime: 'Real-time',
      importAudit: 'Import History',
      shapes: 'Shapes',
      users: 'Users',
      skipToMain: 'Skip to main content',
      toggleSidebar: 'Toggle sidebar',
      toggleMenu: 'Menu',
      switchLight: 'Switch to light mode',
      switchDark: 'Switch to dark mode',
      logout: 'Logout',
    },
  },
};

const fr = {
  admin: {
    navigation: {
      dashboard: 'Tableau de bord',
      sectionNetwork: 'Réseau',
      sectionCommunication: 'Communication',
      sectionAdministration: 'Administration',
      lines: 'Lignes',
      stops: 'Arrêts',
      itineraries: 'Itinéraires',
      schedules: 'Horaires',
      networkMap: 'Carte du réseau',
      hubDisplay: 'Affichage pôle',
      messages: 'Messages',
      devices: 'Bornes',
      realtime: 'Temps réel',
      importAudit: 'Historique des imports',
      shapes: 'Tracés',
      users: 'Utilisateurs',
      skipToMain: 'Aller au contenu principal',
      toggleSidebar: 'Afficher / masquer la barre latérale',
      toggleMenu: 'Menu',
      switchLight: 'Passer en mode clair',
      switchDark: 'Passer en mode sombre',
      logout: 'Déconnexion',
    },
  },
};

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
      imports: [
        AdminLayoutComponent,
        testTranslocoModule(en, fr),
      ],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuthService },
        { provide: ThemeService, useValue: mockThemeService },
        { provide: BreakpointService, useValue: mockBreakpointService },
      ],
    });

    fixture = TestBed.createComponent(AdminLayoutComponent);
    component = fixture.componentInstance;
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

  describe('template rendering', () => {
    it('should show all nav links when authService.isAdmin() is true', async () => {
      mockAuthService.isAdmin.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      const navLinks = fixture.nativeElement.querySelectorAll('a[mat-list-item]');
      const hasLink = (name: string): boolean => Array.from(navLinks as NodeListOf<HTMLElement>).some(
        (link) => link.textContent.includes(name)
      );

      expect(hasLink('Users')).toBe(true);
      expect(hasLink('Lines')).toBe(true);
      expect(hasLink('Stops')).toBe(true);
      expect(hasLink('Itineraries')).toBe(true);
      expect(hasLink('Schedules')).toBe(true);
      expect(hasLink('Devices')).toBe(true);
      expect(hasLink('Dashboard')).toBe(true);
      expect(hasLink('Messages')).toBe(true);
      expect(hasLink('Network Map')).toBe(true);
    });

    it('should hide admin-only nav links when authService.isAdmin() is false', async () => {
      mockAuthService.isAdmin.set(false);
      fixture.detectChanges();
      await fixture.whenStable();

      const navLinks = fixture.nativeElement.querySelectorAll('a[mat-list-item]');
      const hasLink = (name: string): boolean => Array.from(navLinks as NodeListOf<HTMLElement>).some(
        (link) => link.textContent.includes(name)
      );

      expect(hasLink('Lines')).toBe(false);
      expect(hasLink('Stops')).toBe(false);
      expect(hasLink('Itineraries')).toBe(false);
      expect(hasLink('Schedules')).toBe(false);
      expect(hasLink('Devices')).toBe(false);
      expect(hasLink('Users')).toBe(false);
    });

    it('should always show Dashboard, Messages, and Network Map links', async () => {
      mockAuthService.isAdmin.set(false);
      fixture.detectChanges();
      await fixture.whenStable();

      const navLinks = fixture.nativeElement.querySelectorAll('a[mat-list-item]');
      const hasLink = (name: string): boolean => Array.from(navLinks as NodeListOf<HTMLElement>).some(
        (link) => link.textContent.includes(name)
      );

      expect(hasLink('Dashboard')).toBe(true);
      expect(hasLink('Messages')).toBe(true);
      expect(hasLink('Network Map')).toBe(true);
      expect(navLinks.length).toBe(3);
    });

    it('should show username when not on mobile', async () => {
      mockBreakpointService.isMobile.set(false);
      fixture.detectChanges();
      await fixture.whenStable();

      const usernameEl = fixture.nativeElement.querySelector('.username');

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
      // Find the theme toggle button (its dynamic aria-label describes the target mode)
      const themeButton = Array.from(buttons as NodeListOf<HTMLButtonElement>).find(
        (btn) => btn.getAttribute('aria-label')?.startsWith('Switch to ')
      );

      expect(themeButton).toBeDefined();
      themeButton!.click();

      expect(mockThemeService.toggleTheme).toHaveBeenCalledOnce();
    });

    it('should always show logout button regardless of screen size', async () => {
      mockBreakpointService.isMobile.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      const logoutBtn = fixture.nativeElement.querySelector('button[mat-button]');
      expect(logoutBtn).not.toBeNull();
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
