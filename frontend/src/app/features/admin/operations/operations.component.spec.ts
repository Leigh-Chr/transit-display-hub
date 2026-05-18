import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, it, expect, beforeEach } from 'vitest';
import { OperationsComponent } from './operations.component';
import { testTranslocoModule } from '../../../../test-translations';

const en = {
  admin: {
    navigation: {
      operations: 'Operations',
      realtime: 'Real-time',
      importAudit: 'Import History',
    },
  },
};

const fr = {
  admin: {
    navigation: {
      operations: 'Exploitation',
      realtime: 'Temps réel',
      importAudit: 'Historique des imports',
    },
  },
};

describe('OperationsComponent', () => {
  let fixture: ComponentFixture<OperationsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OperationsComponent, testTranslocoModule(en, fr)],
      providers: [provideRouter([])],
    });

    fixture = TestBed.createComponent(OperationsComponent);
  });

  it('should render the two operational tab links', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const links = fixture.nativeElement.querySelectorAll('a[mat-tab-link]');
    expect(links.length).toBe(2);

    const labels = Array.from(links as NodeListOf<HTMLAnchorElement>).map((l) =>
      l.textContent.trim(),
    );
    expect(labels.some((l) => l.includes('Real-time'))).toBe(true);
    expect(labels.some((l) => l.includes('Import History'))).toBe(true);
  });

  it('should label the tab nav for screen readers', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    const nav = fixture.nativeElement.querySelector('nav[mat-tab-nav-bar]');
    expect(nav).not.toBeNull();
    expect(nav.getAttribute('aria-label')).toBe('Operations');
  });
});
